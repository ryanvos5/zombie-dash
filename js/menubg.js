/* ============================================================
   MENU-BG — dynamische vulkaan-achtergrond achter de menu's.
   Uitbarstingen, rook, gloeiende lava en vuur-snippers.
   Draait alleen als het menu zichtbaar is (start/stop).
   ============================================================ */
const MenuBg = {
  canvas: null, ctx: null, raf: 0, running: false,
  W: 0, H: 0, t: 0, last: 0,
  smoke: [], embers: [], blobs: [],
  nextErupt: 0, eruptUntil: 0, flash: 0, shake: 0, glow: 0,

  init() {
    this.canvas = document.getElementById('menu-bg-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    if (!this.canvas) return;
    const host = this.canvas.parentElement || document.body;
    const cw = host.clientWidth || window.innerWidth || 640;
    const ch = host.clientHeight || window.innerHeight || 360;
    const sc = Math.min(1, 640 / Math.max(cw, ch));   // interne res beperken (mobiel-vriendelijk)
    this.W = Math.max(200, Math.round(cw * sc));
    this.H = Math.max(140, Math.round(ch * sc));
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx.imageSmoothingEnabled = true;
  },

  start() {
    if (!this.canvas || this.running) return;
    this.running = true; this.last = (window.performance && performance.now) ? performance.now() : 0;
    this.nextErupt = this.t + 2600 + Math.random() * 2600;
    this.loop();
  },
  stop() { this.running = false; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
  loop() {
    if (!this.running) return;
    const now = (window.performance && performance.now) ? performance.now() : this.last + 16;
    let dt = now - this.last; this.last = now;
    if (!dt || dt > 60) dt = 16.7;
    this.update(dt); this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  },

  crater() { return { x: this.W * 0.5, y: this.H * 0.30, r: this.W * 0.075 }; },

  update(dt) {
    this.t += dt;
    const f = dt / 16.7;                 // frame-factor
    const c = this.crater();

    // ---- uitbarsting-timing ----
    if (this.t >= this.nextErupt) {
      this.erupt();
      this.nextErupt = this.t + 5000 + Math.random() * 5000;
    }
    const erupting = this.t < this.eruptUntil;
    this.flash = Math.max(0, this.flash - dt * 0.0016);
    this.shake = Math.max(0, this.shake - dt * 0.02);
    // gloed pulseert (sterker tijdens uitbarsting)
    const target = erupting ? 1 : 0.55 + Math.sin(this.t / 700) * 0.12;
    this.glow += (target - this.glow) * 0.06 * f;

    // ---- rook blijven spuwen ----
    const smokeRate = erupting ? 0.9 : 0.28;
    if (Math.random() < smokeRate * f && this.smoke.length < 90) this.spawnSmoke(c, erupting);
    // ---- vuur-snippers (embers) ----
    const emberRate = erupting ? 0.8 : 0.35;
    if (Math.random() < emberRate * f && this.embers.length < 70) this.spawnEmber(c, erupting);

    // ---- rook updaten ----
    for (const s of this.smoke) {
      s.x += s.vx * f; s.y += s.vy * f; s.vy += 0.004 * f;   // stijgt en zwelt
      s.r += s.grow * f; s.life -= dt;
    }
    this.smoke = this.smoke.filter((s) => s.life > 0);

    // ---- embers updaten (flikkeren + stijgen) ----
    for (const e of this.embers) {
      e.x += e.vx * f; e.y += e.vy * f; e.vy += 0.02 * f; e.vx *= 0.99;
      e.life -= dt; e.tw = Math.random();
    }
    this.embers = this.embers.filter((e) => e.life > 0);

    // ---- lava-brokken (uitbarsting) ----
    for (const b of this.blobs) {
      b.x += b.vx * f; b.y += b.vy * f; b.vy += 0.16 * f;
      b.life -= dt; b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.pop();
    }
    this.blobs = this.blobs.filter((b) => b.life > 0 && b.y < this.H + 20);
  },

  erupt() {
    const c = this.crater();
    this.eruptUntil = this.t + 1300;
    this.flash = 0.9; this.shake = 6;
    const n = 14 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
      const sp = (this.H * 0.012) * (0.7 + Math.random() * 0.9);
      this.blobs.push({ x: c.x + (Math.random() - 0.5) * c.r, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 3, life: 1400 + Math.random() * 700, trail: [] });
    }
    for (let i = 0; i < 10; i++) this.spawnSmoke(c, true);
    if (window.Sfx && Sfx.play && !Sfx.muted) { try { Sfx.play('lava'); } catch (e) {} }
  },

  spawnSmoke(c, big) {
    const col = Math.random() < 0.5 ? [60, 48, 46] : [42, 34, 34];
    this.smoke.push({
      x: c.x + (Math.random() - 0.5) * c.r * 1.4,
      y: c.y - 2,
      vx: (Math.random() - 0.5) * 0.5, vy: -(0.5 + Math.random() * (big ? 1.4 : 0.9)),
      r: (big ? 10 : 6) + Math.random() * 10, grow: 0.12 + Math.random() * 0.14,
      life: 4200 + Math.random() * 3200, maxLife: 7400, col,
    });
  },
  spawnEmber(c, big) {
    this.embers.push({
      x: c.x + (Math.random() - 0.5) * c.r * (big ? 2 : 1.2),
      y: c.y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 1.2, vy: -(0.8 + Math.random() * (big ? 2.4 : 1.4)),
      life: 900 + Math.random() * 1100, maxLife: 2000, tw: 1,
    });
  },

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H; if (!ctx) return;
    const c = this.crater();
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(1, 0, 0, 1, Math.round(sx), Math.round(sy));

    // ---- lucht ----
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#160611'); sky.addColorStop(0.42, '#2c0b14');
    sky.addColorStop(0.66, '#5a1810'); sky.addColorStop(1, '#0b0406');
    ctx.fillStyle = sky; ctx.fillRect(-8, -8, W + 16, H + 16);

    // ---- gloed rond de krater ----
    const gr = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, H * 0.7);
    const ga = 0.30 + this.glow * 0.4;
    gr.addColorStop(0, 'rgba(255,140,40,' + ga.toFixed(3) + ')');
    gr.addColorStop(0.4, 'rgba(220,70,20,' + (ga * 0.5).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);

    // ---- verre kleine vulkanen ----
    ctx.fillStyle = '#180a0e';
    this._mtn(ctx, W * 0.16, H * 0.55, W * 0.20, H * 0.20);
    this._mtn(ctx, W * 0.84, H * 0.57, W * 0.22, H * 0.18);

    // ---- rook (achter de vulkaan) ----
    this._smoke(ctx, true, c);

    // ---- hoofdvulkaan ----
    const baseY = H * 0.98, peakY = c.y, leftX = W * 0.10, rightX = W * 0.90;
    const rock = ctx.createLinearGradient(0, peakY, 0, baseY);
    rock.addColorStop(0, '#3a2018'); rock.addColorStop(0.5, '#241214'); rock.addColorStop(1, '#140a0d');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.lineTo(c.x - c.r, peakY + c.r * 0.3);
    ctx.lineTo(c.x + c.r, peakY + c.r * 0.3);
    ctx.lineTo(rightX, baseY);
    ctx.closePath(); ctx.fill();
    // rand-highlight
    ctx.strokeStyle = 'rgba(120,60,40,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(c.x - c.r, peakY + c.r * 0.3); ctx.lineTo(leftX, baseY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x + c.r, peakY + c.r * 0.3); ctx.lineTo(rightX, baseY); ctx.stroke();

    // ---- lava-stromen langs de hellingen ----
    const lavaGlow = 0.55 + this.glow * 0.45;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const dir = i === 0 ? 0 : (i === 1 ? -1 : 1);
      ctx.strokeStyle = 'rgba(255,120,30,' + lavaGlow.toFixed(3) + ')'; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(c.x + dir * c.r * 0.5, peakY + c.r * 0.4);
      for (let k = 1; k <= 6; k++) {
        const tt = k / 6, yy = peakY + c.r * 0.4 + (baseY - peakY) * tt;
        const xx = c.x + dir * (c.r * 0.5 + (rightX - c.x) * tt * 0.85) + Math.sin(this.t / 400 + i + k) * 3;
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,120,' + (lavaGlow * 0.8).toFixed(3) + ')'; ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // ---- krater-lava (pulserend) ----
    const pool = ctx.createRadialGradient(c.x, peakY, 1, c.x, peakY, c.r * 1.2);
    pool.addColorStop(0, '#fff0a0'); pool.addColorStop(0.4, '#ff8a2a'); pool.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = pool;
    ctx.save(); ctx.translate(c.x, peakY + c.r * 0.28); ctx.scale(1, 0.5);
    ctx.beginPath(); ctx.arc(0, 0, c.r * (1.05 + this.glow * 0.15), 0, 6.2832); ctx.fill();
    ctx.restore();

    // ---- lava-brokken (uitbarsting) ----
    for (const b of this.blobs) {
      const a = Math.max(0, Math.min(1, b.life / 1200));
      for (let i = 0; i < b.trail.length; i++) { const tp = b.trail[i]; ctx.globalAlpha = a * (1 - i / b.trail.length) * 0.5; ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(tp.x, tp.y, b.r * 0.7, 0, 6.2832); ctx.fill(); }
      ctx.globalAlpha = a; ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- rook (vóór de vulkaan) ----
    this._smoke(ctx, false, c);

    // ---- vuur-snippers ----
    for (const e of this.embers) {
      const a = Math.max(0, e.life / e.maxLife) * (0.6 + e.tw * 0.4);
      ctx.globalAlpha = a; ctx.fillStyle = e.tw > 0.5 ? '#ffd24a' : '#ff7a2a';
      ctx.fillRect(Math.round(e.x), Math.round(e.y), 2, 2);
    }
    ctx.globalAlpha = 1;

    // ---- uitbarstings-flits ----
    if (this.flash > 0.01) { ctx.fillStyle = 'rgba(255,150,60,' + (this.flash * 0.28).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },

  _smoke(ctx, back, c) {
    for (const s of this.smoke) {
      const isBack = s.y < c.y;         // hoger = verder weg (achter)
      if (back !== isBack) continue;
      const a = Math.max(0, s.life / s.maxLife) * (back ? 0.5 : 0.42);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgb(' + s.col[0] + ',' + s.col[1] + ',' + s.col[2] + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  _mtn(ctx, cx, baseY, w, h) {
    ctx.beginPath(); ctx.moveTo(cx - w, baseY); ctx.lineTo(cx, baseY - h); ctx.lineTo(cx + w, baseY); ctx.closePath(); ctx.fill();
  },
};
window.MenuBg = MenuBg;
