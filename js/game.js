/* ============================================================
   GAME — loop, level-logica, rendering.
   ============================================================ */

const Game = {
  canvas: null, ctx: null,
  state: 'menu',          // menu | playing | paused | win | lose
  worldId: 1, level: null,
  player: null, zombies: [], bullets: [], particles: [], coinFx: [], ammoFx: [], ammoDrops: [], healthDrops: [], corpses: [], pendingZombies: [],
  obstacles: [], powerUps: [], enemyShots: [], platforms: [], rocketShots: [], rockets: 0,
  boss: null, shake: 0, hordeLeft: 0, lastHazard: -9999, bossAmmoTimer: 0,
  round: 1, roundTarget: 0, roundKills: 0, roundSpawned: 0, roundBreak: 0,
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
    UI.viewWorld = worldId; // level-select toont daarna deze wereld

    this.player = new Player(Storage.data.equippedMelee, Storage.data.equippedRanged, Storage.data.equippedCharacter);
    // dubbel-jump vanaf wereld 2
    this.player.maxJumps = worldId >= DOUBLE_JUMP_FROM_WORLD ? 2 : 1;
    this.player.jumps = this.player.maxJumps;
    this.zombies = []; this.bullets = []; this.particles = []; this.coinFx = []; this.ammoFx = []; this.ammoDrops = []; this.healthDrops = []; this.corpses = []; this.pendingZombies = [];
    this.powerUps = []; this.enemyShots = []; this.platforms = []; this.rocketShots = [];
    this.boss = null; this.shake = 0; this.lastHazard = -9999; this.bossAmmoTimer = 0;
    this.cam.x = 0;
    this.spawnTimer = 0; this.spawned = 0; this.spawnArmed = false;
    this.runCoins = 0; this.runKills = 0;
    this.ammo = Storage.data.ammo;   // blijvende voorraad uit vorige levels
    this.rockets = Storage.data.rockets;
    this.time = 0;
    this.theme = THEMES[level.theme] || THEMES.city;
    this.hordeLeft = level.mode === 'horde' ? level.hordeTime : 0;
    this.midLeft = level.midTime || 0;   // tijd om de checkpoint-vlag te halen
    this.midReached = false;
    this.loseReason = 'dead';             // 'dead' | 'time'

    this.buildBackdrop(level);
    this.buildObstacles(level);
    this.buildPlatforms(level);
    this.buildTutorials();

    // parkour: zet de speler op het startplatform
    if (level.parkour && this.platforms.length) {
      const p0 = this.platforms[0];
      this.player.x = p0.x; this.player.y = p0.y; this.player.onGround = true;
    }

    // boss-level: plaats de eindbaas
    if (level.isBoss) {
      let boss;
      if (level.balloonBoss) {
        boss = new Zombie(this.player.x + 160, level, ZOMBIE_TYPES.balloon);
        boss.maxHp = BALLOON_HP; boss.hp = BALLOON_HP; boss.y = 80;
      } else {
        boss = new Zombie(this.player.x + 240, level, ZOMBIE_TYPES.boss);
        boss.maxHp = BOSS_HP; boss.hp = BOSS_HP;
      }
      this.boss = boss;
      this.zombies.push(boss);
    }

    this.state = 'playing';
    Input.clear();
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    UI.show('game');
  },

  // ---------- ZOMBIE KNOCK-OUT (arena) ----------
  startArena() {
    Storage.useArenaPlay();
    this.worldId = 0;
    this.level = ARENA_LEVEL;
    UI.viewWorld = 1;
    this.player = new Player(Storage.data.equippedMelee, Storage.data.equippedRanged, Storage.data.equippedCharacter);
    this.player.maxJumps = 1; this.player.jumps = 1;
    this.player.x = ARENA_LEVEL.length / 2; // midden van de arena
    this.zombies = []; this.bullets = []; this.particles = []; this.coinFx = []; this.ammoFx = []; this.ammoDrops = []; this.healthDrops = []; this.corpses = []; this.pendingZombies = [];
    this.powerUps = []; this.enemyShots = []; this.platforms = []; this.obstacles = []; this.rocketShots = [];
    this.boss = null; this.shake = 0; this.bossAmmoTimer = 0;
    this.cam.x = 0; this.spawnTimer = 0; this.spawned = 0; this.spawnArmed = true;
    this.runCoins = 0; this.runKills = 0;
    this.ammo = ARENA_START_AMMO;
    this.rockets = Storage.data.rockets;
    this.time = 0;
    this.theme = THEMES.arena;
    this.tutorials = []; this.tutorialMsg = ''; this.tutorialUntil = 0;
    this.buildBackdrop(ARENA_LEVEL);
    this.beginRound(1);
    this.state = 'playing';
    Input.clear();
    const ps = document.getElementById('pause-screen'); if (ps) ps.classList.add('hidden');
    UI.show('game');
  },

  beginRound(round) {
    this.round = round;
    const r = arenaRound(round);
    this.roundCfg = r;
    // pas de "level"-spawnparameters aan voor deze ronde
    this.level.zombieHp = r.zombieHp;
    this.level.zombieSpeed = r.zombieSpeed;
    this.level.runnerChance = r.runnerChance;
    this.level.crawlerChance = r.crawlerChance;
    this.level.bruteChance = r.bruteChance;
    this.level.maxAlive = r.maxAlive;
    this.level.spawnEvery = r.spawnEvery;
    this.roundTarget = r.target;
    this.roundKills = 0;
    this.roundSpawned = 0;
    this.roundBreak = 0;
    this.spawnTimer = 0;
  },

  nextLevel() {
    const world = WORLDS.find((w) => w.id === this.worldId);
    const next = this.level.id + 1;
    if (next <= world.levels.length) this.startLevel(this.worldId, next);
    else { UI.renderLevels(); UI.show('level'); }
  },
  retryLevel() { this.startLevel(this.worldId, this.level.id); },

  togglePause() {
    const pauseScreen = document.getElementById('pause-screen');
    if (this.state === 'playing') {
      this.state = 'paused'; Input.clear();
      if (pauseScreen) pauseScreen.classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      if (pauseScreen) pauseScreen.classList.add('hidden');
    }
  },

  // level verlaten -> terug naar het hoofdmenu (geen beloning, run telt niet)
  quitToMenu() {
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    this.state = 'menu';
    Input.clear();
    UI.show('menu');
  },

  // achtergrond vooraf bepalen (anders flikkeren ze). Twee lagen + deuren + lantaarns.
  buildBackdrop(level) {
    let seed = level.id * 9301 + 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const theme = THEMES[level.theme] || THEMES.city;

    // arena: geen gebouwen (eigen scene wordt in render getekend)
    if (theme.isArena) { this.backdrop = { arena: true, far: [], near: [], doors: [], lamps: [] }; return; }

    // berg-thema: driehoekige toppen i.p.v. gebouwen
    if (theme.mountains) {
      const far = [], near = [];
      let mx = -80;
      while (mx < level.length + 300) {
        const w = 120 + Math.floor(rnd() * 120), h = 90 + Math.floor(rnd() * 80);
        far.push({ x: mx, w, h, c: theme.far[Math.floor(rnd() * theme.far.length)] });
        mx += w * 0.6;
      }
      mx = -60;
      while (mx < level.length + 200) {
        const w = 90 + Math.floor(rnd() * 90), h = 70 + Math.floor(rnd() * 90);
        near.push({ x: mx, w, h, c: theme.near[Math.floor(rnd() * theme.near.length)], snow: rnd() > 0.5 });
        mx += w * 0.55;
      }
      this.backdrop = { mountains: true, far, near, doors: [], lamps: [] };
      return;
    }

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
    if (level.parkour) return;   // geen obstakels in de bergen (alleen platforms)
    // tutorial-level: vaste, goed gespreide layout (auto -> hek -> vat)
    if (this.worldId === 1 && level.id === 1) {
      this.obstacles = [
        { type: 'car', x: 360, w: 30, h: 22, color: '#7a3030' },
        { type: 'lowbar', x: 640, w: 22, h: 12 },
        { type: 'barrel', x: 920, w: 12, hp: 1, dead: false },
        { type: 'car', x: 1180, w: 30, h: 22, color: '#30507a' },
      ];
      return;
    }
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

  // zwevende parkour-platforms genereren (wereld 2). Gaten = ravijn (val = dood).
  buildPlatforms(level) {
    this.platforms = [];
    if (!level.parkour) return;
    let seed = level.id * 7321 + 17;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    let y = CONFIG.GROUND_Y - 34;
    // breed, veilig startplatform
    this.platforms.push({ x: 44, y: y, w: 78 });
    let x = 44 + 39;
    while (x < level.length - 70) {
      const gap = level.gapMin + rnd() * (level.gapMax - level.gapMin);
      const w = Math.max(34, level.platMin + rnd() * (level.platMax - level.platMin));
      x += gap + w / 2;
      // hoogteverschil: omhoog beperkt (altijd haalbaar met dubbel-jump), omlaag mag vrij
      let dy = (rnd() - 0.5) * 2 * level.yJump;
      if (dy < 0) dy = Math.max(dy, -18);
      y += dy;
      y = Math.max(80, Math.min(CONFIG.GROUND_Y - 8, y));
      this.platforms.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w) });
      x += w / 2;
    }
    // breed eindplatform bij de finish
    this.platforms.push({ x: level.length, y: Math.max(92, Math.min(CONFIG.GROUND_Y - 12, y)), w: 86 });
  },

  // bergtop (driehoek) tekenen
  drawPeak(ctx, sx, w, h, color, snow) {
    const baseY = CONFIG.GROUND_Y, topY = baseY - h, cx = sx + w / 2;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(cx, topY); ctx.lineTo(sx + w, baseY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(sx + w, baseY); ctx.lineTo(cx, baseY); ctx.closePath(); ctx.fill();
    if (snow) {
      ctx.fillStyle = '#e8eef4';
      ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx - w * 0.13, topY + h * 0.2); ctx.lineTo(cx + w * 0.13, topY + h * 0.2); ctx.closePath(); ctx.fill();
    }
  },

  // tutorial-triggers voor het allereerste level van elke wereld
  buildTutorials() {
    this.tutorials = [];
    this.tutorialMsg = '';
    this.tutorialUntil = 0;
    if (this.worldId === 1 && this.level.id === 1) {
      this.tutorials.push({ x: 90, text: 'Versla ALLE zombies! Sla met de melee-knop 🏏 of schiet 🔫', shown: false });
      const car = this.obstacles.find((o) => o.type === 'car');
      if (car) this.tutorials.push({ x: car.x - 90, text: 'Een auto! Spring eroverheen ⤒ (je kunt op het dak staan)', shown: false });
      const bar = this.obstacles.find((o) => o.type === 'lowbar');
      if (bar) this.tutorials.push({ x: bar.x - 90, text: 'Een hek! Bukken ⤓ om eronderdoor te gaan', shown: false });
      const barrel = this.obstacles.find((o) => o.type === 'barrel');
      if (barrel) this.tutorials.push({ x: barrel.x - 80, text: 'Explosief vat! Schiet of sla het kapot 💥', shown: false });
    } else if (this.worldId === 2 && this.level.id === 1) {
      this.tutorials.push({ x: 70, text: 'DUBBEL-JUMP! Druk 2× op springen in de lucht ⤒⤒', shown: false });
      this.tutorials.push({ x: 240, text: 'Houd springen vast = hoger/verder. Val niet in het ravijn!', shown: false });
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
  // kogel ketst af op het baas-pantser (geen schade)
  spawnArmorSpark(x, y) {
    for (let i = 0; i < 5; i++)
      this.particles.push(new Particle(x, y, (Math.random() - 0.7) * 3, (Math.random() - 0.5) * 2.5, Math.random() < 0.5 ? '#cfd6df' : '#9aa3ad', 220, 2));
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

  // explosie (raketten): AoE-schade aan zombies, geen zelfschade
  explodeAt(x, y, dmg) {
    for (const z of this.zombies) {
      if (z.alive && Math.abs(z.x - x) < ROCKET_AOE && Math.abs(z.cy - y) < ROCKET_AOE + 12) {
        z.takeDamage(dmg, Math.sign(z.x - x) || 1, this, 14);
      }
    }
    for (const o of this.obstacles) { if (o.type === 'barrel' && !o.dead && Math.abs(o.x - x) < ROCKET_AOE) this.explodeBarrel(o); }
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 5;
      const col = Math.random() < 0.5 ? '#ff8a3a' : (Math.random() < 0.5 ? '#ffd24a' : '#888');
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 1, col, 460, 3));
    }
    this.shake = Math.max(this.shake, 10);
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
    if (this.level.arena) reward = Math.ceil(reward * ARENA_COIN_MULT); // minder munten in de arena
    this.runCoins += reward;
    this.runKills += 1;
    if (this.level.arena) this.roundKills += 1;
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
    // heel zeldzaam een raket — alleen als je de Rocket Launcher bezit
    if (Storage.ownsWeapon('rocket') && Math.random() < ROCKET_DROP_CHANCE) this.ammoDrops.push(new RocketPickup(z.x));
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
    // ----- ARENA: spawnt van beide kanten, per ronde een vast aantal -----
    if (this.level.arena) {
      if (this.roundBreak > 0) return;                 // pauze tussen rondes
      if (this.roundSpawned >= this.roundTarget) return; // alles van deze ronde is al gespawnd
      const alive = this.zombies.reduce((n, z) => n + (z.alive ? 1 : 0), 0);
      if (alive >= this.level.maxAlive) return;
      this.spawnTimer += dt;
      if (this.spawnTimer < this.level.spawnEvery) return;
      this.spawnTimer = 0;
      // van links of rechts, net buiten beeld
      const fromLeft = Math.random() < 0.5;
      const sx = fromLeft ? (this.cam.x - 16) : (this.cam.x + CONFIG.VIEW_W + 16);
      const z = new Zombie(Math.max(20, Math.min(this.level.length + 20, sx)), this.level);
      this.zombies.push(z);
      this.roundSpawned++;
      return;
    }

    if (this.level.mode === 'boss') return;         // de baas regelt zijn eigen adds
    if (!this.spawnArmed) { this.spawnTimer = 0; return; }

    // kill-all-levels: spawn een vast totaal (zombieCount), daarna niets meer
    if (this.level.killAll && this.spawned >= this.level.zombieCount) return;

    // begrensd door hoeveel er tegelijk levend mogen zijn
    const aliveCount = this.zombies.reduce((n, z) => n + (z.alive ? 1 : 0), 0);
    if (aliveCount >= (this.level.maxAlive || 12)) { return; }

    this.spawnTimer += dt;
    // in horde-modus iets sneller spawnen voor de druk
    const interval = this.level.mode === 'horde' ? this.level.spawnEvery * 0.7 : this.level.spawnEvery;
    if (this.spawnTimer < interval) return;
    this.spawnTimer = 0;

    // parkour-levels: alleen vliegende zombie-vogels (uit de lucht, rechts)
    if (this.level.flyerOnly) {
      const z = new Zombie(this.cam.x + CONFIG.VIEW_W + 20, this.level, ZOMBIE_TYPES.flyer);
      z.y = 64 + Math.random() * 64;
      this.zombies.push(z);
      this.spawned++;
      return;
    }

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

    // tutorial-popups (eerste levels): toon tekst als je een trigger-punt bereikt
    if (this.tutorials) {
      for (const tut of this.tutorials) {
        if (!tut.shown && this.player.x >= tut.x) { tut.shown = true; this.tutorialMsg = tut.text; this.tutorialUntil = this.time + 5000; }
      }
    }

    // "wapenen" zodra de speler iets doet: lopen, schieten, slaan of springen
    if (!this.spawnArmed && (this.player.x > 76 || Input.state.left || Input.state.right ||
        Input.state.attack || Input.state.melee || Input.jumpPressed)) this.spawnArmed = true;
    this.updateSpawns(dt);

    // in de boss fight valt er regelmatig munitie uit de lucht boven de speler
    if (this.level.isBoss && this.spawnArmed && this.boss && this.boss.alive) {
      this.bossAmmoTimer += dt;
      if (this.bossAmmoTimer >= 3800) {
        this.bossAmmoTimer = 0;
        const drop = new AmmoPickup(this.player.x + (Math.random() - 0.5) * 30, 30);
        drop.y = 6; drop.vy = 0; drop.vx = 0; drop.onGround = false; // valt recht naar beneden
        this.ammoDrops.push(drop);
      }
    }

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
    for (const es of this.enemyShots) es.update(dt, this);
    for (const rk of this.rocketShots) rk.update(dt, this);

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
    // in kill-all/arena blijven levende zombies bestaan (ze achtervolgen je), anders cull links buiten beeld
    this.zombies = this.zombies.filter((z) => z.alive && (z === this.boss || this.level.killAll || this.level.arena || z.x > this.cam.x - 60));
    this.bullets = this.bullets.filter((b) => b.alive);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.coinFx = this.coinFx.filter((c) => c.life > 0);
    this.ammoFx = this.ammoFx.filter((a) => a.life > 0);
    this.ammoDrops = this.ammoDrops.filter((d) => !d.dead);
    this.healthDrops = this.healthDrops.filter((h) => !h.dead);
    this.powerUps = this.powerUps.filter((pu) => !pu.dead);
    this.enemyShots = this.enemyShots.filter((es) => es.alive);
    this.rocketShots = this.rocketShots.filter((rk) => rk.alive);

    // munt-animatie frame
    this.coinAnimTimer += dt;
    if (this.coinAnimTimer > 120) { this.coinAnimTimer = 0; this.coinAnimFrame++; }

    // horde-timer (alleen actief zodra je begint te lopen)
    if (this.level.mode === 'horde' && this.spawnArmed) this.hordeLeft = Math.max(0, this.hordeLeft - dt);

    // checkpoint-vlag halverwege: haal 'm binnen de tijd
    if (this.level.midTime && !this.midReached) {
      if (this.player.x >= this.level.length * 0.5) {
        this.midReached = true;
      } else if (this.spawnArmed) {
        this.midLeft = Math.max(0, this.midLeft - dt);
        if (this.midLeft <= 0 && this.state === 'playing') { this.loseReason = 'time'; this.player.hp = 0; }
      }
    }

    // camera
    let target = this.player.x - CONFIG.VIEW_W * 0.35;
    this.cam.x = Math.max(0, Math.min(this.level.length - CONFIG.VIEW_W + 60, target));

    // in het ravijn gevallen = direct dood (parkour)
    if (this.level.parkour && this.player.y > FALL_DEATH_Y && this.state === 'playing') {
      this.player.hp = 0;
    }

    // ----- ARENA: rondes + game over -----
    if (this.level.arena) {
      if (this.player.hp <= 0) { this.arenaOver(); }
      else if (this.roundBreak > 0) {
        this.roundBreak -= dt;
        if (this.roundBreak <= 0) this.beginRound(this.round + 1);
      } else if (this.roundSpawned >= this.roundTarget && this.roundKills >= this.roundTarget) {
        // ronde voltooid: bonus + korte pauze
        this.runCoins += this.roundCfg.bonus;
        this.coinFx.push({ x: this.player.x, y: this.player.y - 30, vy: -0.8, life: 900 });
        this.roundBreak = 2400;
      }
      UI.updateHUD(this);
      return;
    }

    // win / verlies
    if (this.player.hp <= 0) {
      this.lose();
    } else if (this.level.isBoss) {
      if (this.boss && !this.boss.alive) this.win();      // baas verslagen
    } else if (this.level.mode === 'horde') {
      if (this.hordeLeft <= 0 && this.spawnArmed) this.win(); // horde overleefd
    } else if (this.player.x >= this.level.length) {
      // kill-all: pas finishen als alle zombies dood zijn
      if (!this.level.killAll || this.zombiesRemaining() <= 0) this.win();
    }

    UI.updateHUD(this);
  },

  win() {
    if (this.state !== 'playing') return;
    this.state = 'win';
    Storage.clearLevel(this.worldId, this.level.id);
    Storage.setAmmo(this.ammo);                  // kogel-eindstand blijft behouden
    Storage.setRockets(this.rockets);            // raket-eindstand blijft behouden
    const total = this.runCoins + this.level.reward;
    Storage.addCoins(total);
    UI.showWin({ kills: this.runKills, coins: total });
  },
  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lose';
    // GEEN munten en GEEN kogel-verlies bij een mislukte poging
    // (voorraad blijft zoals aan het begin van dit level)
    UI.showLose({ kills: this.runKills, coins: this.runCoins, reason: this.loseReason });
  },

  // aantal nog te doden zombies (kill-all-levels)
  zombiesRemaining() { return Math.max(0, this.level.zombieCount - this.runKills); },

  // arena voorbij: munten behoud je, highscore bijwerken
  arenaOver() {
    if (this.state !== 'playing') return;
    this.state = 'lose';
    Storage.addCoins(this.runCoins);
    const record = Storage.setArenaBest(this.round);
    UI.showArenaOver({ round: this.round, coins: this.runCoins, best: Storage.data.arenaBest, record: record });
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

    if (!theme.mountains) {
      // sterren (statisch t.o.v. lucht)
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % W, sy = (i * 53) % 120;
        Sprites.px(ctx, i % 5 ? '#3a4660' : '#aeb8d0', sx, sy, 1, 1);
      }
      // maan met gloed
      ctx.globalAlpha = 0.18; Sprites.px(ctx, '#e8e2c8', W - 76, 24, 34, 34); ctx.globalAlpha = 1;
      Sprites.px(ctx, '#e8e2c8', W - 70, 30, 22, 22);
      Sprites.px(ctx, '#1a2438', W - 64, 26, 10, 22);
    } else {
      // berg-thema: zon + wolken
      ctx.globalAlpha = 0.2; Sprites.px(ctx, '#fff0c0', W - 72, 22, 32, 32); ctx.globalAlpha = 1;
      Sprites.px(ctx, '#ffe9a0', W - 66, 28, 20, 20);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#cfe0ee';
      for (let i = 0; i < 5; i++) { const cx2 = (i * 140 - this.cam.x * 0.15) % (W + 120) - 60, cy2 = 24 + (i % 3) * 18; ctx.fillRect(cx2, cy2, 34, 7); ctx.fillRect(cx2 + 8, cy2 - 4, 22, 7); }
      ctx.globalAlpha = 1;
    }

    if (!this.level) return;

    // ---- verre laag (sterke parallax) ----
    const camFar = this.cam.x * 0.35;
    for (const b of this.backdrop.far) {
      const sx = b.x - camFar;
      if (sx + b.w < 0 || sx > W) continue;
      if (this.backdrop.mountains) this.drawPeak(ctx, sx, b.w, b.h, b.c, false);
      else Sprites.px(ctx, b.c, sx, CONFIG.GROUND_Y - b.h, b.w, b.h);
    }
    // mist-strook tussen lagen
    ctx.globalAlpha = 0.25;
    Sprites.px(ctx, theme.mountains ? '#9fb6cc' : '#2a3346', 0, CONFIG.GROUND_Y - 40, W, 40);
    ctx.globalAlpha = 1;

    // ---- nabije laag (lichte parallax) ----
    const camNear = this.cam.x * 0.82;
    if (this.backdrop.mountains) {
      for (const b of this.backdrop.near) {
        const sx = b.x - camNear;
        if (sx + b.w < -10 || sx > W + 10) continue;
        this.drawPeak(ctx, sx, b.w, b.h, b.c, b.snow);
      }
    } else
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

    // arena-scene (tribunes + hek + spotlights), in scherm-ruimte
    if (this.backdrop.arena) {
      const gy = CONFIG.GROUND_Y;
      // tribune-publiek (donkere bolletjes in rijen)
      for (let row = 0; row < 3; row++) {
        const ry = gy - 92 + row * 12;
        for (let cx2 = (row * 9) - (this.cam.x * 0.2 % 18); cx2 < W; cx2 += 18) {
          Sprites.px(ctx, row % 2 ? '#1c2030' : '#232838', cx2, ry, 6, 7);
          Sprites.px(ctx, '#3a4258', cx2 + 1, ry, 4, 3);
        }
      }
      // hek/balustrade voor de tribune
      Sprites.px(ctx, '#3a3326', 0, gy - 52, W, 4);
      for (let px = 0; px < W; px += 12) Sprites.px(ctx, '#2a2620', px, gy - 52, 2, 16);
      // spotlights van bovenaf
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffe9a0';
      [W * 0.22, W * 0.5, W * 0.78].forEach((lx) => {
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx - 40, gy); ctx.lineTo(lx + 40, gy); ctx.closePath(); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // grond (wereld-ruimte)
    ctx.save();
    ctx.translate(-this.cam.x, 0);

    if (this.level.parkour) {
      // ravijn: donkere afgrond onderin (val = dood)
      Sprites.px(ctx, '#0c121c', this.cam.x, CONFIG.GROUND_Y - 2, W, H);
      ctx.globalAlpha = 0.6; Sprites.px(ctx, '#05070c', this.cam.x, CONFIG.GROUND_Y + 22, W, H); ctx.globalAlpha = 1;
      // zwevende platforms
      for (const pf of this.platforms) {
        if (pf.x + pf.w / 2 < this.cam.x - 12 || pf.x - pf.w / 2 > this.cam.x + W + 12) continue;
        Sprites.drawPlatform(ctx, pf.x, pf.y, pf.w);
      }
    } else {
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
        Sprites.px(ctx, '#2a2e36', lp.x, CONFIG.GROUND_Y - 54, 3, 54);
        Sprites.px(ctx, '#2a2e36', lp.x - 6, CONFIG.GROUND_Y - 54, 14, 3);
        Sprites.px(ctx, theme.lamp, lp.x - 7, CONFIG.GROUND_Y - 52, 5, 4);
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = theme.lamp;
        ctx.beginPath();
        ctx.moveTo(lp.x - 5, CONFIG.GROUND_Y - 50);
        ctx.lineTo(lp.x - 26, CONFIG.GROUND_Y + 6);
        ctx.lineTo(lp.x + 22, CONFIG.GROUND_Y + 6);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // finish — stok met wapperende vlag (op het eindplatform bij parkour)
    const fx = this.level.length;
    const wWorld = WORLDS.find((w) => w.id === this.worldId);
    const isLast = wWorld && this.level.id === wWorld.levels.length;
    const flagY = (this.level.parkour && this.platforms.length) ? this.platforms[this.platforms.length - 1].y : CONFIG.GROUND_Y;
    if (!this.level.isBoss && !this.level.arena) Sprites.drawFlag(ctx, fx, flagY, this.time, isLast);

    // checkpoint-vlag halverwege
    if (this.level.midTime) Sprites.drawCheckpoint(ctx, Math.round(this.level.length * 0.5), CONFIG.GROUND_Y, this.time, this.midReached);

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
      if (d.isRocket) Sprites.drawRocketPickup(ctx, d.x, d.y, d.bob);
      else Sprites.drawAmmoBox(ctx, d.x, d.y, d.bob);
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
      // zwakke-plek-indicator op de kop van de baas
      if (z.type.id === 'boss' && z.alive && z.emerging <= 0) {
        Sprites.drawWeakpoint(ctx, z.x, z.y + (z.weakTop + z.weakBot) / 2, z.weakHalfW, this.time);
      }
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
    // baas-projectielen (zuur)
    for (const es of this.enemyShots) Sprites.drawEnemyShot(ctx, es.x, es.y, es.spin);
    // raketten
    for (const rk of this.rocketShots) Sprites.drawRocket(ctx, rk.x, rk.y, rk.vx);

    // speler (Ryan) — schaduw op de grond, of op het platform bij parkour
    if (this.player.onGround) Sprites.shadow(ctx, this.player.x, this.level.parkour ? this.player.y + 1 : CONFIG.GROUND_Y, 7);
    const swingingBat = this.time < (this.player.swingUntil || 0) && this.player.swingWeapon;
    Sprites.drawCharacter(ctx, this.player.x, this.player.y, this.player.dir, this.player.pal, {
      walkPhase: this.player.walkPhase,
      airborne: !this.player.onGround,
      ducking: this.player.ducking,
      attacking: this.time < this.player.attackAnimUntil,
      weapon: swingingBat ? this.player.swingWeapon : this.player.weaponId,
      build: this.player.build,
      hair: this.player.hairStyle,
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
      if (a.rocket) { ctx.fillStyle = '#ff8a3a'; ctx.fillText('+1 raket', a.x + 12, a.y); }
      else if (a.hp) { ctx.fillStyle = '#ff6b6b'; ctx.fillText('+' + a.hp + 'hp', a.x + 10, a.y); }
      else if (a.n > 0) { ctx.fillStyle = '#ffe9a0'; ctx.fillText('+' + a.n, a.x + 10, a.y); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    ctx.restore();   // wereld (camera)
    ctx.restore();   // schermschud

    // (objectief/timers/boss-naam staan nu als scherpe DOM-tekst, zie #game-banner)

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

    // (pauze wordt nu als DOM-menu getoond, zie #pause-screen)
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
