// Juice. None of this is necessary and all of it is the reason a rhythm game
// feels good: sparks on a hit, numbers that leap off the screen, a camera that
// flinches. Keep it cheap — it runs every frame alongside the actual game.

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.shake = 0;
    this.flash = 0;
    this.flashColor = '#fff';
  }

  clear() { this.parts.length = 0; this.texts.length = 0; this.shake = 0; this.flash = 0; }

  burst(x, y, color, count = 14, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 260) * power;
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * power,
        life: 0, max: 0.35 + Math.random() * 0.45,
        size: 2 + Math.random() * 3.5 * power, color,
      });
    }
  }

  // A ring that expands and fades — reads as "impact" better than dots alone.
  ring(x, y, color, power = 1) {
    this.parts.push({ ring: true, x, y, life: 0, max: 0.34, size: 8, grow: 190 * power, color });
  }

  text(x, y, str, color, size = 26) {
    this.texts.push({ x, y, str, color, size, life: 0, max: 0.85, vy: -74 });
  }

  hit(x, y, color, strength = 1) {
    this.burst(x, y, color, Math.round(10 + 12 * strength), strength);
    this.ring(x, y, color, strength);
    this.addShake(2.5 * strength);
  }

  addShake(v) { this.shake = Math.min(16, this.shake + v); }
  screenFlash(color, amount = 0.35) { this.flash = Math.max(this.flash, amount); this.flashColor = color; }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      if (p.ring) { p.size += p.grow * dt; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 720 * dt;         // gravity — sparks should fall, not float
      p.vx *= 1 - 1.6 * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      if (t.life >= t.max) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= 1 - 2.2 * dt;
    }
    this.shake *= Math.pow(0.0025, dt);
    this.flash *= Math.pow(0.004, dt);
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * k + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const k = 1 - t.life / t.max;
      const pop = t.life < 0.09 ? 1 + (0.09 - t.life) * 4 : 1;
      ctx.globalAlpha = Math.min(1, k * 1.7);
      ctx.font = `900 ${t.size * pop}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  drawFlash(ctx, w, h) {
    if (this.flash <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = this.flash;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  shakeOffset() {
    if (this.shake < 0.1) return [0, 0];
    return [(Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake];
  }
}
