import { WIDTH, HEIGHT } from "./config.js";
import { initAudio, sfx } from "./audio.js";
import {
  Starfield,
  Bullet,
  Player,
  Enemy,
  Powerup,
  explode,
} from "./entities.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const HIGH_SCORE_KEY = "spaceshooter.highscore";

const game = {
  state: "menu", // menu | playing | paused | gameover
  score: 0,
  wave: 0,
  highScore: Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0,
  player: null,
  bullets: [],
  enemyBullets: [],
  enemies: [],
  particles: [],
  powerups: [],
  toSpawn: 0,
  spawnTimer: 0,
  waveDelay: 0,
  time: 0,
};

const starfield = new Starfield();
const keys = new Set();

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
    e.preventDefault();
  }
  keys.add(e.key);

  if (e.key === "Enter") {
    if (game.state === "menu" || game.state === "gameover") startGame();
  }
  if ((e.key === "p" || e.key === "P") && (game.state === "playing" || game.state === "paused")) {
    game.state = game.state === "playing" ? "paused" : "playing";
  }
});

window.addEventListener("keyup", (e) => keys.delete(e.key));

function startGame() {
  initAudio();
  game.state = "playing";
  game.score = 0;
  game.wave = 0;
  game.player = new Player();
  game.bullets = [];
  game.enemyBullets = [];
  game.enemies = [];
  game.particles = [];
  game.powerups = [];
  game.waveDelay = 0;
  nextWave();
}

function nextWave() {
  game.wave += 1;
  game.toSpawn = 5 + game.wave * 2;
  game.spawnTimer = 0.5;
  sfx.wave();
}

function spawnEnemy() {
  const roll = Math.random();
  let type = "grunt";
  if (game.wave >= 3 && roll < 0.2) type = "shooter";
  else if (game.wave >= 2 && roll < 0.5) type = "zig";
  game.enemies.push(new Enemy(type, game.wave));
}

function rectsOverlap(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

function circleHitsPlayer(bullet, player) {
  return (
    Math.abs(bullet.x - player.x) < player.w / 2 + bullet.radius &&
    Math.abs(bullet.y - player.y) < player.h / 2 + bullet.radius
  );
}

function damagePlayer() {
  const p = game.player;
  if (p.invuln > 0) return;
  p.lives -= 1;
  p.invuln = 2;
  p.power = 1;
  game.particles.push(...explode(p.x, p.y, "#4dc9ff", 40));
  sfx.playerHit();
  if (p.lives <= 0) {
    game.state = "gameover";
    sfx.explosion();
    if (game.score > game.highScore) {
      game.highScore = game.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(game.highScore));
    }
  }
}

