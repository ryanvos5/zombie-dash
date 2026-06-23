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
    // al eerder voltooid? dan bij herhaling maar 15 munten (geen farmen)
    this.levelWasCleared = Storage.highestCleared(worldId) >= levelId;

    this.player = new Player(Storage.data.equippedMelee, Storage.data.equippedRanged, Storage.data.equippedCharacter);
    // dubbel-jump vanaf wereld 2
    this.player.maxJumps = worldId >= DOUBLE_JUMP_FROM_WORLD ? 2 : 1;
    this.player.jumps = this.player.maxJumps;
    this.zombies = []; this.bullets = []; this.particles = []; this.coinFx = []; this.ammoFx = []; this.ammoDrops = []; this.healthDrops = []; this.corpses = []; this.pendingZombies = [];
    this.powerUps = []; this.enemyShots = []; this.platforms = []; this.rocketShots = [];
    this.boss = null; this.shake = 0; this.lastHazard = -9999; this.bossAmmoTimer = 0;
    this.cam.x = 0;
    this.spawnTimer = 0; this.spawned = 0; this.spawnArmed = false;
    this.endWaveDone = false; this.killReqBonus = 0;
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
      } else if (level.apeBoss) {
        boss = new Zombie(this.player.x + 220, level, ZOMBIE_TYPES.ape);
        boss.maxHp = APE_HP; boss.hp = APE_HP;
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
  // (de dag-poging is al verbruikt door UI.startArena — account of lokale fallback)
  startArena() {
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
    this.levelWasCleared = false;
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

    // jungle-thema: bomen (stam + kruin) i.p.v. gebouwen, geen deuren/lantaarns
    if (theme.jungle) {
      const far = [], near = [];
      let jx = -40;
      while (jx < level.length + 200) {
        const w = 50 + Math.floor(rnd() * 60), h = 80 + Math.floor(rnd() * 70);
        far.push({ x: jx, w, h, c: theme.far[Math.floor(rnd() * theme.far.length)] });
        jx += w * 0.7;
      }
      jx = -20;
      while (jx < level.length + 120) {
        const h = 86 + Math.floor(rnd() * 70);          // boomhoogte
        const cw = 40 + Math.floor(rnd() * 46);         // kruin-breedte
        near.push({ x: jx, h, cw, c: theme.near[Math.floor(rnd() * theme.near.length)] });
        jx += 46 + Math.floor(rnd() * 70);
      }
      this.backdrop = { jungle: true, far, near, doors: [], lamps: [] };
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
    if (level.parkour || level.noObstacles) return;   // geen obstakels (bergen/jungle)
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
    this.pits = [];
    // Wereld 3 (jungle): zwevende platforms BOVEN de vaste grond + af en toe een ravijn-gat
    if (!level.parkour && level.platforms) {
      let seed = level.id * 5179 + 11;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      let x = 220;                                  // eerste stuk = veilige vaste grond
      while (x < level.length - 240) {
        if (level.pits && rnd() < 0.7) {
          // groot ravijn-gat: geen grond -> alleen oversteekbaar via platforms (val = dood)
          const pitW = 180 + Math.floor(rnd() * 220);  // 180..400 breed (flinke kloof)
          const x0 = Math.round(x), x1 = Math.round(x + pitW);
          this.pits.push({ x0, x1 });
          // stapsteen-platforms over het gat (segmenten ~62px -> haalbaar met (dubbel-)jump)
          const steps = Math.max(2, Math.round(pitW / 62));
          for (let s = 0; s < steps; s++) {
            const px = x0 + (pitW * (s + 0.5) / steps);
            const py = CONFIG.GROUND_Y - (24 + Math.floor(rnd() * 40));   // 24..64 boven de grond
            this.platforms.push({ x: Math.round(px), y: Math.round(py), w: Math.round(34 + rnd() * 16) });
          }
          x = x1 + 80 + Math.floor(rnd() * 90);        // korter stuk vaste grond na het gat
        } else {
          // los klim-/decoratief platform boven vaste grond
          const w = Math.round(40 + rnd() * 42);
          const py = Math.round(CONFIG.GROUND_Y - (30 + rnd() * 54));
          this.platforms.push({ x: Math.round(x), y: py, w });
          x += w + 60 + Math.floor(rnd() * 80);
        }
      }
      return;
    }
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

  // staat (wereld-x) boven een ravijn-gat? (geen vaste grond hier -> val = dood)
  overPit(x) {
    if (!this.pits) return false;
    for (const p of this.pits) if (x > p.x0 && x < p.x1) return true;
    return false;
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
    else if (this.levelWasCleared) reward = 0;                          // herhaald level: geen kill-munten
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

    // jungle: af en toe vliegt er een vogel door het level (gewone schade)
    if (this.level.flyerChance && Math.random() < this.level.flyerChance) {
      const z = new Zombie(this.cam.x + CONFIG.VIEW_W + 20, this.level, ZOMBIE_TYPES.flyer);
      z.y = 60 + Math.random() * 70;
      this.zombies.push(z);
      this.spawned++;
      return;
    }

    // jungle: kleine luchtballon die zombies van bovenaf dropt (max 2 tegelijk)
    if (this.level.dropperChance && Math.random() < this.level.dropperChance) {
      const droppers = this.zombies.reduce((n, z) => n + (z.alive && z.type.id === 'dropper' ? 1 : 0), 0);
      if (droppers < 2) {
        const z = new Zombie(this.cam.x + CONFIG.VIEW_W + 20, this.level, ZOMBIE_TYPES.dropper);
        z.y = 44 + Math.random() * 18;
        this.zombies.push(z);
        this.spawned++;
        return;
      }
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

    // extra eindgolf: bij het naderen van de finish komt er nog een flinke lading bij
    // (telt mee voor kill-all, zodat je 'm echt moet opruimen voor de finish)
    if (this.level.endWave && !this.endWaveDone && this.spawnArmed &&
        this.player.x > this.level.length * 0.82) {
      this.endWaveDone = true;
      const base = this.level.length;
      const n = 6 + Math.round((this.level.zombieCount || 30) * 0.10);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        const type = r < 0.4 ? ZOMBIE_TYPES.runner : (r < 0.62 ? ZOMBIE_TYPES.crawler : ZOMBIE_TYPES.walker);
        this.pendingZombies.push(new Zombie(base - 30 + Math.random() * 110, this.level, type));
      }
      // plus een paar luchtballonnen boven de finish
      for (let i = 0; i < 2; i++) {
        const d = new Zombie(base - 40 + Math.random() * 90, this.level, ZOMBIE_TYPES.dropper);
        d.y = 46 + Math.random() * 12;
        this.pendingZombies.push(d);
      }
      this.killReqBonus += n;   // deze golf hoort ook verslagen te worden
    }

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

    // in het ravijn / een jungle-gat gevallen = direct dood
    if ((this.level.parkour || this.overPit(this.player.x)) && this.player.y > FALL_DEATH_Y && this.state === 'playing') {
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
    // herhaald level = vaste 15 munten (geen farmen); eerste keer = volle beloning
    const total = this.levelWasCleared ? 15 : (this.runCoins + this.level.reward);
    Storage.addCoins(total);
    UI.showWin({ kills: this.runKills, coins: total, replay: this.levelWasCleared });
  },
  lose() {
    if (this.state !== 'playing') return;
    this.state = 'lose';
    // GEEN munten en GEEN kogel-verlies bij een mislukte poging
    // (voorraad blijft zoals aan het begin van dit level)
    UI.showLose({ kills: this.runKills, coins: this.runCoins, reason: this.loseReason });
  },

  // aantal nog te doden zombies (kill-all-levels)
  zombiesRemaining() { return Math.max(0, this.level.zombieCount + (this.killReqBonus || 0) - this.runKills); },

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

    if (theme.jungle) {
      // jungle: wazige zon door het bladerdak + lichtstralen
      ctx.globalAlpha = 0.16; Sprites.px(ctx, '#eaf6c0', W - 96, 16, 44, 44); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.28; Sprites.px(ctx, '#f2f8cc', W - 86, 24, 24, 24); ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.06; ctx.fillStyle = '#dff0a8';
      for (let i = 0; i < 4; i++) { const lx = (i * 120 - this.cam.x * 0.1) % (W + 120) - 60; ctx.fillRect(lx, 0, 10, CONFIG.GROUND_Y); }
      ctx.globalAlpha = 1;
    } else if (!theme.mountains) {
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
      else if (this.backdrop.jungle) {
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.ellipse(sx + b.w / 2, CONFIG.GROUND_Y - b.h * 0.45, b.w * 0.6, b.h * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      else Sprites.px(ctx, b.c, sx, CONFIG.GROUND_Y - b.h, b.w, b.h);
    }
    // mist-strook tussen lagen
    ctx.globalAlpha = 0.25;
    Sprites.px(ctx, theme.mountains ? '#9fb6cc' : (theme.jungle ? '#1e3a26' : '#2a3346'), 0, CONFIG.GROUND_Y - 40, W, 40);
    ctx.globalAlpha = 1;

    // ---- nabije laag (lichte parallax) ----
    const camNear = this.cam.x * 0.82;
    if (this.backdrop.mountains) {
      for (const b of this.backdrop.near) {
        const sx = b.x - camNear;
        if (sx + b.w < -10 || sx > W + 10) continue;
        this.drawPeak(ctx, sx, b.w, b.h, b.c, b.snow);
      }
    } else if (this.backdrop.jungle) {
      for (const b of this.backdrop.near) {
        const sx = b.x - camNear;
        if (sx < -50 || sx > W + 50) continue;
        const trunkTop = CONFIG.GROUND_Y - b.h;
        Sprites.px(ctx, '#3a2a1a', sx - 3, trunkTop, 6, b.h);          // stam
        Sprites.px(ctx, '#241a10', sx - 3, trunkTop, 2, b.h);          // schaduw
        ctx.fillStyle = b.c;                                            // kruin (overlappende cirkels)
        ctx.beginPath(); ctx.arc(sx, trunkTop, b.cw * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx - b.cw * 0.42, trunkTop + 7, b.cw * 0.46, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + b.cw * 0.42, trunkTop + 7, b.cw * 0.46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';                       // highlight
        ctx.beginPath(); ctx.arc(sx + b.cw * 0.18, trunkTop - b.cw * 0.2, b.cw * 0.32, 0, Math.PI * 2); ctx.fill();
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
      // ravijn-gaten uit de bodem snijden (val = dood)
      if (this.pits) for (const p of this.pits) {
        if (p.x1 < this.cam.x - 12 || p.x0 > this.cam.x + W + 12) continue;
        const pw = p.x1 - p.x0;
        Sprites.px(ctx, '#0a1018', p.x0, CONFIG.GROUND_Y - 1, pw, H);
        ctx.globalAlpha = 0.6; Sprites.px(ctx, '#05070c', p.x0, CONFIG.GROUND_Y + 22, pw, H); ctx.globalAlpha = 1;
        // begroeide, afgebrokkelde randen
        Sprites.px(ctx, theme.groundTop, p.x0 - 5, CONFIG.GROUND_Y, 5, 4);
        Sprites.px(ctx, theme.groundTop, p.x1, CONFIG.GROUND_Y, 5, 4);
        Sprites.px(ctx, '#1a120a', p.x0 - 1, CONFIG.GROUND_Y, 2, 9);
        Sprites.px(ctx, '#1a120a', p.x1 - 1, CONFIG.GROUND_Y, 2, 9);
      }
      // zwevende platforms boven de grond (wereld 3)
      for (const pf of this.platforms) {
        if (pf.x + pf.w / 2 < this.cam.x - 12 || pf.x - pf.w / 2 > this.cam.x + W + 12) continue;
        Sprites.drawPlatform(ctx, pf.x, pf.y, pf.w);
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
      weapon: this.player._shieldUp ? 'shield' : (swingingBat ? this.player.swingWeapon : this.player.weaponId),
      build: this.player.build,
      hair: this.player.hairStyle,
      shielding: this.player._shieldUp,
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

  // ============ 1 vs 1 VERSUS ============
  startVersus(role, opts) {
    opts = opts || {};
    if (window.Net && Net.lobby) Net.lobbyLeave();   // niet meer "online in de lobby" tijdens een potje
    const map = VERSUS_MAPS.find((m) => m.id === opts.mapId) || VERSUS_MAPS[0];
    const mode = (opts.mode === 'both') ? 'both' : (opts.mode === 'smash') ? 'smash' : 'melee';
    this.vsMap = map; this.vsMode = mode;
    this.vsMapW = map.w || CONFIG.VIEW_W;
    this.vsFallY = map.fallY || FALL_DEATH_Y;
    this.vsCamX = 0; this.vsCamY = 0;
    this.worldId = -1;
    this.level = { versus: true, parkour: true, mode: 'versus', length: this.vsMapW, isBoss: false };
    // Power Smash: iedereen start met de knuppel; anders je eigen uitrusting
    const baseMelee = mode === 'smash' ? 'bat' : Storage.data.equippedMelee;
    const rangedId = mode === 'both' ? Storage.data.equippedRanged : null;
    this.player = new Player(baseMelee, rangedId, Storage.data.equippedCharacter);
    this.player.maxJumps = 2; this.player.jumps = 2;
    this.player.knockVx = 0; this.player.dead = false; this.player.respawnInvuln = 0;
    this.player.baseMelee = baseMelee; this.player.fireballs = 0; this.player.smashRockets = 0;
    this.player._weaponUntil = 0; this.player._fireCd = 0;
    this.zombies = []; this.bullets = []; this.particles = []; this.coinFx = []; this.ammoFx = [];
    this.ammoDrops = []; this.healthDrops = []; this.corpses = []; this.pendingZombies = [];
    this.powerUps = []; this.enemyShots = []; this.obstacles = []; this.rocketShots = []; this.platforms = [];
    this.ghostBullets = []; this.botBullets = [];
    this.drops = []; this._dropTimer = SMASH_DROP_EVERY; this._dropId = 1;
    this.portals = []; this._portalTimer = SMASH_PORTAL_EVERY;
    this.dragons = [];
    this.ammo = mode === 'both' ? 999 : 0;
    this.rockets = 0;
    this.boss = null; this.shake = 0; this.cam.x = 0; this.time = 0; this.dtScale = 1;
    this.buildVersusPlatforms(map);
    const base = role === 'host' ? map.spawnL : map.spawnR;
    const sp = { x: base.x, y: base.y, dir: role === 'host' ? 1 : -1 };
    this.player.x = sp.x; this.player.y = sp.y; this.player.dir = sp.dir; this.player.onGround = true;
    const rb = role === 'host' ? map.spawnR : map.spawnL;
    this.vs = {
      role, spawn: sp, botSpawn: { x: rb.x, y: rb.y, dir: role === 'host' ? -1 : 1 },
      myScore: 0, oppScore: 0, target: mode === 'smash' ? SMASH_ROUNDS : 5,
      countdown: 3000, lastSwing: 0, botLastSwing: 0, netTimer: 0, over: false,
      roundFreezeUntil: 0, roundMsg: '',
      remote: {
        x: rb.x, y: rb.y, tx: rb.x, ty: rb.y,
        dir: role === 'host' ? -1 : 1, walkPhase: 0, attacking: false, swingWeapon: null, heldWeapon: 'bat',
        alive: true, charId: 'ryan', lastSeen: 0, hp: 100, maxHp: 100,
      },
    };

    // ----- tegen de BOT (lokaal, geen XP) -----
    this.vsBot = !!opts.bot;
    this.bot = null;
    if (this.vsBot) {
      const ids = CHARACTER_ORDER.slice();
      const botChar = ids[Math.floor(Math.random() * ids.length)] || 'ryan';
      const melees = ['bat', 'machete', 'sword', 'axe', 'mace', 'katana'];
      const botMelee = mode === 'smash' ? 'bat' : melees[Math.floor(Math.random() * melees.length)];
      const guns = ['pistol', 'uzi', 'ak47'];
      const botRanged = mode === 'both' ? guns[Math.floor(Math.random() * guns.length)] : null;
      const b = new Player(botMelee, botRanged, botChar);
      b.maxJumps = 2; b.jumps = 2; b.knockVx = 0; b.dead = false; b.respawnInvuln = 0;
      b.x = rb.x; b.y = rb.y; b.dir = this.vs.botSpawn.dir; b.onGround = true;
      b._think = 0; b._jumpCd = 0; b._shootCd = 0; b._blockUntil = 0; b._rangedId = botRanged;
      b.baseMelee = botMelee; b.fireballs = 0; b.smashRockets = 0; b._weaponUntil = 0; b._fireCd = 0;
      this.bot = b;
      this.vs.remote.charId = botChar;
    } else if (window.Net) {
      Net.setVersusCallbacks({
        onState: (s) => this.onVersusState(s),
        onHit: (p) => this.onVersusHit(p),
        onFell: () => this.onVersusFell(),
        onBurn: () => this.onVersusBurn(),
        onShot: (p) => this.onVersusShot(p),
        onRematch: () => UI.onRematch(),
        onOver: (p) => this.onVersusOver(p),
        onDrop: (p) => this.onVersusDrop(p),
        onPickup: (p) => this.onVersusPickup(p),
        onPortal: (p) => this.onVersusPortal(p),
        onDragon: () => this.onVersusDragon(),
      });
    }
    this.state = 'versus';
    Input.clear();
    UI.showVersus();
  },

  buildVersusPlatforms(map) {
    // platforms klonen met basis-positie (bx/by) zodat bewegende platforms kunnen oscilleren
    this.platforms = (map.platforms || []).map((p) => ({
      x: p.x, y: p.y, w: p.w, bx: p.x, by: p.y, mv: p.mv || null, dx: 0, dy: 0,
    }));
  },

  // bewegende platforms updaten (+ delta voor het meedragen van de speler)
  updateVersusPlatforms() {
    for (const p of this.platforms) {
      if (!p.mv) { p.dx = 0; p.dy = 0; continue; }
      const off = Math.sin(this.time * p.mv.speed + (p.mv.phase || 0)) * p.mv.amp;
      const nx = p.mv.axis === 'x' ? p.bx + off : p.bx;
      const ny = p.mv.axis === 'y' ? p.by + off : p.by;
      p.dx = nx - p.x; p.dy = ny - p.y; p.x = nx; p.y = ny;
    }
  },

  updateVersus(dt) {
    if (!this.vs) return;
    this.time += dt;
    this.dtScale = Math.min(3, dt / 16.6667);
    const v = this.vs;

    // ronde-freeze: even stilstaan met grote "wint de ronde"-tekst
    if (v.roundFreezeUntil > this.time) {
      for (const p of this.particles) p.update(dt, this);
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.04);
      if (window.UI && UI.updateVersusHUD) UI.updateVersusHUD(v);
      return;
    } else if (v.roundMsg) {                          // freeze net afgelopen -> nieuwe ronde
      v.roundMsg = '';
      this.respawnLocal();
      if (this.vsBot) this.respawnBot(); else v.remote.alive = true;
    }

    this.updateVersusPlatforms();

    if (v.countdown > 0) { v.countdown -= dt; }       // korte aftelling vóór de start
    else {
      if (this.player.respawnInvuln > 0) this.player.respawnInvuln -= dt;
      if (this.vsMode === 'smash') this.smashFire(dt);   // fireball/rocket op de vuurknop (vóór update)
      this.player.update(dt, this);                   // eigen speler: volledige besturing/fysica
      this.player.x = Math.max(8, Math.min(this.vsMapW - 8, this.player.x));   // binnen de map
      this.carryOnPlatform();                          // meebewegen met bewegend platform
      if (this.vsMode === 'smash') this.updateSmash(dt);  // drops spawnen/oppakken + wapen-timer
      if (this.vsBot) this.updateBot(dt);              // de AI-tegenstander
      this.checkVersusHit();
      // Just: stamp-schade op de tegenstander bij de landing
      if (this.player._poundHit) {
        this.player._poundHit = false;
        const r = v.remote;
        if (r.alive && Math.abs(r.x - this.player.x) < 40 && Math.abs(r.y - this.player.y) < 30) {
          const kd = r.x >= this.player.x ? 1 : -1;
          if (this.vsBot) this.applyHitToBot(kd, 16, -6, 24);
          else if (window.Net) Net.versusSend('hit', { dir: kd, power: 16, vy: -6, dmg: 24 });
          this.shake = Math.max(this.shake, 8);
        }
      }
      if (this.vsMode === 'both' || this.vsMode === 'smash') this.updateVersusBullets(dt);
      // Vince-vuuraura raakt de tegenstander
      if (this.player.fireAura && this.player._auraOn && v.remote.alive &&
          Math.abs(v.remote.x - this.player.x) < 24 && Math.abs(v.remote.y - this.player.y) < 26) {
        if (this.vsBot) { if (this.bot && this.bot.respawnInvuln <= 0) this.bot.burnUntil = this.time + 3000; }
        else if (this.time >= (v.burnSentAt || 0)) { v.burnSentAt = this.time + 600; if (window.Net) Net.versusSend('burn', {}); }
      }
      // eraf gevallen of doodgebrand -> punt voor de tegenstander
      if (!this.player.dead && (this.player.y > this.vsFallY || this.player.hp <= 0)) this.localFell();
    }

    // camera volgt de eigen speler (binnen de map-grenzen)
    this.updateVersusCamera();

    // ghost-kogels van de tegenstander (alleen visueel)
    if (this.ghostBullets && this.ghostBullets.length) {
      for (const b of this.ghostBullets) { b.x += b.vx * this.dtScale; b.life -= dt; }
      this.ghostBullets = this.ghostBullets.filter((b) => b.life > 0 && b.x > -20 && b.x < this.vsMapW + 20);
    }

    // partikels
    for (const p of this.particles) p.update(dt, this);
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 0.04);

    // mijn stand uitzenden (~20x/sec)
    v.netTimer += dt;
    if (v.netTimer >= 50) { v.netTimer = 0; this.sendVersusState(); }

    // tegenstander vloeiend interpoleren
    const r = v.remote;
    r.x += (r.tx - r.x) * 0.35;
    r.y += (r.ty - r.y) * 0.35;

    if (window.UI && UI.updateVersusHUD) UI.updateVersusHUD(v);
  },

  // speler meedragen op een horizontaal bewegend platform
  carryOnPlatform() {
    const p = this.player;
    if (!p.onGround) return;
    for (const pf of this.platforms) {
      if (pf.dx && Math.abs(p.x - pf.x) < pf.w / 2 + p.w / 2 && Math.abs(p.y - pf.y) < 4) {
        p.x += pf.dx; break;
      }
    }
  },

  // kogels in 'beide wapens'-modus: aankondigen, bewegen, treffers op de tegenstander
  updateVersusBullets(dt) {
    const r = this.vs.remote;
    for (const b of this.bullets) {
      if (!b._announced) {
        if (window.Net) Net.versusSend('shot', { x: Math.round(b.x), y: Math.round(b.y), vx: +b.vx.toFixed(2), k: b.kind || 0 });
        b._announced = true;
      }
    }
    for (const b of this.bullets) b.update(dt, this);   // beweegt (geen zombies in versus)
    for (const b of this.bullets) {
      const rw = b.kind === 'rocket' ? 16 : 11, rh = b.kind === 'rocket' ? 20 : 16;
      if (b.alive && r.alive && Math.abs(b.x - r.x) < rw && Math.abs(b.y - (r.y - 16)) < rh) {
        b.alive = false;
        const dmg = (b.hitDmg != null) ? b.hitDmg : Math.round((b.damage || 20) * 0.4);
        const power = (b.power != null) ? b.power : 9;
        const kd = Math.sign(b.vx) || 1;
        if (this.vsBot) this.applyHitToBot(kd, power, -3.5, dmg);
        else if (window.Net) Net.versusSend('hit', { dir: kd, power: power, vy: -3.5, dmg: dmg });
        this.spawnBlood(b.x, b.y);
        if (b.kind) for (let i = 0; i < 6; i++) this.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 3, -Math.random() * 2, b.kind === 'rocket' ? '#ffd24a' : '#ff7a2a', 320, 2));
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  },

  onVersusShot(p) {
    if (!this.ghostBullets) this.ghostBullets = [];
    if (this.ghostBullets.length < 40) this.ghostBullets.push({ x: p.x, y: p.y, vx: p.vx, life: 1200, kind: p.k || 0 });
  },

  // ---- camera (volgt de eigen speler binnen de map-grenzen) ----
  updateVersusCamera() {
    const map = this.vsMap || VERSUS_MAPS[0];
    const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    let tx = this.player.x - W / 2;
    tx = Math.max(0, Math.min((this.vsMapW || W) - W, tx));
    let ty = this.player.y - H * 0.62;
    ty = Math.max(map.camTop || 0, Math.min(map.camBottom || 0, ty));
    this.vsCamX += (tx - this.vsCamX) * 0.18;
    this.vsCamY += (ty - this.vsCamY) * 0.18;
  },

  // ---- POWER SMASH: vuurknop, drops, pickups ----
  smashFire() {
    const p = this.player;
    if (!p.dead && Input.state.attack && this.time >= (p._fireCd || 0)) {
      if (p.fireballs > 0) { p.fireballs--; p._fireCd = this.time + 420; this.spawnVersusProjectile(p, 'fire'); }
      else if (p.smashRockets > 0) { p.smashRockets--; p._fireCd = this.time + 850; this.spawnVersusProjectile(p, 'rocket'); if (p.smashRockets <= 0) p.rangedId = null; }
    }
    Input.state.attack = false;   // vuurknop doet GEEN melee in smash (melee = aparte knop)
  },

  spawnVersusProjectile(shooter, kind) {
    const dir = shooter.dir;
    const bl = new Bullet(shooter.x + dir * 14, shooter.y - 16, dir * (kind === 'rocket' ? 6 : 7.5), 0, 0);
    bl.kind = kind;
    if (kind === 'fire') { bl.hitDmg = 22; bl.power = 14; } else { bl.hitDmg = 40; bl.power = 26; }
    this.bullets.push(bl);
    this.spawnMuzzleFlash(shooter.x + dir * 14, shooter.y - 16, dir);
  },

  updateSmash(dt) {
    const p = this.player;
    if (p._weaponUntil && this.time > p._weaponUntil) { p.meleeId = p.baseMelee || 'bat'; p.weaponId = p.rangedId || p.meleeId; p._weaponUntil = 0; p.swingWeapon = null; }
    // drops spawnen: host (online) of lokaal (bot)
    if (this.vsBot || this.vs.role === 'host') {
      this._dropTimer -= dt;
      if (this._dropTimer <= 0 && this.drops.length < 3) { this._dropTimer = SMASH_DROP_EVERY; this.spawnDrop(); }
    }
    // eigen speler pakt op
    for (const d of this.drops) {
      if (d.taken) continue;
      if (Math.abs(this.player.x - d.x) < 16 && Math.abs((this.player.y - 12) - d.y) < 22) {
        d.taken = true; this.applyDrop(this.player, d);
        if (window.Net && !this.vsBot) Net.versusSend('pickup', { id: d.id });
      }
    }
    // bot pakt op + wapen-timer
    if (this.vsBot && this.bot && !this.bot.dead) {
      for (const d of this.drops) {
        if (d.taken) continue;
        if (Math.abs(this.bot.x - d.x) < 16 && Math.abs((this.bot.y - 12) - d.y) < 22) { d.taken = true; this.applyDrop(this.bot, d); }
      }
      if (this.bot._weaponUntil && this.time > this.bot._weaponUntil) { this.bot.meleeId = this.bot.baseMelee || 'bat'; this.bot.weaponId = this.bot.rangedId || this.bot.meleeId; this.bot._weaponUntil = 0; this.bot.swingWeapon = null; }
    }
    this.drops = this.drops.filter((d) => !d.taken && this.time - d.born < (d.kind === 'dragon' ? SMASH_DRAGON_LIFE : 16000));

    // ----- portalen: af en toe een paar dat je naar de overkant teleporteert -----
    if (!this.portals) this.portals = [];
    if (this.vsBot || this.vs.role === 'host') {
      this._portalTimer -= dt;
      if (this._portalTimer <= 0 && this.portals.length === 0) { this._portalTimer = SMASH_PORTAL_EVERY; this.spawnPortal(); }
    }
    this.checkPortal(this.player);
    if (this.vsBot && this.bot && !this.bot.dead) this.checkPortal(this.bot);
    this.portals = this.portals.filter((pt) => this.time - pt.born < SMASH_PORTAL_LIFE);

    // draken (drakenei-powerup)
    this.updateDragons(dt);
  },

  // roep een draak op die de tegenstander 10s lang met vuur bestookt
  spawnDragon(owner) {
    this.dragons = this.dragons || [];
    this.dragons = this.dragons.filter((d) => d.owner !== owner);   // max 1 per eigenaar
    const W = CONFIG.VIEW_W;
    this.dragons.push({ owner, until: this.time + DRAGON_DUR, x: owner === 'me' ? -36 : W + 36, dir: owner === 'me' ? 1 : -1, nextSpit: this.time + 500, beam: null });
  },

  updateDragons(dt) {
    if (!this.dragons || !this.dragons.length) return;
    const W = CONFIG.VIEW_W;
    for (const d of this.dragons) {
      d.x += d.dir * 1.0 * this.dtScale;                            // heen en weer bovenin
      if (d.x > W + 36) d.dir = -1; else if (d.x < -36) d.dir = 1;
      if (this.time >= d.nextSpit) { d.nextSpit = this.time + DRAGON_SPIT_MS; this.dragonSpit(d); }
      if (d.beam && this.time > d.beam.until) d.beam = null;
    }
    this.dragons = this.dragons.filter((d) => this.time < d.until);
  },

  // een vuurstraal naar het doelwit + schade
  dragonSpit(d) {
    let wx = null, wy = null;
    const dmg = DRAGON_DMG;
    if (d.owner === 'me') {
      if (this.vsBot) {
        const b = this.bot; if (!b || b.dead) return;
        wx = b.x; wy = b.y;
        this.applyHitToBot(b.x >= this.player.x ? 1 : -1, 8, -4, dmg);
        if (b.respawnInvuln <= 0) b.burnUntil = this.time + 3000;
      } else {
        const r = this.vs.remote; if (!r || !r.alive) return;
        wx = r.x; wy = r.y;
        if (window.Net) { Net.versusSend('hit', { dir: (r.x >= this.player.x ? 1 : -1), power: 8, vy: -4, dmg }); Net.versusSend('burn', {}); }
      }
    } else if (d.owner === 'bot') {
      const p = this.player; wx = p.x; wy = p.y;
      if (!p.dead && p.respawnInvuln <= 0) { this.onVersusHit({ dir: (p.x >= this.bot.x ? 1 : -1), power: 8, vy: -4, dmg }); p.burnUntil = this.time + 3000; }
    } else {                                                        // 'foe': alleen visueel (echte schade komt via 'hit' van de eigenaar)
      const p = this.player; wx = p.x; wy = p.y;
    }
    if (wx == null) return;
    d.beam = { until: this.time + 320, wx, wy };
    for (let i = 0; i < 10; i++)
      this.particles.push(new Particle(wx + (Math.random() - 0.5) * 10, wy - 12 + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 1.5, -Math.random() * 1.2, Math.random() < 0.5 ? '#ff7a2a' : '#ffd24a', 320, 2));
    this.shake = Math.max(this.shake, 4);
  },

  onVersusDragon() { this.spawnDragon('foe'); },

  // portaalpaar: één in de linkerhelft, één in de rechterhelft (host/lokaal bepaalt)
  spawnPortal() {
    const mapW = this.vsMapW;
    const left = this.platforms.filter((p) => p.x < mapW * 0.5);
    const right = this.platforms.filter((p) => p.x >= mapW * 0.5);
    if (!left.length || !right.length) return;
    const a = left[Math.floor(Math.random() * left.length)];
    const b = right[Math.floor(Math.random() * right.length)];
    const id = this._dropId++;
    const pt = { id, ax: Math.round(a.x), ay: Math.round(a.y), bx: Math.round(b.x), by: Math.round(b.y), born: this.time };
    this.portals.push(pt);
    if (window.Net && !this.vsBot) Net.versusSend('portal', { id: pt.id, ax: pt.ax, ay: pt.ay, bx: pt.bx, by: pt.by });
  },

  // speler die in een portaalmond stapt -> naar de andere mond
  checkPortal(pl) {
    if (!this.portals || !this.portals.length || pl.dead) return;
    if (this.time < (pl._portalCd || 0)) return;
    for (const pt of this.portals) {
      let tx = null, ty = null;
      if (Math.abs(pl.x - pt.ax) < 13 && Math.abs(pl.y - pt.ay) < 20) { tx = pt.bx; ty = pt.by; }
      else if (Math.abs(pl.x - pt.bx) < 13 && Math.abs(pl.y - pt.by) < 20) { tx = pt.ax; ty = pt.ay; }
      if (tx != null) {
        for (let i = 0; i < 16; i++) this.particles.push(new Particle(pl.x, pl.y - 12, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 3.2, '#b06bff', 360, 2));
        pl.x = tx; pl.y = ty; pl.vy = 0; pl.knockVx = 0; pl.onGround = true;
        pl._portalCd = this.time + 1300;     // niet meteen terugstappen
        for (let i = 0; i < 16; i++) this.particles.push(new Particle(pl.x, pl.y - 12, (Math.random() - 0.5) * 3.2, (Math.random() - 0.5) * 3.2, '#6bd0ff', 360, 2));
        this.shake = Math.max(this.shake, 5);
        break;
      }
    }
  },

  onVersusPortal(p) {
    if (!this.portals) this.portals = [];
    if (this.portals.some((pt) => pt.id === p.id)) return;
    this.portals.push({ id: p.id, ax: p.ax, ay: p.ay, bx: p.bx, by: p.by, born: this.time });
  },

  spawnDrop() {
    let tot = 0; for (const d of SMASH_DROPS) tot += d.w;
    let r = Math.random() * tot, kind = 'health';
    for (const d of SMASH_DROPS) { r -= d.w; if (r <= 0) { kind = d.kind; break; } }
    const pf = this.platforms[Math.floor(Math.random() * this.platforms.length)] || { x: 180, y: 140, w: 60 };
    const x = Math.round(pf.x + (Math.random() - 0.5) * Math.max(8, pf.w - 16));
    const y = Math.round(pf.y - 9);
    const wid = kind === 'weapon' ? SMASH_WEAPON_POOL[Math.floor(Math.random() * SMASH_WEAPON_POOL.length)] : 0;
    const id = this._dropId++;
    this.drops.push({ id, kind, x, y, wid, born: this.time, taken: false });
    if (window.Net && !this.vsBot) Net.versusSend('drop', { id, kind, x, y, wid });
  },

  applyDrop(pl, d) {
    for (let i = 0; i < 8; i++) this.particles.push(new Particle(d.x, d.y, (Math.random() - 0.5) * 2, -Math.random() * 2, '#ffe27a', 340, 2));
    if (d.kind === 'weapon') { pl.meleeId = d.wid; pl.weaponId = pl.rangedId || d.wid; pl._weaponUntil = this.time + SMASH_WEAPON_TIME; }
    else if (d.kind === 'fireball') pl.fireballs = SMASH_FIREBALL_SHOTS;
    else if (d.kind === 'rocket') pl.smashRockets = SMASH_ROCKETS;
    else if (d.kind === 'health') pl.hp = Math.min(pl.maxHp, pl.hp + 40);
    else if (d.kind === 'rage') pl.buffs.rage = this.time + POWERUPS.rage.dur;
    else if (d.kind === 'speed') pl.buffs.speed = this.time + POWERUPS.speed.dur;
    else if (d.kind === 'dragon') {
      if (pl === this.player) { this.spawnDragon('me'); if (window.Net && !this.vsBot) Net.versusSend('dragon', {}); }
      else { this.spawnDragon('bot'); }
    }
  },

  onVersusDrop(p) {
    if (!this.drops) this.drops = [];
    if (this.drops.some((d) => d.id === p.id)) return;
    this.drops.push({ id: p.id, kind: p.kind, x: p.x, y: p.y, wid: p.wid, born: this.time, taken: false });
  },
  onVersusPickup(p) {
    if (!this.drops) return;
    for (const d of this.drops) if (d.id === p.id) d.taken = true;
  },

  beginRoundFreeze(msg) {
    this.vs.roundFreezeUntil = this.time + 2200;       // ~2,2s freeze
    this.vs.roundMsg = msg;
    this.dragons = [];                                  // draken stoppen bij rondewissel
    this.shake = Math.max(this.shake, 7);
  },

  checkVersusHit() {
    const p = this.player, r = this.vs.remote;
    if (!r.alive) return;
    // alleen op het moment dat een NIEUWE mep begint (1 mep = 1 treffer)
    const sw = p.swingUntil || 0;
    if (sw && sw !== this.vs.lastSwing && this.time < sw) {
      this.vs.lastSwing = sw;
      const reach = 36;                              // ruime melee-reach in versus
      const dx = (r.x - p.x) * p.dir;
      if (dx > -10 && dx < reach && Math.abs(r.y - p.y) < 30) {
        const kdir = (r.x >= p.x ? 1 : -1);
        const wd = (WEAPONS[p.meleeId] ? WEAPONS[p.meleeId].damage : 34) * (p.meleeMul || 1) * (p.hasBuff('rage', this.time) ? 1.6 : 1);
        const dmg = Math.round(wd * 0.45);                            // versus-melee-schade
        if (this.vsBot) this.applyHitToBot(kdir, 15, -5.5, dmg);      // bot wegslaan + schade
        else Net.versusSend('hit', { dir: p.dir, power: 15, vy: -5.5, dmg: dmg });
        this.spawnBlood(r.x, r.y - 16);
        this.shake = Math.max(this.shake, 6);
      }
    }
  },

  // ===== BOT (lokale AI-tegenstander) =====
  updateBot(dt) {
    const b = this.bot, v = this.vs;
    if (b.respawnInvuln > 0) b.respawnInvuln -= dt;
    const inp = this.botThink();
    b.update(dt, this, inp);
    // bot meebewegen op een horizontaal platform
    if (b.onGround) for (const pf of this.platforms) {
      if (pf.dx && Math.abs(b.x - pf.x) < pf.w / 2 + b.w / 2 && Math.abs(b.y - pf.y) < 4) { b.x += pf.dx; break; }
    }
    // bot-stand spiegelen naar de 'remote' (voor tekening + treffer-checks)
    const r = v.remote;
    r.x = r.tx = b.x; r.y = r.ty = b.y; r.dir = b.dir; r.onGround = b.onGround;
    r.attacking = this.time < b.attackAnimUntil; r.swingWeapon = (this.time < (b.swingUntil || 0)) ? b.swingWeapon : null;
    r.heldWeapon = b.weaponId || b.meleeId || 'bat';
    r.walkPhase = b.walkPhase; r.alive = !b.dead; r.charId = b.charId;
    r.hp = b.hp; r.maxHp = b.maxHp; r.ducking = b.ducking;

    // bot schiet: vuurwapen (beide-wapens) of fireball/rocket (smash)
    const p2 = this.player;
    const canShoot = b.onGround && !b.dead && this.time >= (b._shootCd || 0) && !p2.dead &&
      Math.abs(p2.y - b.y) < 22 && Math.abs(p2.x - b.x) > 30;
    if (canShoot) {
      const sdir = p2.x >= b.x ? 1 : -1;
      let bl = null;
      if (this.vsMode === 'both' && b._rangedId) {
        const wd = WEAPONS[b._rangedId] || WEAPONS.pistol;
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * (wd.bulletSpeed || 7), wd.damage, 0);
        b._shootCd = this.time + 1100;
      } else if (this.vsMode === 'smash' && b.fireballs > 0) {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 7.5, 0, 0); bl.kind = 'fire'; bl.hitDmg = 22; bl.power = 14;
        b.fireballs--; b._shootCd = this.time + 600;
      } else if (this.vsMode === 'smash' && b.smashRockets > 0) {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 6, 0, 0); bl.kind = 'rocket'; bl.hitDmg = 40; bl.power = 26;
        b.smashRockets--; b._shootCd = this.time + 950;
      }
      if (bl) { b.dir = sdir; this.botBullets.push(bl); this.spawnMuzzleFlash(b.x + sdir * 14, b.y - 16, sdir); }
    }
    // bot-kogels bewegen + de speler raken
    if (this.botBullets && this.botBullets.length) {
      for (const bl of this.botBullets) { bl.x += bl.vx * this.dtScale; bl.life += dt; }
      for (const bl of this.botBullets) {
        const rw = bl.kind === 'rocket' ? 16 : 11, rh = bl.kind === 'rocket' ? 20 : 16;
        if (bl.alive && this.player.respawnInvuln <= 0 && !this.player.dead &&
            Math.abs(bl.x - this.player.x) < rw && Math.abs(bl.y - (this.player.y - 16)) < rh) {
          bl.alive = false;
          const dmg = (bl.hitDmg != null) ? bl.hitDmg : Math.round((bl.damage || 20) * 0.4);
          this.onVersusHit({ dir: Math.sign(bl.vx) || 1, power: (bl.power != null ? bl.power : 9), vy: -3.5, dmg: dmg });
          this.spawnBlood(bl.x, bl.y);
        }
      }
      this.botBullets = this.botBullets.filter((bl) => bl.alive && bl.life < 1500 && bl.x > -20 && bl.x < this.vsMapW + 20);
    }

    // bot (Just): stamp-schade op de speler bij de landing
    if (b._poundHit) {
      b._poundHit = false;
      if (Math.abs(this.player.x - b.x) < 40 && Math.abs(this.player.y - b.y) < 30 && this.player.respawnInvuln <= 0 && !this.player.dead) {
        const kd = this.player.x >= b.x ? 1 : -1;
        this.onVersusHit({ dir: kd, power: 16, vy: -6, dmg: 24 });
        this.shake = Math.max(this.shake, 8);
      }
    }

    // bot's mep raakt de speler?
    const bsw = b.swingUntil || 0;
    if (bsw && bsw !== v.botLastSwing && this.time < bsw) {
      v.botLastSwing = bsw;
      const dxp = (this.player.x - b.x) * b.dir;
      if (dxp > -10 && dxp < 36 && Math.abs(this.player.y - b.y) < 30 && this.player.respawnInvuln <= 0 && !this.player.dead) {
        const kd = this.player.x >= b.x ? 1 : -1;
        const wd = (WEAPONS[b.meleeId] ? WEAPONS[b.meleeId].damage : 34) * (b.meleeMul || 1) * (b.hasBuff('rage', this.time) ? 1.6 : 1);
        this.onVersusHit({ dir: kd, power: 15, vy: -5.5, dmg: Math.round(wd * 0.45) });
        this.shake = Math.max(this.shake, 6);
      }
    }
    // bot's Vince-aura laat de speler branden
    if (b.fireAura && b._auraOn && this.player.respawnInvuln <= 0 &&
        Math.abs(this.player.x - b.x) < 24 && Math.abs(this.player.y - b.y) < 26) {
      this.player.burnUntil = this.time + 3000;
    }
    // bot eraf gevallen of doodgebrand -> punt voor de speler
    if (!b.dead && (b.y > FALL_DEATH_Y || b.hp <= 0)) { b.dead = true; this.onVersusFell(); }
  },

  applyHitToBot(dir, power, vy, dmg) {
    const b = this.bot;
    if (!b || b.respawnInvuln > 0 || b.dead) return;
    const blocking = b.ducking && b.onGround;
    b.knockVx = dir * power * (blocking ? 0.15 : 1);
    if (!blocking) { b.vy = vy; b.onGround = false; }
    if (dmg) b.takeDamage(Math.round(dmg * (blocking ? 0.4 : 1)), 0, this, 0);
    if (blocking) this.spawnArmorSpark(b.x + b.dir * 10, b.y - 12);
    this.shake = Math.max(this.shake, blocking ? 3 : 7);
  },

  respawnBot() {
    const b = this.bot; if (!b) return;
    const sp = this.vs.botSpawn;
    b.x = sp.x; b.y = sp.y; b.dir = sp.dir; b.vy = 0; b.knockVx = 0;
    b.onGround = true; b.dead = false; b.respawnInvuln = 1300; b.hp = b.maxHp; b.burnUntil = 0;
    b.swingWeapon = null; b.swingUntil = 0;
    if (this.vsMode === 'smash') { b.meleeId = b.baseMelee || 'bat'; b.weaponId = b.meleeId; b.fireballs = 0; b.smashRockets = 0; b._weaponUntil = 0; }
    this.vs.remote.alive = true;
  },

  platformUnder(e) {
    for (const pf of this.platforms)
      if (Math.abs(e.x - pf.x) < pf.w / 2 + 2 && Math.abs(e.y - pf.y) < 4) return pf;
    return null;
  },
  nearestPlatform(x) {
    let best = null, bd = 1e9;
    for (const pf of this.platforms) { const d = Math.abs(pf.x - x); if (d < bd) { bd = d; best = pf; } }
    return best;
  },

  // is een ander platform bereikbaar met een (dubbel-)sprong?
  reachablePlatform(cur, tgt) {
    if (!cur || !tgt) return false;
    // wat de bot met een (dubbel)sprong echt haalt: niet te ver en niet te hoog -> niet de leegte in
    return Math.abs(tgt.x - cur.x) < 140 && (cur.y - tgt.y) < 80;
  },

  // de AI: nadert de speler, springt tussen platforms, mept, blokt, herstelt aan de rand
  botThink() {
    const b = this.bot, p = this.player, now = this.time;
    const inp = { left: false, right: false, jump: false, duck: false, attack: false, melee: false, jumpPressed: false };
    if (b.dead) return inp;
    const dx = p.x - b.x;
    const aDx = Math.abs(dx);
    const face = () => { if (aDx > 8) b.dir = dx > 0 ? 1 : -1; };

    // IN DE LUCHT: koers naar het doelplatform (of anders het dichtstbijzijnde) en land erop
    if (!b.onGround) {
      const target = (b._jumpTarget && this.platforms.indexOf(b._jumpTarget) >= 0) ? b._jumpTarget : this.nearestPlatform(b.x);
      if (target) {
        if (target.x > b.x + 6) inp.right = true; else if (target.x < b.x - 6) inp.left = true; else face();
        if (b.vy < 0) inp.jump = true;                    // sprong vasthouden tijdens stijgen = volle hoogte
        // tweede sprong om de oversteek of de hoogte te halen
        if (b.jumps > 0 && now >= b._jumpCd && b.vy > 1 &&
            (Math.abs(target.x - b.x) > 30 || b.y > target.y + 6)) {
          inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 300;
        }
      }
      if (aDx < 30 && Math.abs(p.y - b.y) < 26 && now >= (b._meleeCd || 0)) { inp.melee = true; b._meleeCd = now + 700; face(); }
      return inp;
    }

    const cur = this.platformUnder(b);
    b._jumpTarget = null;                                 // op de grond: geen sprongdoel meer
    const eL = cur ? cur.x - cur.w / 2 + 9 : 0;          // veilige randen
    const eR = cur ? cur.x + cur.w / 2 - 9 : CONFIG.VIEW_W;

    // BLOKKEN: speler vlakbij en haalt uit -> soms bukken (schild)
    if (aDx < 32 && Math.abs(p.y - b.y) < 24 && this.time < (p.swingUntil || 0) &&
        now >= (b._blockUntil || 0) && now >= (b._blockCd || 0) && Math.random() < 0.30) {
      b._blockUntil = now + 420; b._blockCd = now + 1600;
    }
    if (now < (b._blockUntil || 0)) { inp.duck = true; face(); return inp; }   // gebukt blokken

    // niet de speler de leegte in volgen als die boven je in de lucht hangt
    const playerAirAbove = !p.onGround && p.y < b.y - 6;
    const tgt = playerAirAbove ? cur : (this.platformUnder(p) || this.nearestPlatform(p.x));

    if (cur && tgt && cur !== tgt && this.reachablePlatform(cur, tgt)) {
      // doelgericht naar een ANDER, bereikbaar platform springen (doel vasthouden in de lucht)
      const tdx = tgt.x - b.x;
      if (tdx > 6) inp.right = true; else if (tdx < -6) inp.left = true; else face();
      const nearEdge = (tdx > 0 && b.x > eR - 6) || (tdx < 0 && b.x < eL + 6) || tgt.y < cur.y - 8;
      if (nearEdge && now >= b._jumpCd) { inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 700; b._jumpTarget = tgt; }
    } else {
      // op het huidige platform: nader de speler MAAR blijf binnen de veilige randen
      const want = aDx > 26 ? (dx > 0 ? 1 : -1) : 0;
      if (want > 0 && b.x < eR) inp.right = true;
      else if (want < 0 && b.x > eL) inp.left = true;
      else face();
      if (aDx < 32 && Math.abs(p.y - b.y) < 24 && now >= (b._meleeCd || 0)) { inp.melee = true; b._meleeCd = now + 700; face(); }
      // speler hoog erboven -> spring erachteraan (alleen veilig midden op het platform)
      if (p.y < b.y - 18 && aDx < 50 && b.x > eL + 4 && b.x < eR - 4 && now >= b._jumpCd) {
        inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 700; b._jumpTarget = tgt;
      }
    }
    return inp;
  },

  onVersusHit(payload) {
    const p = this.player;
    if (p.respawnInvuln > 0 || p.dead) return;       // net gespawnd = even onkwetsbaar
    const blocking = p.ducking && p.onGround;          // bukken = blok
    p.knockVx = (payload.dir || 1) * (payload.power || 15) * (blocking ? 0.15 : 1);
    if (!blocking) { p.vy = payload.vy || -5.5; p.onGround = false; }
    if (payload.dmg) p.takeDamage(Math.round(payload.dmg * (blocking ? 0.4 : 1)));
    if (blocking) this.spawnArmorSpark(p.x + p.dir * 10, p.y - 12);
    this.shake = Math.max(this.shake, blocking ? 3 : 7);
  },

  localFell() {
    if (this.vs.over || this.vs.roundFreezeUntil > this.time) return;   // al klaar / al in freeze
    this.player.dead = true;
    this.vs.oppScore++;
    // absolute score meesturen -> zelfherstellend tegen verloren/dubbele meldingen
    if (window.Net && !this.vsBot) Net.versusSend('fell', { winScore: this.vs.oppScore });
    if (this.vs.oppScore >= this.vs.target) { this.endVersus(false); return; }
    this.beginRoundFreeze('TEGENSTANDER wint de ronde');
  },
  respawnLocal() {
    const sp = this.vs.spawn;
    this.player.x = sp.x; this.player.y = sp.y; this.player.dir = sp.dir;
    this.player.vy = 0; this.player.knockVx = 0; this.player.onGround = true;
    this.player.dead = false; this.player.respawnInvuln = 1300;
    this.player.hp = this.player.maxHp; this.player.burnUntil = 0;   // fris (ook na burn-dood)
    this.player.swingWeapon = null; this.player.swingUntil = 0;       // geen lingerende mep-animatie
    if (this.vsMode === 'smash') {                  // elke ronde weer met de knuppel
      this.player.meleeId = this.player.baseMelee || 'bat'; this.player.rangedId = null;
      this.player.weaponId = this.player.meleeId;    // ook het getekende wapen terug naar de knuppel
      this.player.fireballs = 0; this.player.smashRockets = 0; this.player._weaponUntil = 0;
    }
  },

  onVersusFell(payload) {
    if (this.vs.over) return;
    // absolute score overnemen (max) -> dubbele meldingen tellen niet dubbel, gemiste herstellen
    if (payload && typeof payload.winScore === 'number') this.vs.myScore = Math.max(this.vs.myScore, payload.winScore);
    else this.vs.myScore++;
    if (this.vs.myScore >= this.vs.target) { this.endVersus(true); return; }
    if (this.vs.roundFreezeUntil <= this.time) this.beginRoundFreeze('JIJ wint de ronde!');
  },

  // tegenstander meldt dat het potje voorbij is (vangnet als de laatste 'fell' verloren ging)
  onVersusOver(payload) {
    if (!this.vs || this.vs.over) return;
    const iLost = payload && payload.loserRole === this.vs.role;
    this.endVersus(!iLost);
  },

  onVersusBurn() {
    const p = this.player;
    if (p.respawnInvuln > 0 || p.dead) return;
    p.burnUntil = this.time + 3000;     // 3s branden
  },

  onVersusState(s) {
    if (!this.vs) return;
    const r = this.vs.remote;
    r.tx = s.x; r.ty = s.y; r.vy = s.vy || 0; r.dir = s.d || 1;
    r.onGround = s.g !== 0; r.attacking = s.a === 1;
    r.swingWeapon = s.sw || null; r.walkPhase = s.wp || 0;
    r.heldWeapon = s.wid || 'bat';
    r.alive = s.al !== 0; r.charId = s.ch || 'ryan';
    r.ducking = s.dk === 1;
    if (typeof s.h === 'number') r.hp = s.h;
    if (typeof s.mh === 'number') r.maxHp = s.mh;
    r.lastSeen = this.time;
  },

  sendVersusState() {
    if (!window.Net) return;
    const p = this.player;
    Net.versusSend('state', {
      x: Math.round(p.x), y: Math.round(p.y), vy: +(p.vy || 0).toFixed(1), d: p.dir,
      g: p.onGround ? 1 : 0, a: this.time < p.attackAnimUntil ? 1 : 0,
      sw: (this.time < (p.swingUntil || 0)) ? (p.swingWeapon || 0) : 0,
      wid: p.weaponId || 0,
      wp: p.walkPhase || 0, al: p.dead ? 0 : 1, ch: Storage.data.equippedCharacter || 'ryan',
      h: Math.round(p.hp), mh: p.maxHp, dk: p.ducking ? 1 : 0,
    });
  },

  endVersus(won) {
    if (this.vs && this.vs.over) return;
    if (this.vs) this.vs.over = true;
    this.state = 'versusOver';
    const isBot = this.vsBot;
    // betrouwbaar de uitslag naar de tegenstander sturen (paar keer tegen pakketverlies)
    if (!isBot && window.Net && this.vs) {
      const role = this.vs.role;
      const loserRole = won ? (role === 'host' ? 'guest' : 'host') : role;
      const send = () => Net.versusSend('over', { loserRole });
      send(); setTimeout(send, 300); setTimeout(send, 800);
    }
    // online: kanaal OPEN houden zodat een rematch mogelijk is (kanaal sluit pas bij menu/lobby)
    // tegen de bot: GEEN XP/wins. Echt duel: XP + wins (sync't naar de leaderboard).
    let gained = 0;
    if (!isBot) {
      const smashWin = won && this.vsMode === 'smash';
      gained = smashWin ? 100 : (won ? XP_WIN : XP_LOSS);     // Power Smash winnen = 100 XP
      Storage.data.xp = (Storage.data.xp || 0) + gained;
      if (smashWin) Storage.data.coins = (Storage.data.coins || 0) + 50;   // + 50 munten
      if (won) Storage.data.mpWins = (Storage.data.mpWins || 0) + 1;
      else Storage.data.mpLosses = (Storage.data.mpLosses || 0) + 1;
      Storage.save();
    }
    UI.showVersusResult(won, this.vs ? this.vs.myScore : 0, this.vs ? this.vs.oppScore : 0, gained, isBot);
  },

  quitVersus() {
    if (window.Net) Net.leaveVersus();
    this.vsBot = false; this.bot = null;
    this.state = 'menu';
    UI.show('menu');
  },

  renderVersus() {
    if (!this.vs) return;
    const ctx = this.ctx, W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    const map = this.vsMap || VERSUS_MAPS[0];
    // lucht (map-thema)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, map.sky[0]); sky.addColorStop(1, map.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // wolk-parallax voor de Sky-map (scherm-ruimte, beweegt licht mee)
    if (map.id === 'sky') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 150 - this.vsCamX * 0.3) % (W + 140)) - 60;
        const cy = 20 + (i % 3) * 50 - this.vsCamY * 0.25;
        ctx.fillRect(cx, cy, 40, 9); ctx.fillRect(cx + 10, cy - 5, 24, 9);
      }
    }

    const shx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const shy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const camX = Math.round(this.vsCamX), camY = Math.round(this.vsCamY);
    ctx.save(); ctx.translate(-camX + shx, -camY + shy);

    // afgrond onderin (map-thema), camera-bewust
    ctx.fillStyle = map.void || '#06090d'; ctx.fillRect(camX - 4, CONFIG.GROUND_Y - 2, W + 8, H + Math.abs(camY) + 320);
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#04060a'; ctx.fillRect(camX - 4, CONFIG.GROUND_Y + 18, W + 8, H + Math.abs(camY) + 320); ctx.globalAlpha = 1;

    // platforms (bewegende krijgen een pijltjes-hint)
    for (const pf of this.platforms) {
      Sprites.drawPlatform(ctx, pf.x, pf.y, pf.w);
      if (pf.mv) { ctx.globalAlpha = 0.5; Sprites.px(ctx, '#ffe9a0', pf.x - 1, pf.y - 5, 2, 2); ctx.globalAlpha = 1; }
    }

    // portalen (Power Smash) — achter de spelers
    if (this.portals) for (const pt of this.portals) this.drawPortal(ctx, pt);

    // drops (Power Smash)
    if (this.drops) for (const d of this.drops) { if (!d.taken) this.drawDrop(ctx, d); }

    // kogels: gewoon + fireball/rocket + ghost van de tegenstander + bot
    const drawBullet = (b) => {
      if (b.kind === 'fire') { Sprites.px(ctx, '#ff7a2a', b.x - 2, b.y - 2, 5, 5); Sprites.px(ctx, '#ffd24a', b.x - 1, b.y - 1, 3, 3); }
      else if (b.kind === 'rocket') { Sprites.px(ctx, '#cfd6df', b.x - 3, b.y - 1, 6, 3); Sprites.px(ctx, '#ffd24a', b.x - (Math.sign(b.vx) || 1) * 3, b.y - 1, 2, 3); }
      else Sprites.px(ctx, '#ffe27a', b.x - 1, b.y - 1, 3, 2);
    };
    if (this.bullets) for (const b of this.bullets) drawBullet(b);
    if (this.ghostBullets) for (const b of this.ghostBullets) drawBullet(b);
    if (this.botBullets) for (const b of this.botBullets) drawBullet(b);

    // partikels
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      Sprites.px(ctx, p.color, p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // tegenstander (ghost) — ROOD pijltje erboven
    const r = this.vs.remote;
    if (r.alive) {
      const rc = (CHARACTERS[r.charId] || CHARACTERS.ryan);
      if (r.onGround) Sprites.shadow(ctx, r.x, r.y + 1, 7);
      Sprites.drawCharacter(ctx, Math.round(r.x), Math.round(r.y), r.dir, rc.palette, {
        walkPhase: r.walkPhase, airborne: !r.onGround, attacking: r.attacking, ducking: r.ducking,
        weapon: r.swingWeapon || r.heldWeapon || 'bat', build: rc.build, hair: rc.hair,
      });
      if (r.ducking) this.drawBlockGuard(ctx, Math.round(r.x), Math.round(r.y), r.dir);
      this.drawVsMarker(ctx, Math.round(r.x), Math.round(r.y), rc.build, '#ff5a5a');
    }

    // eigen speler — GROEN pijltje erboven (knippert tijdens respawn)
    const p = this.player;
    const blink = p.respawnInvuln > 0 && Math.floor(this.time / 90) % 2 === 0;
    if (!p.dead) {
      if (!blink) {
        if (p.onGround) Sprites.shadow(ctx, p.x, p.y + 1, 7);
        const swinging = this.time < (p.swingUntil || 0) && p.swingWeapon;
        Sprites.drawCharacter(ctx, Math.round(p.x), Math.round(p.y), p.dir, p.pal, {
          walkPhase: p.walkPhase, airborne: !p.onGround, ducking: p.ducking,
          attacking: this.time < p.attackAnimUntil,
          weapon: swinging ? p.swingWeapon : p.weaponId, build: p.build, hair: p.hairStyle,
        });
        if (p.ducking && p.onGround) this.drawBlockGuard(ctx, Math.round(p.x), Math.round(p.y), p.dir);
      }
      this.drawVsMarker(ctx, Math.round(p.x), Math.round(p.y), p.build, '#5aff7a');
    }
    ctx.restore();

    // draken (drakenei-powerup) — scherm-ruimte, over de wereld heen
    this.renderDragons(ctx);

    // Power Smash: huidige item/wapen (scherm-ruimte, onderin)
    if (this.vsMode === 'smash') {
      const p2 = this.player; let line = '';
      if (p2.fireballs > 0) line = 'FIRE x' + p2.fireballs;
      else if (p2.smashRockets > 0) line = 'RPG x' + p2.smashRockets;
      const wn = (WEAPONS[p2.meleeId] && p2.meleeId !== 'bat') ? WEAPONS[p2.meleeId].name : 'Bat';
      ctx.fillStyle = '#ffe27a'; ctx.font = 'bold 9px "Courier New", monospace'; ctx.textAlign = 'center';
      ctx.fillText(wn + (line ? '   ' + line : ''), W / 2, H - 7);
      ctx.textAlign = 'left';
    }
  },

  drawDrop(ctx, d) {
    const bob = Math.round(Math.sin((this.time + d.id * 200) / 300) * 2);
    const x = d.x, y = d.y + bob;
    ctx.globalAlpha = 0.22; Sprites.px(ctx, '#ffffff', x - 7, y - 9, 14, 16); ctx.globalAlpha = 1;
    if (d.kind === 'weapon') { Sprites.px(ctx, '#cfd6df', x - 5, y - 3, 10, 3); Sprites.px(ctx, '#9aa3ad', x - 5, y - 3, 10, 1); Sprites.px(ctx, '#5a3a22', x + 3, y - 4, 3, 5); }
    else if (d.kind === 'fireball') { Sprites.px(ctx, '#ff7a2a', x - 4, y - 5, 8, 9); Sprites.px(ctx, '#ffd24a', x - 2, y - 3, 4, 5); }
    else if (d.kind === 'rocket') { Sprites.px(ctx, '#3a4750', x - 5, y - 2, 9, 4); Sprites.px(ctx, '#d94343', x + 3, y - 2, 3, 4); Sprites.px(ctx, '#ffd24a', x - 6, y - 1, 2, 2); }
    else if (d.kind === 'health') { Sprites.px(ctx, '#ffffff', x - 5, y - 5, 10, 10); Sprites.px(ctx, '#d33', x - 1, y - 5, 3, 10); Sprites.px(ctx, '#d33', x - 5, y - 1, 10, 3); }
    else if (d.kind === 'rage') { Sprites.px(ctx, '#ff5a3a', x - 4, y - 5, 8, 9); Sprites.px(ctx, '#ffd24a', x - 1, y - 3, 2, 5); }
    else if (d.kind === 'speed') { Sprites.px(ctx, '#3ad0ff', x - 4, y - 5, 8, 9); Sprites.px(ctx, '#eaffff', x - 1, y - 3, 2, 5); }
    else if (d.kind === 'dragon') {
      // drakenei: paars ovaal met schubben + glans (zeldzaam)
      Sprites.px(ctx, '#5a2f93', x - 4, y - 7, 8, 12);
      Sprites.px(ctx, '#8a5ad0', x - 3, y - 7, 6, 12);
      Sprites.px(ctx, '#c9a6ff', x - 2, y - 6, 2, 3);          // glans
      Sprites.px(ctx, '#3f1f6e', x - 4, y - 3, 8, 1);          // schub-band
      Sprites.px(ctx, '#3f1f6e', x - 3, y, 6, 1);
      Sprites.px(ctx, '#ffd24a', x - 1, y - 9, 2, 2);          // sprankel = zeldzaam
    }
  },

  // draken tekenen (scherm-ruimte): de draak vliegt bovenin en spuugt vuur naar het doel
  renderDragons(ctx) {
    if (!this.dragons || !this.dragons.length) return;
    const camX = Math.round(this.vsCamX), camY = Math.round(this.vsCamY);
    for (const d of this.dragons) {
      const dx = Math.round(d.x), dy = 18;
      if (d.beam) {
        const tx = Math.round(d.beam.wx - camX), ty = Math.round(d.beam.wy - camY - 8);
        this.drawFireBeam(ctx, dx + d.dir * 8, dy + 4, tx, ty);
      }
      Sprites.drawDragon(ctx, dx, dy, d.dir, this.time);
    }
  },

  drawFireBeam(ctx, x1, y1, x2, y2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  },

  // portaalmond (Power Smash): draaiende paars/blauwe ovaal op een platform
  drawPortal(ctx, pt) {
    const t = this.time;
    const mouth = (cx, footY) => {
      const cy = footY - 12, H = 13, W = 8, phase = t / 140;
      // zachte glow eromheen
      ctx.globalAlpha = 0.22; Sprites.px(ctx, '#b06bff', cx - W - 3, cy - H - 3, (W + 3) * 2, (H + 3) * 2); ctx.globalAlpha = 1;
      // ovaal opgebouwd uit rijen, kleur swirlt met hoogte + tijd
      for (let dy = -H; dy <= H; dy++) {
        const k = 1 - (dy * dy) / (H * H); if (k <= 0) continue;
        const w = Math.max(1, Math.round(W * Math.sqrt(k)));
        const band = Math.sin(phase + dy * 0.6);
        const col = band > 0.4 ? '#dff0ff' : (band > -0.2 ? '#b06bff' : '#7a3df0');
        Sprites.px(ctx, col, cx - w, cy + dy, w * 2, 1);
      }
      // donkere kern
      Sprites.px(ctx, '#2a1147', cx - 2, cy - 5, 4, 10);
      // twee draaiende sterretjes
      for (let i = 0; i < 2; i++) { const aa = phase + i * Math.PI; Sprites.px(ctx, '#eaffff', Math.round(cx + Math.cos(aa) * W), Math.round(cy + Math.sin(aa) * H), 2, 2); }
    };
    mouth(pt.ax, pt.ay);
    mouth(pt.bx, pt.by);
  },

  // blok-stand (bukken): glanzend schildje vóór de speler
  drawBlockGuard(ctx, x, footY, dir) {
    const gx = x + dir * 8;
    Sprites.px(ctx, '#9aa3ad', gx, footY - 16, 4 * dir, 12);          // metaal
    Sprites.px(ctx, '#c8ced6', gx, footY - 15, 2 * dir, 10);          // glans
    ctx.globalAlpha = 0.35; Sprites.px(ctx, '#bfe6ff', gx - 2, footY - 18, 8 * dir, 16); ctx.globalAlpha = 1;
  },

  // gekleurd pijltje boven een speler (groen = jij, rood = tegenstander)
  drawVsMarker(ctx, x, footY, build, color) {
    const head = build === 'tall' ? 46 : (build === 'small' ? 28 : 36);
    const bob = Math.round(Math.sin(this.time / 280) * 1.5);
    const ty = footY - head - 4 + bob;                 // bovenkant van het pijltje
    ctx.fillStyle = '#000';                              // donkere rand voor contrast
    ctx.beginPath(); ctx.moveTo(x - 5, ty - 1); ctx.lineTo(x + 5, ty - 1); ctx.lineTo(x, ty + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 4, ty); ctx.lineTo(x + 4, ty); ctx.lineTo(x, ty + 5); ctx.closePath(); ctx.fill();
  },

  // ---------- hoofdloop ----------
  loop(ts) {
    let dt = ts - this.lastTs;
    this.lastTs = ts;
    if (!dt || dt > 100) dt = 16.6667; // bij tab-wissel niet wegspringen

    if (this.state === 'playing') this.update(dt);
    if (['playing', 'paused'].includes(this.state)) this.render();
    if (this.state === 'versus') { this.updateVersus(dt); this.renderVersus(); }

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },
};
