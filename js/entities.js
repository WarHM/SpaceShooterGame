import { WIDTH, HEIGHT } from "./config.js";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class Starfield {
  constructor(count = 120) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const size = rand(0.5, 2.2);
      this.stars.push({
        x: rand(0, WIDTH),
        y: rand(0, HEIGHT),
        size,
        speed: size * 40,
        alpha: rand(0.3, 1),
      });
    }
  }

  update(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > HEIGHT) {
        s.y = -2;
        s.x = rand(0, WIDTH);
      }
    }
  }

  draw(ctx) {
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = "#cfe3ff";
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
}

export class Bullet {
  constructor(x, y, vy, color, radius = 3) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20 || this.y > HEIGHT + 20 || this.x < -20 || this.x > WIDTH + 20) {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Particle {
  constructor(x, y, color) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, 260);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.3, 0.8);
    this.maxLife = this.life;
    this.color = color;
    this.size = rand(1.5, 4);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

export function explode(x, y, color, count = 24) {
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(new Particle(x, y, color));
  return parts;
}

export class Player {
  constructor() {
    this.w = 44;
    this.h = 34;
    this.x = WIDTH / 2;
    this.y = HEIGHT - 60;
    this.speed = 380;
    this.cooldown = 0;
    this.fireRate = 0.16;
    this.lives = 3;
    this.invuln = 0;
    this.power = 1;
  }

  update(dt, keys) {
    if (keys.has("ArrowLeft") || keys.has("a")) this.x -= this.speed * dt;
    if (keys.has("ArrowRight") || keys.has("d")) this.x += this.speed * dt;
    if (keys.has("ArrowUp") || keys.has("w")) this.y -= this.speed * dt;
    if (keys.has("ArrowDown") || keys.has("s")) this.y += this.speed * dt;
    this.x = Math.max(this.w / 2, Math.min(WIDTH - this.w / 2, this.x));
    this.y = Math.max(HEIGHT / 2, Math.min(HEIGHT - this.h / 2 - 8, this.y));
    this.cooldown -= dt;
    this.invuln -= dt;
  }

  canShoot() {
    return this.cooldown <= 0;
  }

  shoot() {
    this.cooldown = this.fireRate;
    const bullets = [];
    const muzzle = this.y - this.h / 2;
    if (this.power >= 2) {
      bullets.push(new Bullet(this.x - 10, muzzle, -560, "#7df9ff"));
      bullets.push(new Bullet(this.x + 10, muzzle, -560, "#7df9ff"));
    } else {
      bullets.push(new Bullet(this.x, muzzle, -560, "#7df9ff"));
    }
    if (this.power >= 3) {
      const b1 = new Bullet(this.x - 4, muzzle, -540, "#7df9ff");
      const b2 = new Bullet(this.x + 4, muzzle, -540, "#7df9ff");
      b1.vx = -120;
      b2.vx = 120;
      bullets.push(b1, b2);
    }
    return bullets;
  }

  draw(ctx, time) {
    if (this.invuln > 0 && Math.floor(time * 12) % 2 === 0) return;
    const { x, y, w, h } = this;
    // engine flame
    ctx.fillStyle = "#ff9d3c";
    ctx.beginPath();
    ctx.moveTo(x - 7, y + h / 2 - 4);
    ctx.lineTo(x, y + h / 2 + 10 + Math.sin(time * 30) * 3);
    ctx.lineTo(x + 7, y + h / 2 - 4);
    ctx.closePath();
    ctx.fill();
    // hull
    ctx.fillStyle = "#4dc9ff";
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 6, y + h / 3);
    ctx.lineTo(x + w / 6, y + h / 3);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
    // cockpit
    ctx.fillStyle = "#e8fbff";
    ctx.beginPath();
    ctx.arc(x, y - h / 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const ENEMY_TYPES = {
  grunt: { hp: 1, score: 100, color: "#ff5c7a", w: 34, h: 26, speed: 70 },
  zig: { hp: 2, score: 150, color: "#ffb84d", w: 36, h: 28, speed: 60 },
  shooter: { hp: 3, score: 250, color: "#b96bff", w: 42, h: 32, speed: 50 },
};

export class Enemy {
  constructor(type, wave, x) {
    const spec = ENEMY_TYPES[type];
    this.type = type;
    this.w = spec.w;
    this.h = spec.h;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.score = spec.score;
    this.color = spec.color;
    this.x = x !== undefined ? x : rand(this.w, WIDTH - this.w);
    this.y = -this.h;
    this.baseX = this.x;
    this.vy = spec.speed + wave * 6;
    this.time = rand(0, 10);
    this.fireTimer = rand(1, 2.5);
    this.hoverY = rand(90, 220);
    this.dead = false;
  }

  update(dt) {
    this.time += dt;
    this.y += this.vy * dt;
    if (this.type === "grunt") {
      this.x = this.baseX + Math.sin(this.time * 1.5) * 30;
    } else if (this.type === "zig") {
      this.x = this.baseX + Math.sin(this.time * 2.5) * 90;
    } else if (this.type === "shooter") {
      if (this.y >= this.hoverY) this.vy = 0;
      this.x = this.baseX + Math.sin(this.time * 1.2) * 60;
    }
    this.x = Math.max(this.w / 2, Math.min(WIDTH - this.w / 2, this.x));
    if (this.y > HEIGHT + this.h) this.dead = true;
  }

  wantsToShoot(dt) {
    if (this.type !== "shooter") return false;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = rand(1.4, 2.6);
      return true;
    }
    return false;
  }

  draw(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x + w / 3, y + h / 2);
    ctx.lineTo(x - w / 3, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0b0b18";
    ctx.fillRect(x - w / 6, y - h / 6, w / 3, h / 4);
    if (this.maxHp > 1 && this.hp < this.maxHp) {
      ctx.fillStyle = "#333";
      ctx.fillRect(x - w / 2, y - h / 2 - 7, w, 3);
      ctx.fillStyle = "#4dff88";
      ctx.fillRect(x - w / 2, y - h / 2 - 7, w * (this.hp / this.maxHp), 3);
    }
  }
}

export class Powerup {
  constructor(x, y, kind) {
    this.x = x;
    this.y = y;
    this.kind = kind; // "power" | "life"
    this.vy = 110;
    this.radius = 12;
    this.time = 0;
    this.dead = false;
  }

  update(dt) {
    this.time += dt;
    this.y += this.vy * dt;
    if (this.y > HEIGHT + 20) this.dead = true;
  }

  draw(ctx) {
    const color = this.kind === "power" ? "#7df9ff" : "#4dff88";
    const pulse = 1 + Math.sin(this.time * 6) * 0.15;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.kind === "power" ? "P" : "+", this.x, this.y + 1);
  }
}