function update(dt) {
  starfield.update(dt);
  game.time += dt;
  if (game.state !== "playing") return;

  const p = game.player;
  p.update(dt, keys);

  if (keys.has(" ") && p.canShoot()) {
    game.bullets.push(...p.shoot());
    sfx.shoot();
  }

  // wave spawning
  if (game.toSpawn > 0) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnEnemy();
      game.toSpawn -= 1;
      game.spawnTimer = Math.max(0.25, 0.9 - game.wave * 0.05);
    }
  } else if (game.enemies.length === 0) {
    game.waveDelay -= dt;
    if (game.waveDelay <= 0) {
      game.waveDelay = 1.6;
      nextWave();
    }
  }

  for (const e of game.enemies) {
    e.update(dt);
    if (e.wantsToShoot(dt)) {
      game.enemyBullets.push(new Bullet(e.x, e.y + e.h / 2, 240, "#ff8f8f", 4));
    }
  }

  for (const b of game.bullets) b.update(dt);
  for (const b of game.enemyBullets) b.update(dt);
  for (const pw of game.powerups) pw.update(dt);
  for (const pt of game.particles) pt.update(dt);

  // player bullets vs enemies
  for (const b of game.bullets) {
    for (const e of game.enemies) {
      if (b.dead || e.dead) continue;
      if (
        Math.abs(b.x - e.x) < e.w / 2 + b.radius &&
        Math.abs(b.y - e.y) < e.h / 2 + b.radius
      ) {
        b.dead = true;
        e.hp -= 1;
        sfx.hit();
        if (e.hp <= 0) {
          e.dead = true;
          game.score += e.score;
          game.particles.push(...explode(e.x, e.y, e.color, 26));
          sfx.explosion();
          const drop = Math.random();
          if (drop < 0.08) game.powerups.push(new Powerup(e.x, e.y, "life"));
          else if (drop < 0.22) game.powerups.push(new Powerup(e.x, e.y, "power"));
        }
      }
    }
  }

  // enemy bullets vs player
  for (const b of game.enemyBullets) {
    if (!b.dead && circleHitsPlayer(b, p)) {
      b.dead = true;
      damagePlayer();
    }
  }

  // enemies vs player
  for (const e of game.enemies) {
    if (!e.dead && rectsOverlap(e, p)) {
      e.dead = true;
      game.particles.push(...explode(e.x, e.y, e.color, 26));
      damagePlayer();
    }
  }

  // powerups vs player
  for (const pw of game.powerups) {
    if (!pw.dead && circleHitsPlayer(pw, p)) {
      pw.dead = true;
      sfx.powerup();
      if (pw.kind === "power") p.power = Math.min(3, p.power + 1);
      else p.lives += 1;
    }
  }

  game.bullets = game.bullets.filter((b) => !b.dead);
  game.enemyBullets = game.enemyBullets.filter((b) => !b.dead);
  game.enemies = game.enemies.filter((e) => !e.dead);
  game.powerups = game.powerups.filter((pw) => !pw.dead);
  game.particles = game.particles.filter((pt) => pt.life > 0);
}

function drawHud() {
  ctx.fillStyle = "#cfe3ff";
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`SCORE ${game.score}`, 16, 14);
  ctx.fillText(`WAVE ${game.wave}`, WIDTH / 2 - 30, 14);
  ctx.textAlign = "right";
  ctx.fillText(`HIGH ${game.highScore}`, WIDTH - 16, 14);
  // lives as small ships
  for (let i = 0; i < game.player.lives; i++) {
    const x = 24 + i * 26;
    const y = 44;
    ctx.fillStyle = "#4dc9ff";
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 8, y + 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCentered(lines) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = HEIGHT / 2 - (lines.length - 1) * 18;
  for (const [text, font, color] of lines) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, WIDTH / 2, y);
    y += 36;
  }
}

function render() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  starfield.draw(ctx);

  if (game.state === "menu") {
    drawCentered([
      ["SPACE SHOOTER", "bold 56px monospace", "#4dc9ff"],
      ["", "", ""],
      ["Arrows / WASD to move, SPACE to shoot, P to pause", "16px monospace", "#cfe3ff"],
      [`High score: ${game.highScore}`, "16px monospace", "#8fa8d8"],
      ["Press ENTER to start", "bold 22px monospace", "#4dff88"],
    ]);
    return;
  }

  for (const pw of game.powerups) pw.draw(ctx);
  for (const e of game.enemies) e.draw(ctx);
  for (const b of game.bullets) b.draw(ctx);
  for (const b of game.enemyBullets) b.draw(ctx);
  for (const pt of game.particles) pt.draw(ctx);
  if (game.player) game.player.draw(ctx, game.time);
  drawHud();

  if (game.state === "paused") {
    ctx.fillStyle = "rgba(5, 6, 15, 0.6)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawCentered([
      ["PAUSED", "bold 44px monospace", "#4dc9ff"],
      ["Press P to resume", "18px monospace", "#cfe3ff"],
    ]);
  }

  if (game.state === "gameover") {
    ctx.fillStyle = "rgba(5, 6, 15, 0.7)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawCentered([
      ["GAME OVER", "bold 52px monospace", "#ff5c7a"],
      [`Score: ${game.score}`, "24px monospace", "#cfe3ff"],
      [`High score: ${game.highScore}`, "18px monospace", "#8fa8d8"],
      ["Press ENTER to play again", "bold 20px monospace", "#4dff88"],
    ]);
  }
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
