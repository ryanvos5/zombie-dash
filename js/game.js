/* ============================================================
   GAME — loop, level-logica, rendering.
   ============================================================ */

const Game = {
  canvas: null, ctx: null,
  state: 'menu',          // menu | playing | paused | win | lose
  worldId: 1, level: null,
  player: null, zombies: [], bullets: [], particles: [], coinFx: [], ammoFx: [], ammoDrops: [], healthDrops: [], corpses: [], pendingZombies: [],
  obstacles: [], powerUps: [],
  boss: null, shake: 0, hordeLeft: 0, lastHazard: -9999,
  cam: { x: 0 },
  time: 0, dtScale: 1, lastTs: 0,
  spawnTimer: 0, spawned: 0, spawnArmed: false,
  runCoins: 0, runKills: 0, ammo: 0,
  coinAnimFrame: 0, coinAnimTimer: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = CONFIG.VIEW_W;
    canvas.height = CONFIG.VIEW_H;
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((t) => this.loop(t));
  },

  // letterbox: behoud 16:9 zonder vervorming
  resize() {
    const scale = Math.min(window.innerWidth / CONFIG.VIEW_W, window.innerHeight / CONFIG.VIEW_H);
    this.canvas.style.width = Math.floor(CONFIG.VIEW_W * scale) + 'px';
    this.canvas.style.height = Math.floor(CONFIG.VIEW_H * scale) + 'px';
  },

  // ---------- level starten ----------
  startLevel(worldId, levelId) {
    const world = WORLDS.find((w) => w.id === worldId);
    const level = world.levels.find((l) => l.id === levelId);
    this.worldId = worldId;
    this.level = level;

    this.player = new Player(Storage.data.equippedMelee, Storage.data.equippedRanged, Storage.data.equippedCharacter);
    this.zombies = []; this.bullets = []; this.particles = []; this.coinFx = []; this.ammoFx = []; this.ammoDrops = []; this.healthDrops = []; this.corpses = []; this.pendingZombies = [];
    this.powerUps = [];
    this.boss = null; this.shake = 0; this.lastHazard = -9999;
    this.cam.x = 0;
    this.spawnTimer = 0; this.spawned = 0; this.spawnArmed = false;
    this.runCoins = 0; this.runKills = 0;
    this.ammo = Storage.data.ammo;   // blijvende voorraad uit vorige levels
    this.time = 0;
    this.theme = THEMES[level.theme] || THEMES.city;
    this.hordeLeft = level.mode === 'horde' ? level.hordeTime : 0;

    this.buildBackdrop(level);
    this.buildObstacles(level);

    // boss-level: plaats de mega-zombie rechts van de speler
    if (level.isBoss) {
      const boss = new Zombie(this.player.x + 240, level, ZOMBIE_TYPES.boss);
      boss.maxHp = BOSS_HP; boss.hp = BOSS_HP;
      this.boss = boss;
      this.zombies.push(boss);
    }

    this.state = 'playing';
    Input.clear();
    UI.show('game');
  },

  nextLevel() {
    const world = WORLDS.find((w) => w.id === this.worldId);
    const next = this.level.id + 1;
    if (next <= world.levels.length) this.startLevel(this.worldId, next);
    else { UI.renderLevels(); UI.show('level'); }
  },
  retryLevel() { this.startLevel(this.worldId, this.level.id); },

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; Input.clear(); }
    else if (this.state === 'paused') { this.state = 'playing'; }
  },

  // achtergrond vooraf bepalen (anders flikkeren ze). Twee lagen + deuren + lantaarns.
  buildBackdrop(level) {
    let seed = level.id * 9301 + 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const theme = THEMES[level.theme] || THEMES.city;
    // verre laag (donker, klein, sterke parallax)
    const far = [];
    const farColors = theme.far;
    let x = -60;
    while (x < level.length + 300) {
      const w = 34 + Math.floor(rnd() * 44);
      const h = 70 + Math.floor(rnd() * 110);
      far.push({ x, w, h, c: farColors[Math.floor(rnd() * farColors.length)] });
      x += w + 4 + Math.floor(rnd() * 14);
    }

    // nabije laag (dichterbij, groter, met ramen + deuren)
    const near = [];
    const doors = [];
    const nearColors = theme.near;
    x = -30;
    while (x < level.length + 120) {
      const w = 70 + Math.floor(rnd() * 60);
      const h = 95 + Math.floor(rnd() * 80);
      const c = nearColors[Math.floor(rnd() * nearColors.length)];
      const hasDoor = rnd() > 0.35 && x > 120;
      const doorX = x + 12 + Math.floor(rnd() * Math.max(8, w - 36));
      const b = { x, w, h, c, hasDoor, doorX, openUntil: 0, lit: rnd() > 0.4 };
      near.push(b);
      if (hasDoor) doors.push({ x: doorX + 10, bld: b }); // spawn-punt midden voor de deur
      x += w + 2 + Math.floor(rnd() * 16);
    }

    // straatlantaarns langs de stoep
    const lamps = [];
    for (let lx = 80; lx < level.length; lx += 150 + Math.floor(rnd() * 90)) lamps.push({ x: lx });

    this.backdrop = { far, near, doors, lamps };
  },

  // obstakels langs de route: auto's (springen), lage balken (duiken),
  // gaten met spikes (springen), en explosieve vaten (schieten)
  buildObstacles(level) {
    this.obstacles = [];
    let seed = level.id * 4099 + 31;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const density = level.obstacleDensity || 0.6;
    let x = 220; // niet meteen bij de start
    while (x < level.length - 120) {
      const r = rnd();
      if (r < 0.34) {
        this.obstacles.push({ type: 'car', x, w: 30, h: 22, color: ['#7a3030', '#30507a', '#5a5a3a'][Math.floor(rnd() * 3)] });
      } else if (r < 0.55) {
        this.obstacles.push({ type: 'lowbar', x, w: 22, h: 12 });
      } else if (r < 0.72) {
        this.obstacles.push({ type: 'hazard', x, w: 26 });
      } else {
        this.obstacles.push({ type: 'barrel', x, w: 12, hp: 1, dead: false });
      }
      x += Math.round((150 + rnd() * 200) / density); // dichter bij hogere density
    }
  },

  // ---------- effecten ----------
  spawnMuzzleFlash(x, y, dir) {
    for (let i = 0; i < 5; i++)
      this.particles.push(new Particle(x, y, dir * (1 + Math.random() * 2), (Math.random() - 0.5) * 1.5, '#ffd24a', 120, 2));
  },
  spawnBlood(x, y) {
    for (let i = 0; i < 6; i++)
      this.particles.push(new Particle(x, y, (Math.random() - 0.5) * 3, -Math.random() * 2, '#8a2222', 350, 2));
  },
  spawnMeleeSwing(player) {
    const x = player.x + player.dir * 18, y = player.y - 16;
    for (let i = 0; i < 4; i++)
      this.particles.push(new Particle(x, y, player.dir * (1 + Math.random()), (Math.random() - 0.5) * 2, '#cfd6df', 130, 2));
  },

  // raak een explosief vat binnen straal r rond (x); true als er één ontplofte
  hitBarrels(x, r, game) {
    let hit = false;
    for (const o of this.obstacles) {
      if (o.type === 'barrel' && !o.dead && Math.abs(o.x - x) < r + o.w / 2) {
        this.explodeBarrel(o);
        hit = true;
      }
    }
    return hit;
  },

  explodeBarrel(o) {
    if (o.dead) return;
    o.dead = true;
    const R = 48;
    // schade aan zombies in de buurt
    for (const z of this.zombies) {
      if (z.alive && Math.abs(z.x - o.x) < R) z.takeDamage(140, Math.sign(z.x - o.x) || 1, this, 14);
    }
    // ook de speler raakt gewond als hij te dichtbij staat!
    if (Math.abs(this.player.x - o.x) < R - 8) this.player.takeDamage(22);
    // kettingreactie met andere vaten
    for (const b of this.obstacles) {
      if (b.type === 'barrel' && !b.dead && Math.abs(b.x - o.x) < R) this.explodeBarrel(b);
    }
    // knal-effect + schermschud
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
      const col = Math.random() < 0.5 ? '#ff8a3a' : (Math.random() < 0.5 ? '#ffd24a' : '#888');
      this.particles.push(new Particle(o.x, CONFIG.GROUND_Y - 10, Math.cos(a) * sp, Math.sin(a) * sp - 1, col, 420, 3));
    }
    this.shake = Math.max(this.shake, 8);
  },

  onPowerUp(kind, x) {
    const pu = POWERUPS[kind];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      this.particles.push(new Particle(x, CONFIG.GROUND_Y - 16, Math.cos(a) * sp, Math.sin(a) * sp - 1, pu.color, 500, 2));
    }
    this.shake = Math.max(this.shake, 4);
  },

  onZombieKilled(z, reward) {
    this.runCoins += reward;
    this.runKills += 1;
    // lijk blijft op de grond liggen (oudste opruimen bij te veel)
    this.corpses.push({ x: z.x, dir: z.dir, type: z.type, tint: z.tint, flip: Math.random() < 0.5 });
    if (this.corpses.length > 60) this.corpses.shift();
    // munitie valt soms op de grond (loop erover om op te rapen)
    if (Math.random() < (z.type.ammoDropChance || 0)) {
      const drop = (z.type.ammoDrop || 0) + Math.floor(Math.random() * 3);
      if (drop > 0) this.ammoDrops.push(new AmmoPickup(z.x, drop));
    }
    // soms een EHBO-doosje (vaker in melee-levels via healMult)
    if (Math.random() < (z.type.healChance || 0) * (this.level.healMult || 1)) this.healthDrops.push(new HealthPickup(z.x));
    // zeldzaam een power-up
    if (Math.random() < POWERUP_DROP_CHANCE) {
      const kind = POWERUP_LIST[Math.floor(Math.random() * POWERUP_LIST.length)];
      this.powerUps.push(new PowerUpPickup(z.x, kind));
    }
    // bloed + opspattende munt
    for (let i = 0; i < 10; i++)
      this.particles.push(new Particle(z.x, z.y - 14, (Math.random() - 0.5) * 4, -Math.random() * 3, '#6a9c4a', 400, 2));
    this.coinFx.push({ x: z.x, y: z.y - 24, vy: -0.8, life: 700 });
  },

  knockPlayer(dir, amount) {
    this.player.x = Math.max(20, Math.min(this.level.length + 40, this.player.x + dir * amount));
    // ook een beetje de lucht in
    if (this.player.onGround) {
      this.player.vy = -Math.min(7.5, 3 + amount * 0.4);
      this.player.onGround = false;
    }
  },

  // ---------- spawnen ----------
  updateSpawns(dt) {
    if (this.level.mode === 'boss') return;         // de baas regelt zijn eigen adds
    if (!this.spawnArmed) { this.spawnTimer = 0; return; }

    // zombies blijven het HELE level door komen (tot je de finish haalt),
    // begrensd door hoeveel er tegelijk levend mogen zijn
    const aliveCount = this.zombies.reduce((n, z) => n + (z.alive ? 1 : 0), 0);
    if (aliveCount >= (this.level.maxAlive || 12)) { return; }

    this.spawnTimer += dt;
    // in horde-modus iets sneller spawnen voor de druk
    const interval = this.level.mode === 'horde' ? this.level.spawnEvery * 0.7 : this.level.spawnEvery;
    if (this.spawnTimer < interval) return;
    this.spawnTimer = 0;

    // probeer uit een deur in beeld te komen, anders vanaf de rechterkant
    let spawned = false;
    if (Math.random() < this.level.doorChance) {
      const visible = this.backdrop.doors.filter(
        (d) => d.x > this.cam.x + 20 && d.x < this.cam.x + CONFIG.VIEW_W - 20
      );
      if (visible.length) {
        const d = visible[Math.floor(Math.random() * visible.length)];
        d.bld.openUntil = this.time + 700;          // deur gaat open
        const z = new Zombie(d.x, this.level);
        z.emerging = 350;                            // vervaagt in
        this.zombies.push(z);
        this.particles.push(new Particle(d.x, CONFIG.GROUND_Y - 8, 0, -0.5, '#0a0d12', 300, 4));
        spawned = true;
      }
    }
    if (!spawned) {
      // vanaf de rechterkant (finish-kant), buiten beeld
      let sx = Math.max(this.player.x + 260, this.cam.x + CONFIG.VIEW_W + 20);
      sx = Math.min(sx, this.level.length + 80);
      this.zombies.push(new Zombie(sx, this.level));
    }
    this.spawned++;
  },

  // ---------- update ----------
  update(dt) {
    this.time += dt;
    this.dtScale = Math.min(3, dt / 16.6667);

    this.player.update(dt, this);

    // spawnen "wapenen" zodra de speler begint te lopen (rustige start, ook op boss-level)
    if (!this.spawnArmed && (this.player.x > 76 || Input.state.left || Input.state.right)) this.spawnArmed = true;
    this.updateSpawns(dt);

    for (const z of this.zombies) z.update(dt, this);
    // door de baas opgeroepen zombies veilig na de lus toevoegen
    if (this.pendingZombies.length) { this.zombies.push(...this.pendingZombies); this.pendingZombies.length = 0; }
    for (const b of this.bullets) b.update(dt, this);
    for (const p of this.particles) p.update(dt, this);
    for (const c of this.coinFx) { c.y += c.vy * this.dtScale; c.life -= dt; }
    for (const a of this.ammoFx) { a.y += a.vy * this.dtScale; a.life -= dt; }
    for (const d of this.ammoDrops) d.update(dt, this);
    for (const h of this.healthDrops) h.update(dt, this);
    for (const pu of this.powerUps) pu.update(dt, this);

    // spikes/gaten: schade als je er op de grond op staat
    if (this.player.onGround && this.time - this.lastHazard > 500) {
      for (const o of this.obstacles) {
        if (o.type === 'hazard' && Math.abs(this.player.x - o.x) < o.w / 2 + 4) {
          this.player.takeDamage(12);
          this.knockPlayer(this.player.x < o.x ? -1 : 1, 6);
          this.lastHazard = this.time;
          break;
        }
      }
    }

    // schermschud aftellen
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.04);

    // opruimen (de baas wordt nooit weggecullt)
    this.zombies = this.zombies.filter((z) => z.alive && (z === this.boss || z.x > this.cam.x - 60));
    this.bullets = this.bullets.filter((b) => b.alive);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.coinFx = this.coinFx.filter((c) => c.life > 0);
    this.ammoFx = this.ammoFx.filter((a) => a.life > 0);
    this.ammoDrops = this.ammoDrops.filter((d) => !d.dead);
    this.healthDrops = this.healthDrops.filter((h) => !h.dead);
    this.powerUps = this.powerUps.filter((pu) => !pu.dead);

    // munt-animatie frame
    this.coinAnimTimer += dt;
    if (this.coinAnimTimer > 120) { this.coinAnimTimer = 0; this.coinAnimFrame++; }

    // horde-timer (alleen actief zodra je begint te lopen)
    if (this.level.mode === 'horde' && this.spawnArmed) this.hordeLeft = Math.max(0, this.hordeLeft - dt);

    // camera
    let target = this.player.x - CONFIG.VIEW_W * 0.35;
    this.cam.x = Math.max(0, Math.min(this.level.length - CONFIG.VIEW_W + 60, target));

    // win / verlies
    if (this.player.hp <= 0) {
      this.lose();
    } else if (this.level.isBoss) {
      if (this.boss && !this.boss.alive) this.win();      // baas verslagen
    } else if (this.level.mode === 'horde') {
      if (this.hordeLeft <= 0 && this.spawnArmed) this.win(); // horde overleefd
    } else if (this.player.x >= this.level.length) {
      this.win();                                          // finish gehaald
    }

    UI.updateHUD(this);
  },

  win() {
    if (this.state !== 'playing') return;
    this.state = 'win';
    Storage.clearLevel(this.worldId, this.level.id);
    Storage.setAmmo(this.ammo);                  // kogel-eindstand blijft behouden
    const total = this.runCoins + this.level.reward;
    Storage.addCoins(total);
    UI.showWin({ kills: this.runKills, coins: total });
  },
  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lose';
    // GEEN munten en GEEN kogel-verlies bij een mislukte poging
    // (voorraad blijft zoals aan het begin van dit level)
    UI.showLose({ kills: this.runKills, coins: this.runCoins });
  },

  // ---------- render ----------
  render() {
    const ctx = this.ctx;
    const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;

    const theme = this.theme || THEMES.city;

    // lucht (thema-kleuren)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(0.6, theme.sky[1]);
    sky.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // schermschud-offset (bij explosies)
    const shx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const shy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    // sterren (statisch t.o.v. lucht)
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % W, sy = (i * 53) % 120;
      Sprites.px(ctx, i % 5 ? '#3a4660' : '#aeb8d0', sx, sy, 1, 1);
    }
    // maan met gloed
    ctx.globalAlpha = 0.18; Sprites.px(ctx, '#e8e2c8', W - 76, 24, 34, 34); ctx.globalAlpha = 1;
    Sprites.px(ctx, '#e8e2c8', W - 70, 30, 22, 22);
    Sprites.px(ctx, '#1a2438', W - 64, 26, 10, 22);

    if (!this.level) return;

    // ---- verre gebouwen (sterke parallax) ----
    const camFar = this.cam.x * 0.35;
    for (const b of this.backdrop.far) {
      const sx = b.x - camFar;
      if (sx + b.w < 0 || sx > W) continue;
      Sprites.px(ctx, b.c, sx, CONFIG.GROUND_Y - b.h, b.w, b.h);
    }
    // mist-strook tussen lagen
    ctx.globalAlpha = 0.25;
    Sprites.px(ctx, '#2a3346', 0, CONFIG.GROUND_Y - 40, W, 40);
    ctx.globalAlpha = 1;

    // ---- nabije gebouwen (lichte parallax) met ramen + deuren ----
    const camNear = this.cam.x * 0.82;
    for (const b of this.backdrop.near) {
      const sx = b.x - camNear;
      if (sx + b.w < -10 || sx > W + 10) continue;
      const top = CONFIG.GROUND_Y - b.h;
      Sprites.px(ctx, b.c, sx, top, b.w, b.h);
      Sprites.px(ctx, '#1f2738', sx, top, b.w, 3);            // dak-rand
      Sprites.px(ctx, '#00000033', sx, top, 3, b.h);          // schaduw links
      // ramen (deterministisch, geen geflikker)
      // patroon op VASTE wereldpositie (kolom/rij), niet op schermpositie -> geen geflikker
      let col = 0;
      for (let wx = sx + 7; wx < sx + b.w - 9; wx += 13) {
        let row = 0;
        for (let wy = top + 8; wy < CONFIG.GROUND_Y - 26; wy += 13) {
          const lit = b.lit && (((Math.round(b.x) * 17 + col * 31 + row * 7) % 100) < 22);
          Sprites.px(ctx, lit ? '#f2c94c' : '#10141d', wx, wy, 6, 7);
          if (lit) Sprites.px(ctx, '#fff4c8', wx, wy, 6, 2);
          row++;
        }
        col++;
      }
      // deur
      if (b.hasDoor) {
        const dx = b.doorX - camNear;
        const open = this.time < b.openUntil;
        Sprites.px(ctx, '#1a120c', dx, CONFIG.GROUND_Y - 26, 20, 26);   // kozijn
        Sprites.px(ctx, open ? '#05070a' : '#3a2a1c', dx + 2, CONFIG.GROUND_Y - 24, 16, 24); // deurblad
        if (!open) Sprites.px(ctx, '#caa84a', dx + 14, CONFIG.GROUND_Y - 12, 2, 2); // klink
        if (open) { ctx.globalAlpha = 0.5; Sprites.px(ctx, '#caa84a', dx + 2, CONFIG.GROUND_Y - 24, 16, 24); ctx.globalAlpha = 1; }
      }
    }

    // grond (wereld-ruimte)
    ctx.save();
    ctx.translate(-this.cam.x, 0);

    // stoep + straat (thema-kleuren)
    Sprites.px(ctx, theme.groundTop, this.cam.x, CONFIG.GROUND_Y, W, 6);    // stoeprand
    Sprites.px(ctx, theme.ground, this.cam.x, CONFIG.GROUND_Y + 6, W, H);   // ondergrond
    Sprites.px(ctx, theme.lamp, this.cam.x, CONFIG.GROUND_Y, W, 1);         // lichte rand
    ctx.globalAlpha = 0.25;
    Sprites.px(ctx, theme.lamp, this.cam.x, CONFIG.GROUND_Y + 1, W, 1);
    ctx.globalAlpha = 1;
    for (let gx = Math.floor(this.cam.x / 30) * 30; gx < this.cam.x + W; gx += 30) {
      Sprites.px(ctx, theme.groundTop, gx, CONFIG.GROUND_Y + 16, 14, 2);    // strepen/tegels
      Sprites.px(ctx, '#00000033', gx + 7, CONFIG.GROUND_Y + 26, 2, 2);     // gruis
    }

    // straatlantaarns + lichtpoel
    for (const lp of this.backdrop.lamps) {
      if (lp.x < this.cam.x - 20 || lp.x > this.cam.x + W + 20) continue;
      Sprites.px(ctx, '#2a2e36', lp.x, CONFIG.GROUND_Y - 54, 3, 54);        // paal
      Sprites.px(ctx, '#2a2e36', lp.x - 6, CONFIG.GROUND_Y - 54, 14, 3);    // arm
      Sprites.px(ctx, theme.lamp, lp.x - 7, CONFIG.GROUND_Y - 52, 5, 4);    // lamp
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = theme.lamp;
      ctx.beginPath();
      ctx.moveTo(lp.x - 5, CONFIG.GROUND_Y - 50);
      ctx.lineTo(lp.x - 26, CONFIG.GROUND_Y + 6);
      ctx.lineTo(lp.x + 22, CONFIG.GROUND_Y + 6);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // finish — stok met wapperende vlag (laatste level = doodskop-variant)
    const fx = this.level.length;
    const isLast = this.level.id === WORLDS.find((w) => w.id === this.worldId).levels.length;
    Sprites.drawFlag(ctx, fx, CONFIG.GROUND_Y, this.time, isLast);

    // partikels (achter entiteiten)
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      Sprites.px(ctx, p.color, p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // obstakels (auto's, lage balken, spikes, vaten)
    for (const o of this.obstacles) {
      if (o.x < this.cam.x - 40 || o.x > this.cam.x + CONFIG.VIEW_W + 40) continue;
      Sprites.drawObstacle(ctx, o, CONFIG.GROUND_Y);
    }

    // dode zombies blijven liggen (op de grond, achter alles)
    for (const cp of this.corpses) {
      Sprites.drawCorpse(ctx, cp.x, CONFIG.GROUND_Y, cp.dir, cp);
    }

    // munitie-pickups op de grond (knipperen als ze bijna weg zijn)
    for (const d of this.ammoDrops) {
      if (d.life < 3000 && Math.floor(d.life / 150) % 2 === 0) continue;
      if (d.onGround) Sprites.shadow(ctx, d.x, CONFIG.GROUND_Y, 6);
      Sprites.drawAmmoBox(ctx, d.x, d.y, d.bob);
    }
    // EHBO-doosjes
    for (const h of this.healthDrops) {
      if (h.life < 3000 && Math.floor(h.life / 150) % 2 === 0) continue;
      if (h.onGround) Sprites.shadow(ctx, h.x, CONFIG.GROUND_Y, 6);
      Sprites.drawHealthBox(ctx, h.x, h.y, h.bob);
    }
    // power-ups
    for (const pu of this.powerUps) {
      if (pu.life < 3000 && Math.floor(pu.life / 150) % 2 === 0) continue;
      if (pu.onGround) Sprites.shadow(ctx, pu.x, CONFIG.GROUND_Y, 6);
      Sprites.drawPowerUp(ctx, pu.x, pu.y, pu.kind, pu.bob);
    }

    // zombies (op x gesorteerd zodat dichterbij vóór komt)
    const sorted = this.zombies.slice().sort((a, b) => a.x - b.x);
    for (const z of sorted) {
      let alpha = 1;
      if (z.emerging > 0) alpha = Math.min(1, 1 - z.emerging / 350 + 0.2);
      if (z.onGround && z.emerging <= 0) Sprites.shadow(ctx, z.x, CONFIG.GROUND_Y, 8 * z.scale);
      ctx.globalAlpha = alpha;
      if (z.hitFlash > 0) ctx.globalAlpha = alpha * 0.55;
      Sprites.drawZombie(ctx, z.x, z.y, z.dir, z);
      ctx.globalAlpha = 1;
      // hp-balkje boven de kop (niet voor de baas — die heeft de grote balk)
      if (z.hp < z.maxHp && z.emerging <= 0 && z.type.id !== 'boss') {
        const bw = 16 * z.scale;
        const by = z.cy - z.halfH - 6;
        Sprites.px(ctx, '#000', z.x - bw / 2 - 1, by - 1, bw + 2, 4);
        const col = z.type.id === 'brute' ? '#d98a30' : '#6abe30';
        Sprites.px(ctx, col, z.x - bw / 2, by, bw * (z.hp / z.maxHp), 2);
      }
    }

    // kogels
    for (const b of this.bullets) Sprites.drawBullet(ctx, b.x, b.y);

    // speler (Ryan)
    if (this.player.onGround) Sprites.shadow(ctx, this.player.x, CONFIG.GROUND_Y, 7);
    const swingingBat = this.time < (this.player.swingUntil || 0) && this.player.swingWeapon;
    Sprites.drawCharacter(ctx, this.player.x, this.player.y, this.player.dir, this.player.pal, {
      walkPhase: this.player.walkPhase,
      airborne: !this.player.onGround,
      ducking: this.player.ducking,
      attacking: this.time < this.player.attackAnimUntil,
      weapon: swingingBat ? this.player.swingWeapon : this.player.weaponId,
    });

    // zwevende munten
    for (const c of this.coinFx) {
      ctx.globalAlpha = Math.max(0, c.life / 700);
      Sprites.drawCoin(ctx, c.x, c.y, this.coinAnimFrame);
    }
    ctx.globalAlpha = 1;

    // zwevende "+kogels" / "+HP"
    ctx.font = '7px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (const a of this.ammoFx) {
      ctx.globalAlpha = Math.max(0, a.life / 800);
      if (a.hp) { ctx.fillStyle = '#ff6b6b'; ctx.fillText('+' + a.hp + 'hp', a.x + 10, a.y); }
      else if (a.n > 0) { ctx.fillStyle = '#ffe9a0'; ctx.fillText('+' + a.n, a.x + 10, a.y); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.restore();   // wereld (camera)
    ctx.restore();   // schermschud

    // BOSS-HP-balk bovenin (scherm-ruimte)
    if (this.level.isBoss && this.boss && this.boss.alive) {
      const bw = W * 0.66, bx = (W - bw) / 2, by = 30;
      ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, by - 2, bw + 4, 9);
      ctx.fillStyle = '#3a0d0d'; ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = '#d94343'; ctx.fillRect(bx, by, bw * Math.max(0, this.boss.hp / this.boss.maxHp), 5);
      ctx.fillStyle = '#ff8a8a'; ctx.font = 'bold 8px "Courier New", monospace';
      ctx.textAlign = 'center'; ctx.fillText('☠ MEGA ZOMBIE ☠', W / 2, by - 4);
      ctx.textAlign = 'left';
    }

    // horde-timer
    if (this.level.mode === 'horde') {
      const sec = Math.ceil(this.hordeLeft / 1000);
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText('OVERLEEF  ' + sec + 's', W / 2 + 1, 49);
      ctx.fillStyle = sec <= 5 ? '#ff5a5a' : '#f2c94c';
      ctx.fillText('OVERLEEF  ' + sec + 's', W / 2, 48);
      ctx.textAlign = 'left';
    }

    // melee-only hint
    if (this.level.mode === 'melee') {
      ctx.font = 'bold 8px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8a8a'; ctx.fillText('⚠ WAPENS GEBLOKKEERD — ALLEEN MELEE', W / 2, 48);
      ctx.textAlign = 'left';
    }

    // actieve power-ups (icoontjes met aflopende balk), midden-onder
    const active = [];
    for (const k of POWERUP_LIST) {
      const end = this.player.buffs[k] || 0;
      if (end > this.time) active.push({ k, left: end - this.time });
    }
    if (active.length) {
      const iw = 30, totalW = active.length * iw, startX = (W - totalW) / 2;
      active.forEach((a, i) => {
        const pu = POWERUPS[a.k];
        const ix = startX + i * iw, iy = H - 16;
        ctx.fillStyle = '#000'; ctx.fillRect(ix, iy, 26, 11);
        ctx.fillStyle = pu.color; ctx.fillRect(ix, iy, 26 * Math.min(1, a.left / pu.dur), 11);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 7px "Courier New", monospace';
        ctx.textAlign = 'center'; ctx.fillText(pu.name, ix + 13, iy + 8);
        ctx.textAlign = 'left';
      });
    }

    // pauze-overlay
    if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GEPAUZEERD', W / 2, H / 2);
      ctx.font = '11px "Courier New", monospace';
      ctx.fillText('druk op II om door te gaan', W / 2, H / 2 + 20);
      ctx.textAlign = 'left';
    }
  },

  // ---------- hoofdloop ----------
  loop(ts) {
    let dt = ts - this.lastTs;
    this.lastTs = ts;
    if (!dt || dt > 100) dt = 16.6667; // bij tab-wissel niet wegspringen

    if (this.state === 'playing') this.update(dt);
    if (['playing', 'paused'].includes(this.state)) this.render();

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },
};
