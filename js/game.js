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

  // full-screen: de interne BREEDTE groeit mee met het scherm (hoogte vast),
  // zodat de canvas het hele scherm vult -> geen zwarte zijbalken op brede schermen (iPhone).
  resize() {
    const aspect = (window.innerWidth || 1) / (window.innerHeight || 1);
    let vw = Math.round(CONFIG.VIEW_H * aspect);
    vw = Math.max(360, Math.min(520, vw));            // grenzen tegen extreme schermen
    if (vw % 2) vw++;                                  // even breedte = nettere pixels
    if (vw !== CONFIG.VIEW_W) {
      CONFIG.VIEW_W = vw;
      this.canvas.width = vw;                          // interne resolutie aanpassen
      this.ctx.imageSmoothingEnabled = false;          // (canvas.width reset de context)
    }
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
    if (window.Sfx) Sfx.music('arena');
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
  // perfecte parry: felle witte/gouden flits in een ring
  spawnParryFlash(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.particles.push(new Particle(x, y, Math.cos(a) * 3.2, Math.sin(a) * 3.2, (i % 2 ? '#fff7c8' : '#ffe27a'), 300, 2));
    }
    this._parryFx = { x, y, t: this.time };
  },
  // guard breekt: rode/grijze scherf-burst
  onGuardBreak(e) {
    for (let i = 0; i < 12; i++)
      this.particles.push(new Particle(e.x, e.y - 12, (Math.random() - 0.5) * 3.5, -Math.random() * 3, Math.random() < 0.5 ? '#ff7a5a' : '#9aa3ad', 360, 2));
    this.shake = Math.max(this.shake, 6);
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
      hat: Storage.data.equippedHat, t: this.time,
      rage: this.player.hasBuff('rage', this.time), burning: this.player.burnUntil > this.time,
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
  // Journey-level starten (singleplayer tegen een mensaap-bot, Power Smash)
  startJourney(idx) {
    const world = JOURNEY[1]; if (!world) return;
    const lv = world.levels[idx - 1]; if (!lv) return;
    // elk level z'n eigen beach-variant
    const layout = BEACH_LAYOUTS[(idx - 1) % BEACH_LAYOUTS.length];
    const mapObj = {
      id: 'beach', name: lv.name, sky: ['#8ad0f0', '#cde7f7'], void: '#1c4a5e', plat: 'sand', sand: true, beach: true,
      w: 360, fallY: 214, spawnL: { x: 120, y: 150 }, spawnR: { x: 240, y: 150 }, platforms: layout,
    };
    this.journey = { world: 1, idx, lv };
    this.startVersus('host', { mapObj, mode: 'smash', bot: true, diff: lv.diff, journey: true, journeyDrops: (lv.drops || []), boss: !!lv.boss, botChar: lv.bot });
    this.journey = { world: 1, idx, lv };   // startVersus reset 'm; opnieuw zetten
  },

  // ===== Journey: verhaal-cutscene (speelt op het canvas) =====
  playJourneyIntro(onDone) {
    this._storyDone = onDone; this._storyElapsed = 0;
    this._storyChar = CHARACTERS[Storage.data.equippedCharacter] || CHARACTERS.ryan;
    this.state = 'story';
    const el = document.getElementById('journey-story'); if (el) el.classList.remove('hidden');
    if (window.Sfx) Sfx.music('beach');
  },
  skipStory() { this.finishStory(); },
  finishStory() {
    if (this.state !== 'story') return;
    this.state = 'menu';
    const el = document.getElementById('journey-story'); if (el) el.classList.add('hidden');
    const cb = this._storyDone; this._storyDone = null;
    if (cb) cb();
  },
  _storyApe(ctx, x, fy, dir, ph) {
    Sprites.drawCharacter(ctx, Math.round(x), Math.round(fy), dir, CHARACTERS.aapje.palette, { walkPhase: ph, airborne: false, weapon: null, build: 'small', hair: 'natural' });
  },
  renderStory() {
    const ctx = this.ctx, W = CONFIG.VIEW_W, H = CONFIG.VIEW_H, t = this._storyElapsed || 0, gy = CONFIG.GROUND_Y;
    const ch = this._storyChar || CHARACTERS.ryan, pose0 = { build: ch.build, hair: ch.hair };
    // achtergrond: lucht + zee + strand
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8ad0f0'); sky.addColorStop(1, '#cde7f7'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3f9fd0'; ctx.fillRect(0, gy - 30, W, 30); ctx.fillStyle = '#56b0dd'; ctx.fillRect(0, gy - 30, W, 5);
    for (let x = 0; x < W; x += 14) { const wob = Math.round(Math.sin(t / 300 + x * 0.1) * 2); Sprites.px(ctx, '#cdeaf7', x + ((t * 0.03) % 14), gy - 22 + wob, 7, 2); }
    ctx.fillStyle = '#e3c882'; ctx.fillRect(0, gy, W, H - gy); ctx.fillStyle = '#caa860'; ctx.fillRect(0, gy + 6, W, H - gy - 6);
    ctx.fillStyle = '#ffe79a'; ctx.beginPath(); ctx.arc(W - 46, 30, 14, 0, 6.2832); ctx.fill();
    const cap = document.getElementById('journey-cap');
    if (t < 2600) {                                   // op een vlot komt de speler aandrijven
      const prog = Math.min(1, t / 2400), px = 36 + prog * (W * 0.5 - 36), py = gy - 6 + Math.sin(t / 200) * 1.5;
      Sprites.px(ctx, '#6b4a2a', px - 13, py + 4, 26, 4); Sprites.px(ctx, '#8a5e36', px - 13, py + 4, 26, 1);
      Sprites.drawCharacter(ctx, Math.round(px), Math.round(py), 1, ch.palette, Object.assign({ ducking: true, weapon: null }, pose0));
      if (cap) cap.textContent = 'Je schip is vergaan… je drijft af op open zee.';
    } else if (t < 5200) {                            // speler ligt op het strand; 2 apen rennen aan
      const px = W * 0.5;
      Sprites.drawCharacter(ctx, Math.round(px), Math.round(gy - 2), 1, ch.palette, Object.assign({ ducking: true, weapon: null }, pose0));
      const ap = Math.min(1, (t - 2600) / 2300), ax = W + 24 - ap * (W * 0.5 - 26 + 24);
      this._storyApe(ctx, ax, gy - 2, -1, t / 70); this._storyApe(ctx, ax + 24, gy - 2, -1, t / 70 + 2);
      if (cap) cap.textContent = 'Je spoelt aan op een onbewoond eiland… maar je bent niet alleen.';
    } else if (t < 8000) {                            // apen slepen de speler weg
      const drag = Math.min(1, (t - 5200) / 2600), px = W * 0.5 + drag * (W * 0.5 + 30);
      Sprites.drawCharacter(ctx, Math.round(px), Math.round(gy - 2), -1, ch.palette, Object.assign({ airborne: true, weapon: null }, pose0));
      this._storyApe(ctx, px + 16, gy - 2, -1, t / 60); this._storyApe(ctx, px + 36, gy - 2, -1, t / 60 + 2);
      for (let i = 0; i < 3; i++) Sprites.px(ctx, '#d8c9a0', px - 12 - i * 7, gy - 2 - (i % 2) * 2, 3, 3);
      if (cap) cap.textContent = 'Wilde MENSAPEN grijpen je en sleuren je het oerwoud in!';
    } else { this.finishStory(); }
  },

  startVersus(role, opts) {
    opts = opts || {};
    this.journeyDrops = opts.journeyDrops || null;     // Journey: extra powerup-pool per level
    this._bossBot = !!opts.boss;                        // Journey-eindbaas (Gorilla King)
    if (!opts.journey) this.journey = null;            // alleen Journey-context houden bij een Journey-potje
    if (window.Net && Net.lobby) Net.lobbyLeave();   // niet meer "online in de lobby" tijdens een potje
    const map = opts.mapObj || VERSUS_MAPS.find((m) => m.id === opts.mapId) || VERSUS_MAPS[0];
    const mode = (opts.mode === 'both') ? 'both' : (opts.mode === 'smash') ? 'smash' : 'melee';
    this.vsMap = map; this.vsMode = mode;
    this.vsMapW = map.w || CONFIG.VIEW_W;
    if (window.Sfx) Sfx.music(map.id);                 // map-thema-muziek
    this.vsFallY = map.fallY || FALL_DEATH_Y;
    this.vsCamX = 0; this.vsCamY = 0;
    this.worldId = -1;
    this.level = { versus: true, parkour: true, mode: 'versus', length: this.vsMapW, isBoss: false };
    // Power Smash: iedereen start met de knuppel (of het start-wapen van je character); anders je eigen uitrusting
    const myChar = CHARACTERS[Storage.data.equippedCharacter] || {};
    const baseMelee = mode === 'smash' ? (myChar.startMelee || 'bat') : Storage.data.equippedMelee;
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
    // Cave: knoppen + muur + sfeer (bats/druppels)
    this.caveWall = null; this._caveArmAt = this.time + CAVE_ARM_MS; this.caveArmed = -1;
    this.caveButtons = (map.buttons || []).map((b) => ({ at: b.at, x: b.x, y: b.y }));
    this.caveBats = []; this.caveDrips = []; this.lightningFx = null; this.rocks = [];
    this._comboXp = 0;
    // Vulcan: lavastraal-state + sfeer (achtergrond-uitbarstingen + rook)
    this.vulcan = map.vulcan ? { state: 'idle', nextAt: this.time + VULCAN_EVERY, x: map.vulcanX || 360, hitP: false, hitB: false } : null;
    this.vulcanSmoke = []; this.vulcanBg = [];
    // Pirate: zeemonster-tentakel
    this.tentacle = map.pirate ? { state: 'idle', nextAt: this.time + PIRATE_TENT_EVERY, x: 360, mode: 'flat', hitP: false, hitB: false } : null;
    // Beach: getij + strandbal
    this.tide = map.beach ? { state: 'idle', nextAt: this.time + BEACH_TIDE_EVERY, level: 0, dir: 1, _sloshAt: 0 } : null;
    this.beachFx = [];
    this.ball = null;
    this.player.beachball = 0; this.player.coco = 0; this.player.boomerang = 0; this.player.dart = 0;
    this.player.cannon = 0; this.player.shieldHp = 0; this.player.gunAmmo = 0; this.player.giant = false; this.player._baseMaxHp = this.player.maxHp; this.player._caged = false; this.player.heli = false; this.player.heliMinigun = 0; this.player.heliRockets = 0;
    // Jungle: lianen + gorilla in de kooi + papegaaien
    this.vsVines = map.vines || null;
    this.gorilla = map.cage ? { x: map.cage.x, y: map.cage.floorY, hp: GORILLA_HP, maxHp: GORILLA_HP, dir: -1, alive: true, state: 'idle', swipeUntil: 0, swipeCd: 0, respawnAt: 0, hitFlash: 0, _net: 0 } : null;
    this.jungleCage = map.cage || null;
    this.monkey = null;
    this.parrots = [];
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
    const lvl = Math.max(1, Math.min(10, opts.diff || 5));
    this.botLevel = lvl;
    this.botCfg = BOT_PROFILES[lvl - 1];
    if (opts.journey) {
      // Journey-mensapen zijn vechters: ze pakken geen ranged wapen op, dus laat ze niet op
      // schiet-afstand blijven hangen — ze komen naar je toe en meppen (diff bepaalt het tempo).
      this.botCfg = Object.assign({}, this.botCfg, { standoff: 22, aggro: Math.max(this.botCfg.aggro, 0.85), jumpy: Math.max(this.botCfg.jumpy, 0.6) });
    }
    if (this.vsBot) {
      const ids = CHARACTER_ORDER.filter((id) => !CHARACTERS[id].journeyOnly);   // bot pakt geen Journey-only karakters
      const botChar = opts.botChar || (opts.boss ? 'kong' : (ids[Math.floor(Math.random() * ids.length)] || 'ryan'));
      const melees = ['bat', 'machete', 'sword', 'axe', 'mace', 'katana'];
      const botMelee = mode === 'smash' ? ((CHARACTERS[botChar] && CHARACTERS[botChar].startMelee) || 'bat') : melees[Math.floor(Math.random() * melees.length)];
      const guns = ['pistol', 'uzi', 'ak47'];
      const botRanged = mode === 'both' ? guns[Math.floor(Math.random() * guns.length)] : null;
      const b = new Player(botMelee, botRanged, botChar);
      b.maxJumps = 2; b.jumps = 2; b.knockVx = 0; b.dead = false; b.respawnInvuln = 0;
      b.x = rb.x; b.y = rb.y; b.dir = this.vs.botSpawn.dir; b.onGround = true;
      b._think = 0; b._jumpCd = 0; b._shootCd = 0; b._blockUntil = 0; b._rangedId = botRanged;
      b.baseMelee = botMelee; b.fireballs = 0; b.smashRockets = 0; b._weaponUntil = 0; b._fireCd = 0;
      b.cannon = 0; b.shieldHp = 0; b.gunAmmo = 0; b.giant = false; b._baseMaxHp = b.maxHp; b._caged = false; b.heli = false; b.heliMinigun = 0; b.heliRockets = 0; b.beachball = 0;
      b.beachball = 0; b.coco = 0; b.boomerang = 0; b.dart = 0;
      if (opts.boss) { b.maxHp = 220; b.hp = 220; b._baseMaxHp = 220; }   // Gorilla King: extra taai
      this.bot = b;
      this.vs.remote.charId = botChar;
    } else if (window.Net) {
      Net.setVersusCallbacks({
        onState: (s) => this.onVersusState(s),
        onHit: (p) => this.onVersusHit(p),
        onParry: (p) => this.onVersusParry(p),
        onTide: (p) => this.onVersusTide(p),
        onBall: (p) => this.onVersusBall(p),
        onFell: () => this.onVersusFell(),
        onBurn: () => this.onVersusBurn(),
        onShot: (p) => this.onVersusShot(p),
        onRematch: () => UI.onRematch(),
        onOver: (p) => this.onVersusOver(p),
        onDrop: (p) => this.onVersusDrop(p),
        onPickup: (p) => this.onVersusPickup(p),
        onPortal: (p) => this.onVersusPortal(p),
        onDragon: () => this.onVersusDragon(),
        onStun: () => this.onVersusStun(),
        onCaveArm: (p) => this.onCaveArm(p),
        onCaveWall: (p) => this.onCaveWall(p),
        onRocks: (p) => this.onVersusRocks(p),
        onLava: (p) => this.onVersusLava(p),
        onTentacle: (p) => this.onVersusTentacle(p),
        onGorilla: (p) => this.onVersusGorilla(p),
        onGorhit: (p) => this.onVersusGorhit(p),
        onMonkey: (p) => this.onVersusMonkey(p),
      });
    }
    this.state = 'versus';
    const qb = document.getElementById('btn-vs-quit');     // online = LEAVE, bot = ✕
    if (qb) { qb.textContent = this.vsBot ? '✕' : 'LEAVE'; qb.classList.toggle('leave', !this.vsBot); }
    Input.clear();
    UI.showVersus();
  },

  buildVersusPlatforms(map) {
    // platforms klonen met basis-positie (bx/by) zodat bewegende platforms kunnen oscilleren
    this.platforms = (map.platforms || []).map((p) => ({
      x: p.x, y: p.y, w: p.w, bx: p.x, by: p.y, mv: p.mv || null, dx: 0, dy: 0, soft: p.soft || false, slide: p.slide || 0, mast: p.mast || false,
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
      if (this.player.heli) {
        this.updateHeli(dt);                          // gevechtsheli: vliegen + minigun/raketten
      } else {
        if (this.vsMode === 'smash') this.smashFire(dt);   // fireball/rocket op de vuurknop (vóór update)
        this.player.update(dt, this);                   // eigen speler: volledige besturing/fysica
      }
      this.player.x = Math.max(8, Math.min(this.vsMapW - 8, this.player.x));   // binnen de map
      this.carryOnPlatform();                          // meebewegen met bewegend platform
      if (this.vsMode === 'smash') this.updateSmash(dt);  // drops spawnen/oppakken + wapen-timer
      if (this.vsMap && this.vsMap.cave) this.updateCave(dt);   // knoppen/muur + sfeer
      if (this.vsMap && this.vsMap.vulcan) this.updateVulcan(dt);   // lavastraal + sfeer
      if (this.vsMap && this.vsMap.pirate) this.updatePirate(dt);   // zeemonster-tentakel
      if (this.vsMap && this.vsMap.beach) this.updateTide(dt);      // strand: getij/vloed
      if (this.ball) this.updateBall(dt);                           // strandbal
      if (this.vsMap && this.vsMap.jungle2) this.updateGorilla(dt); // kooi-gorilla
      if (this.vsMap && this.vsMap.jungle2) this.updateMonkey(dt);  // helper-aapje
      if (this.vsMap && this.vsMap.jungle2) this.confineCage(this.player);   // opgesloten tot de gorilla dood is
      if (this.player.giant) this.giantContact(dt);     // reus: bots iemand weg / stamp
      if (this.vsBot) this.updateBot(dt);              // de AI-tegenstander
      if (this.vsMap && this.vsMap.jungle2 && this.vsBot) this.confineCage(this.bot);
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

  // klein beetje stuurhulp: alleen als de kogel de juiste kant op vliegt én dichtbij het doel is (niet te veel)
  _softAim(b, t) {
    const dx = t.x - b.x;
    if (Math.sign(dx) !== Math.sign(b.vx) || Math.abs(dx) > 80) return;
    const dy = (t.y - 14) - b.y;
    b.vy = (b.vy || 0) + Math.max(-0.12, Math.min(0.12, dy * 0.02)) * this.dtScale;
    b.vy = Math.max(-3, Math.min(3, b.vy));
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
    for (const b of this.bullets) {
      if (b.kind === 'cannon' && b.homing && r.alive) {  // gericht: homing naar de tegenstander -> mist nooit
        const ang = Math.atan2((r.y - 14) - b.y, r.x - b.x), sp = 8;
        b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
        b.x += b.vx * this.dtScale; b.y += b.vy * this.dtScale;
        b.life += dt; if (b.life > 2500) b.alive = false;
      } else if ((b.kind === 'fire' || b.kind === 'rocket') && r.alive && r.heli && Math.sign(r.x - b.x) === Math.sign(b.vx)) {
        this._homeBullet(b, r.x, r.y - 12, b.kind === 'rocket' ? 6 : 7.5);   // gericht op een heli -> raakt altijd
        b.x += b.vx * this.dtScale; b.y += b.vy * this.dtScale; b.life += dt; if (b.life > 2500) b.alive = false;
      } else if (b.kind === 'coco') {                     // kokosbom: boog + ontploft op de grond
        b.vy = (b.vy || 0) + 0.4 * this.dtScale; b.x += b.vx * this.dtScale; b.y += b.vy * this.dtScale; b.life += dt;
        let land = b.y > CONFIG.GROUND_Y - 2;
        if (!land && b.vy > 0) for (const pf of this.platforms) { if (!pf.mast && b.x > pf.x - pf.w / 2 && b.x < pf.x + pf.w / 2 && b.y > pf.y - 4 && b.y < pf.y + 10) { land = true; break; } }
        if (land || b.life > 2600) this.explodeCoco(b);
      } else if (b.kind === 'boom') {                     // boemerang: vliegt uit en keert terug
        if (!b._ret && b.life > 420) { b.vx = -b.vx; b._ret = true; }
        b.x += b.vx * this.dtScale; b.life += dt; if (b.life > 1500) b.alive = false;
      } else {
        if ((b.kind === 'fire' || b.kind === 'rocket') && r.alive) this._softAim(b, r);  // klein beetje hulp dichtbij
        b.update(dt, this);
      }   // niet gericht (mist) of gewone kogel -> rechtdoor
    }
    for (const b of this.bullets) {
      const rw = b.kind === 'rocket' ? 16 : (b.kind === 'cannon' ? 18 : 11);
      const rh = b.kind === 'rocket' ? 20 : (b.kind === 'cannon' ? 22 : 16);
      if (b.alive && b.kind === 'coco' && r.alive && Math.abs(b.x - r.x) < 22 && Math.abs(b.y - (r.y - 14)) < 24) {
        this.explodeCoco(b); continue;                   // kokosbom raakt -> AoE-explosie
      }
      if (b.alive && r.alive && Math.abs(b.x - r.x) < rw && Math.abs(b.y - (r.y - 16)) < rh) {
        b.alive = false;
        const dmg = (b.hitDmg != null) ? b.hitDmg : Math.round((b.damage || 20) * 0.4);
        const power = (b.power != null) ? b.power : 9;
        const vy = b.kind === 'cannon' ? -8 : -3.5;
        const kd = Math.sign(b.vx) || 1;
        const stun = b._stun || 0;
        if (this.vsBot) { this.applyHitToBot(kd, power, vy, dmg); if (stun && this.bot) this.bot.stunUntil = Math.max(this.bot.stunUntil || 0, this.time + stun); }
        else if (window.Net) Net.versusSend('hit', { dir: kd, power: power, vy: vy, dmg: dmg, stun: stun });
        this.spawnBlood(b.x, b.y);
        if (b.kind === 'cannon') this.shake = Math.max(this.shake, 8);
        if (b.kind) for (let i = 0; i < 8; i++) this.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 3, -Math.random() * 2, b.kind === 'rocket' ? '#ffd24a' : (b.kind === 'cannon' ? '#888' : '#ff7a2a'), 320, 2));
        continue;
      }
      // kogel raakt de kooi-gorilla (Jungle)
      const g = this.gorilla;
      if (b.alive && g && g.alive && Math.abs(b.x - g.x) < 24 && Math.abs(b.y - (g.y - 18)) < 30) {
        b.alive = false;
        const dmg = (b.hitDmg != null) ? b.hitDmg : Math.round((b.damage || 20) * 0.4);
        this.hitGorilla(dmg);
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  },

  onVersusShot(p) {
    if (!this.ghostBullets) this.ghostBullets = [];
    if (this.ghostBullets.length < 40) this.ghostBullets.push({ x: p.x, y: p.y, vx: p.vx, life: 1200, kind: p.k || 0 });
    if (window.Sfx) { const k = p.k; Sfx.play(k === 'cannon' ? 'cannon' : k === 'rocket' ? 'rocket' : k === 'fire' ? 'fireball' : 'gun'); }   // tegenstander hoort je 'm afvuren
  },

  // ---- camera (volgt de eigen speler binnen de map-grenzen) ----
  updateVersusCamera() {
    const map = this.vsMap || VERSUS_MAPS[0];
    const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    const mapW = this.vsMapW || W;
    let tx;
    if (mapW <= W) tx = (mapW - W) / 2;                     // map smaller dan het scherm -> gecentreerd
    else { tx = this.player.x - W / 2; tx = Math.max(0, Math.min(mapW - W, tx)); }
    let ty = this.player.y - H * 0.62;
    ty = Math.max(map.camTop || 0, Math.min(map.camBottom || 0, ty));
    this.vsCamX += (tx - this.vsCamX) * 0.18;
    this.vsCamY += (ty - this.vsCamY) * 0.18;
  },

  // ---- POWER SMASH: vuurknop, drops, pickups ----
  smashFire() {
    const p = this.player;
    if (!p.dead && Input.state.attack) {
      if (p.giant) { /* reus kan niet aanvallen */ }
      else if (p.cannon > 0) {                              // kanonskogel: altijd vuren; alleen richting de tegenstander = homing
        if (this.time >= (p._fireCd || 0)) {
          const oppX = this.vsBot ? (this.bot ? this.bot.x : p.x + p.dir * 100) : this.vs.remote.x;
          const facing = (Math.sign(oppX - p.x) === p.dir) || Math.abs(oppX - p.x) < 8;
          p.cannon--; p._fireCd = this.time + 900; this.spawnCannon(p, facing);   // niet gericht -> mist
        }
      } else if (p.gunAmmo > 0 && p.rangedId === 'ak47') {  // AK47: snelvuur tot de kogels op zijn
        if (this.time >= (p._fireCd || 0)) {
          p.gunAmmo--; p._fireCd = this.time + 150; this.spawnVersusGun(p);
          if (p.gunAmmo <= 0) { p.rangedId = null; p.weaponId = p.meleeId || 'bat'; }
        }
      } else if (p.beachball > 0 && !this.ball) {           // strandbal afschieten (1 actieve bal tegelijk)
        if (this.time >= (p._fireCd || 0)) { p.beachball--; p._fireCd = this.time + 500; this.spawnBall(p, 'me'); }
      } else if (p.coco > 0) {                               // kokosbom (lobt + ontploft)
        if (this.time >= (p._fireCd || 0)) { p.coco--; p._fireCd = this.time + 650; this.spawnCoco(p); }
      } else if (p.boomerang > 0) {                          // boemerang (keert terug)
        if (this.time >= (p._fireCd || 0)) { p.boomerang--; p._fireCd = this.time + 700; this.spawnBoomerang(p); }
      } else if (p.dart > 0) {                               // gifdart (snel + verdoving)
        if (this.time >= (p._fireCd || 0)) { p.dart--; p._fireCd = this.time + 280; this.spawnDart(p); }
      } else if (p.fireballs > 0 || p.smashRockets > 0) {  // vuurwapen opgepakt -> vuren
        if (this.time >= (p._fireCd || 0)) {
          if (p.fireballs > 0) { p.fireballs--; p._fireCd = this.time + 420; this.spawnVersusProjectile(p, 'fire'); }
          else { p.smashRockets--; p._fireCd = this.time + 850; this.spawnVersusProjectile(p, 'rocket'); if (p.smashRockets <= 0) p.rangedId = null; }
        }
      } else {
        Input.state.melee = true;                          // alleen melee -> vuurknop slaat ook
      }
    }
    // attack NIET resetten -> vuurknop ingedrukt houden = automatisch doorvuren (snelheid via cooldown).
    // Player.update vuurt in versus niet zelf (gegated), dus geen dubbel schot.
  },

  // kanonskogel: vliegt hard naar de tegenstander (homing -> mist nooit), enorme knockback
  spawnCannon(p, homing) {
    const dir = p.dir;
    const bl = new Bullet(p.x + dir * 14, p.y - 16, dir * 8, 0, 0);
    bl.kind = 'cannon'; bl.hitDmg = 18; bl.power = 42; bl.vy = 0; bl.life = 0; bl.homing = !!homing;
    this.bullets.push(bl);
    this.spawnMuzzleFlash(p.x + dir * 14, p.y - 16, dir);
    this.shake = Math.max(this.shake, 5);
    if (window.Sfx) Sfx.play('cannon');
  },

  // AK47-kogel (Jungle): snel, rechtdoor
  spawnVersusGun(p) {
    const dir = p.dir;
    const bl = new Bullet(p.x + dir * 14, p.y - 16, dir * 9, 0, 0);
    bl.kind = 'gun'; bl.hitDmg = 13; bl.power = 7; bl.vy = 0; bl.life = 0;
    this.bullets.push(bl);
    this.spawnMuzzleFlash(p.x + dir * 14, p.y - 16, dir);
    if (window.Sfx) Sfx.play('shoot');
  },

  spawnVersusProjectile(shooter, kind) {
    const dir = shooter.dir;
    const bl = new Bullet(shooter.x + dir * 14, shooter.y - 16, dir * (kind === 'rocket' ? 6 : 7.5), 0, 0);
    bl.kind = kind;
    if (kind === 'fire') { bl.hitDmg = 22; bl.power = 14; } else { bl.hitDmg = 40; bl.power = 26; }
    this.bullets.push(bl);
    this.spawnMuzzleFlash(shooter.x + dir * 14, shooter.y - 16, dir);
    if (window.Sfx && shooter === this.player) Sfx.play(kind === 'rocket' ? 'rocket' : 'fireball');
  },

  // ===== Journey-eiland-powerups =====
  spawnCoco(p) {                                   // kokosbom: lobt in een boog
    const dir = p.dir, bl = new Bullet(p.x + dir * 12, p.y - 18, dir * 4.6, 0, 0);
    bl.kind = 'coco'; bl.hitDmg = 8; bl.power = COCO_KNOCK; bl.vy = -5.2; bl.life = 0; bl._grav = true; bl._aoe = true;
    this.bullets.push(bl); this.spawnMuzzleFlash(p.x + dir * 12, p.y - 16, dir);
    if (window.Sfx && p === this.player) Sfx.play('shoot');
  },
  spawnBoomerang(p) {                              // boemerang: vliegt uit en keert terug
    const dir = p.dir, bl = new Bullet(p.x + dir * 12, p.y - 16, dir * 7, 0, 0);
    bl.kind = 'boom'; bl.hitDmg = 7; bl.power = BOOM_KNOCK; bl.vy = 0; bl.life = 0; bl._ret = false;
    this.bullets.push(bl); this.spawnMuzzleFlash(p.x + dir * 12, p.y - 16, dir);
    if (window.Sfx && p === this.player) Sfx.play('boing');
  },
  spawnDart(p) {                                   // gifdart: snel + recht + korte verdoving
    const dir = p.dir, bl = new Bullet(p.x + dir * 14, p.y - 14, dir * 12, 0, 0);
    bl.kind = 'dart'; bl.hitDmg = 6; bl.power = DART_KNOCK; bl.vy = 0; bl.life = 0; bl._stun = DART_STUN;
    this.bullets.push(bl); this.spawnMuzzleFlash(p.x + dir * 14, p.y - 14, dir);
    if (window.Sfx && p === this.player) Sfx.play('gun');
  },
  explodeCoco(b) {
    for (let i = 0; i < 14; i++) this.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (i % 2 ? '#caa860' : '#8a5e36'), 380, 3));
    this.shake = Math.max(this.shake, 5); if (window.Sfx) Sfx.play('explos');
    // AoE knockback op spelers binnen straal (firing-client autoritair: speler lokaal, tegenstander via hit)
    const hitR = (e, isMe) => {
      if (!e || e.dead || (isMe && e.respawnInvuln > 0)) return;
      if (Math.abs(e.x - b.x) < 34 && Math.abs((e.y - 12) - b.y) < 34) {
        const kd = e.x >= b.x ? 1 : -1;
        if (isMe) this.onVersusHit({ dir: kd, power: COCO_KNOCK, vy: -7, dmg: 8 });
        else if (this.vsBot) this.applyHitToBot(kd, COCO_KNOCK, -7, 8);
        else if (window.Net) Net.versusSend('hit', { dir: kd, power: COCO_KNOCK, vy: -7, dmg: 8 });
      }
    };
    hitR(this.player, true); hitR(this.vsBot ? this.bot : this.vs.remote, false);
    b.alive = false;
  },

  // ===== GEVECHTSHELI =====
  updateHeli(dt) {
    const p = this.player;
    const frozen = (p.stunUntil && this.time < p.stunUntil) || (p.flatUntil && this.time < p.flatUntil);
    const inp = frozen ? {} : Input.state;
    const s = HELI_SPEED * this.dtScale;
    const dx = ((inp.right && !inp.left) ? s : 0) - ((inp.left && !inp.right) ? s : 0);
    const dy = (inp.jump ? -s : 0) + (inp.duck ? s : 0);
    // botst niet door platforms heen (as voor as, anders blokkeren)
    if (dx) { if (!this.heliHits(p.x + dx, p.y)) p.x += dx; p.dir = dx > 0 ? 1 : -1; }
    if (dy) { if (!this.heliHits(p.x, p.y + dy)) p.y += dy; }
    p.vy = 0; p.knockVx = 0; p.onGround = false; p.walkPhase = 0;
    // niet uit beeld vliegen: binnen het zichtbare scherm (camera) én de map houden
    const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
    p.x = Math.max(Math.max(14, this.vsCamX + 16), Math.min(Math.min(this.vsMapW - 14, this.vsCamX + W - 16), p.x));
    p.y = Math.max(this.vsCamY + 14, Math.min(Math.min(CONFIG.GROUND_Y - 2, this.vsCamY + H - 12), p.y));
    // minigun (vuurknop, ingedrukt houden = doorvuren)
    if (!frozen && Input.state.attack && p.heliMinigun > 0 && this.time >= (p._heliFireCd || 0)) {
      p._heliFireCd = this.time + 80; p.heliMinigun--; this.spawnHeliBullet(p);
    }
    // raketten (meleeknop)
    if (!frozen && Input.state.melee && p.heliRockets > 0 && this.time >= (p._heliRocketCd || 0)) {
      p._heliRocketCd = this.time + 600; p.heliRockets--; this.spawnVersusProjectile(p, 'rocket'); this.shake = Math.max(this.shake, 4);
    }
    if (p.heliMinigun <= 0 && p.heliRockets <= 0) this.endHeli(p);   // alles op -> uitstappen
  },
  spawnHeliBullet(p) {
    const dir = p.dir;
    const bl = new Bullet(p.x + dir * 18, p.y - 10 + (Math.random() - 0.5) * 3, dir * 10, 0, 0);
    bl.kind = 'gun'; bl.hitDmg = 7; bl.power = 5; bl.vy = 0; bl.life = 0;
    this.bullets.push(bl);
    this.spawnMuzzleFlash(p.x + dir * 18, p.y - 10, dir);
    if (window.Sfx) Sfx.play('shoot');
  },
  // botst de heli (box rond p) tegen een platform?
  heliHits(x, y) {
    const hw = 16, htop = 28, hbot = 2;
    for (const pf of this.platforms) {
      if (pf.mast) continue;
      const pl = pf.x - pf.w / 2, pr = pf.x + pf.w / 2, pt = pf.y - 2, pb = pf.y + 12;
      if (x + hw > pl && x - hw < pr && y + hbot > pt && y - htop < pb) return true;
    }
    return false;
  },
  // sterke homing (mist nooit) — voor raket/vuurbal die gericht op een heli wordt afgevuurd
  _homeBullet(b, tx, ty, sp) {
    const ang = Math.atan2(ty - b.y, tx - b.x);
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
  },
  endHeli(p) {
    p.heli = false; p.heliMinigun = 0; p.heliRockets = 0;
    p.vy = 0; p.weaponId = p.meleeId || 'bat';
    for (let i = 0; i < 10; i++) this.particles.push(new Particle(p.x, p.y - 8, (Math.random() - 0.5) * 3, -Math.random() * 2, '#888', 320, 2));
  },
  drawHeli(ctx, cx, fy, dir, pal) {
    const t = this.time, f = dir, by = fy - 24;
    const green = '#3f5a3a', greenDk = '#26371f', glass = '#a8dcff', metal = '#7a7a7a', skin = (pal && pal.skin) || '#e8b98a';
    const P = (c, x, y, w, h) => Sprites.px(ctx, c, Math.round(x), Math.round(y), w, h);
    // staartboom + staartrotor (achterkant = tegengesteld aan dir)
    P(green, cx - f * 26, by + 4, 26, 4); P(greenDk, cx - f * 26, by + 6, 26, 2);
    const tr = 5 + Math.round(Math.abs(Math.sin(t / 28)) * 5);
    P(metal, cx - f * 27, by + 3 - (tr - 5), 2, tr); P(metal, cx - f * 27, by + 5, 2, tr);
    // romp
    P(greenDk, cx - 14, by, 28, 15); P(green, cx - 13, by + 1, 26, 4); P(green, cx - 13, by + 3, 25, 9);
    // cockpit-glas + piloot (voorkant = dir-kant)
    P(glass, cx + f * 4, by + 3, 9, 8); P(skin, cx + f * 6, by + 4, 4, 4); P('#1a1a1a', cx + f * (f > 0 ? 8 : 6), by + 5, 1, 2);
    // skids
    P(metal, cx - 13, by + 16, 26, 2); P(metal, cx - 10, by + 15, 2, 2); P(metal, cx + 8, by + 15, 2, 2);
    // hoofdrotor (draait: brede lijn die van breedte wisselt)
    P(metal, cx - 1, by - 3, 2, 3);
    const rw = 16 + Math.round(Math.sin(t / 26) * 9);
    P('#cfd6df', cx - rw, by - 4, rw * 2, 2);
    // minigun onder de neus
    P('#2a2a2a', cx + f * 12, by + 9, f * 6, 2);
  },

  // ===== BEACH: getij (vloed) =====
  beachWaterY() {
    const v = this.tide; if (!v) return 9999;
    return 164 - v.level * 22;   // lager water: laag ~164, vol ~142 (strand op y150)
  },
  _tidePhase(s) {
    const v = this.tide; v.state = s;
    if (s === 'rising') v.nextAt = this.time + BEACH_RISE;
    else if (s === 'flood') { v.nextAt = this.time + BEACH_FLOOD; v._sloshAt = this.time + BEACH_SLOSH; }
    else if (s === 'recede') v.nextAt = this.time + BEACH_RECEDE;
    else v.nextAt = this.time + BEACH_TIDE_EVERY;
  },
  onVersusTide(p) { if (!this.tide || !p) return; if (p.dir != null) this.tide.dir = p.dir; if (p.ph) this._tidePhase(p.ph); },
  updateTide(dt) {
    const v = this.tide; if (!v) return;
    if (this.vsBot || this.vs.role === 'host') {
      const adv = (cur, nx) => { if (v.state === cur && this.time >= v.nextAt) { this._tidePhase(nx); if (window.Net && !this.vsBot) Net.versusSend('tide', { ph: nx, dir: v.dir }); return true; } return false; };
      adv('idle', 'rising') || adv('rising', 'flood') || adv('flood', 'recede') || adv('recede', 'idle');
      if (v.state === 'flood' && this.time >= v._sloshAt) { v.dir = -v.dir; v._sloshAt = this.time + BEACH_SLOSH; if (window.Net && !this.vsBot) Net.versusSend('tide', { ph: 'flood', dir: v.dir }); }
    } else if ((v.state === 'rising' || v.state === 'flood' || v.state === 'recede') && this.time >= v.nextAt + 900) {
      this._tidePhase(v.state === 'recede' ? 'idle' : (v.state === 'flood' ? 'recede' : 'flood'));   // gast-vangnet
    }
    // niveau animeren naar het doel van de fase
    const target = (v.state === 'rising' || v.state === 'flood') ? 1 : 0;
    const rate = (v.state === 'rising') ? (dt / BEACH_RISE) : (v.state === 'recede') ? (dt / BEACH_RECEDE) : (dt / 500);
    v.level += (target - v.level) * Math.min(1, rate * 3.2);
    v.level = Math.max(0, Math.min(1, v.level));
    // golven nemen je mee als je in het water staat
    const surf = this.beachWaterY();
    const carry = (e) => {
      if (!e || e.dead) return;
      if (e.y >= surf - 2 && v.level > 0.25) {
        e.x += v.dir * BEACH_CARRY * this.dtScale;
        if (this.time >= (e._splashAt || 0)) { e._splashAt = this.time + 220; this.beachFx.push({ x: e.x + (Math.random() - 0.5) * 10, y: surf, life: 360 }); }
      }
    };
    carry(this.player); if (this.vsBot) carry(this.bot);
    for (const s of this.beachFx) s.life -= dt; this.beachFx = this.beachFx.filter((s) => s.life > 0);
  },

  // ===== BEACH: strandbal =====
  spawnBall(shooter, owner) {
    const dir = shooter.dir;
    this.ball = { mine: owner === 'me', owner, x: shooter.x + dir * 14, y: shooter.y - 16, vx: dir * 5.5, vy: -3, born: this.time, _cd: 0, _net: 0, grace: this.time + 250 };
    if (window.Sfx) Sfx.play('boing');
    if (owner === 'me' && window.Net && !this.vsBot) Net.versusSend('ball', { x: Math.round(this.ball.x), y: Math.round(this.ball.y), vx: +this.ball.vx.toFixed(2), vy: +this.ball.vy.toFixed(2) });
  },
  onVersusBall(p) {
    if (!p) return;
    if (!this.ball) { this.ball = { mine: false, owner: 'foe', born: this.time, grace: this.time }; if (window.Sfx) Sfx.play('boing'); }
    this.ball.mine = false; this.ball.x = p.x; this.ball.y = p.y; this.ball.vx = p.vx; this.ball.vy = p.vy;
  },
  explodeBall() {
    const b = this.ball; if (!b) return;
    for (let i = 0; i < 16; i++) this.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 4.5, (Math.random() - 0.5) * 4.5, (i % 2 ? '#ff5a3a' : '#ffd24a'), 420, 3));
    this.shake = Math.max(this.shake, 6);
    if (window.Sfx) Sfx.play('explos');
    this.ball = null;
  },
  updateBall(dt) {
    const b = this.ball; if (!b) return;
    if (this.time - b.born > BALL_LIFE) { this.explodeBall(); return; }   // 15s -> ontploft
    const sim = b.mine || this.vsBot;                                     // online: alleen de eigenaar simuleert
    if (!sim) return;
    const sc = this.dtScale;
    b.vy += 0.4 * sc; b.x += b.vx * sc; b.y += b.vy * sc;
    if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx) * 0.92; }
    if (b.x > this.vsMapW - 10) { b.x = this.vsMapW - 10; b.vx = -Math.abs(b.vx) * 0.92; }
    for (const pf of this.platforms) {
      if (pf.mast) continue;
      if (b.x > pf.x - pf.w / 2 - 6 && b.x < pf.x + pf.w / 2 + 6 && b.y > pf.y - 9 && b.y < pf.y + 7 && b.vy > 0) {
        b.y = pf.y - 9; b.vy = -Math.abs(b.vy) * 0.8; if (Math.abs(b.vy) < 2.2) b.vy = -4.5; b.vx *= 0.99;
      }
    }
    if (b.y > CONFIG.GROUND_Y - 2 && b.vy > 0) { b.y = CONFIG.GROUND_Y - 2; b.vy = -Math.abs(b.vy) * 0.8; }
    // treffers (na grace): beide spelers kunnen geraakt worden -> harde knockback
    if (this.time >= b.grace && this.time >= (b._cd || 0)) {
      const tryHit = (e, isMe) => {
        if (!e || e.dead || (isMe && e.respawnInvuln > 0)) return false;
        if (Math.abs(b.x - e.x) < 16 && Math.abs(b.y - (e.y - 14)) < 20) {
          const kd = b.x >= e.x ? 1 : -1;
          if (isMe) this.onVersusHit({ dir: kd, power: BALL_KNOCK, vy: -7, dmg: 6 });
          else if (this.vsBot) this.applyHitToBot(kd, BALL_KNOCK, -7, 6);
          else if (window.Net) Net.versusSend('hit', { dir: kd, power: BALL_KNOCK, vy: -7, dmg: 6 });
          b.vx = kd * Math.max(4.5, Math.abs(b.vx)); b.vy = -5; b._cd = this.time + 400;
          this.shake = Math.max(this.shake, 5);
          return true;
        }
        return false;
      };
      tryHit(this.player, true);
      tryHit(this.vsBot ? this.bot : this.vs.remote, false);
    }
    if (b.mine && !this.vsBot && window.Net) { b._net = (b._net || 0) + dt; if (b._net >= 70) { b._net = 0; Net.versusSend('ball', { x: Math.round(b.x), y: Math.round(b.y), vx: +b.vx.toFixed(2), vy: +b.vy.toFixed(2) }); } }
  },
  drawBall(ctx) {
    const b = this.ball; if (!b) return;
    const x = Math.round(b.x), y = Math.round(b.y), spin = Math.floor(this.time / 90) % 2;
    Sprites.px(ctx, '#ffffff', x - 5, y - 5, 10, 10);
    Sprites.px(ctx, '#e8483b', x - 5, y - 5, 10, 3);
    Sprites.px(ctx, '#3aa0e0', x - 5, y + 2, 10, 3);
    Sprites.px(ctx, '#f2c94c', x + (spin ? -2 : 0), y - 5, 2, 10);
    Sprites.px(ctx, '#2a8a3a', x + (spin ? 1 : 3), y - 5, 2, 10);
  },
  drawTideWater(ctx) {
    const v = this.tide; if (!v || v.level < 0.02) return;
    const W = this.vsMapW, surf = this.beachWaterY(), t = this.time;
    ctx.globalAlpha = 0.42; ctx.fillStyle = '#2f86c0';
    ctx.fillRect(0, surf, W, CONFIG.GROUND_Y + 60 - surf);
    ctx.globalAlpha = 0.6;
    for (let x = 0; x < W; x += 8) { const wob = Math.round(Math.sin(t / 180 + x * 0.12) * 2); Sprites.px(ctx, '#bfe6f5', x, surf - 1 + wob, 6, 2); }
    ctx.globalAlpha = 1;
    for (const s of this.beachFx) { ctx.globalAlpha = Math.max(0, s.life / 360); Sprites.px(ctx, '#eaffff', Math.round(s.x) - 2, Math.round(s.y) - 4, 4, 4); }
    ctx.globalAlpha = 1;
  },
  drawBeachBg(ctx) {
    const W = this.vsMapW, gy = CONFIG.GROUND_Y, t = this.time;
    // zon
    ctx.fillStyle = '#ffe79a'; ctx.beginPath(); ctx.arc(W - 52, 34, 15, 0, Math.PI * 2); ctx.fill();
    // vogels in de lucht (kleine bewegende V'tjes)
    ctx.strokeStyle = '#34506a'; ctx.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) {
      const bx = ((k * 110 + t * 0.018) % (W + 60)) - 30, by = 26 + (k % 2) * 18 + Math.sin(t / 260 + k) * 2, fl = 3 + Math.sin(t / 90 + k) * 1.5;
      ctx.beginPath(); ctx.moveTo(bx - 5, by + fl); ctx.lineTo(bx, by); ctx.lineTo(bx + 5, by + fl); ctx.stroke();
    }
    // zee (lager: horizon net onder de strand-hoogte)
    const horizon = gy - 8;
    ctx.fillStyle = '#3f9fd0'; ctx.fillRect(0, horizon, W, gy + 70 - horizon);
    ctx.fillStyle = '#56b0dd'; ctx.fillRect(0, horizon, W, 5);
    // eilandjes in de verte (op de horizon, achter de grond)
    const island = (ix, iw, ih) => {
      ctx.fillStyle = '#caa860'; ctx.beginPath(); ctx.moveTo(ix - iw, horizon + 1); ctx.quadraticCurveTo(ix, horizon - ih, ix + iw, horizon + 1); ctx.fill();
      ctx.fillStyle = '#3a7a4a'; ctx.beginPath(); ctx.moveTo(ix - iw * 0.55, horizon - ih * 0.35); ctx.quadraticCurveTo(ix, horizon - ih, ix + iw * 0.55, horizon - ih * 0.35); ctx.fill();
      Sprites.px(ctx, '#6b4a2a', ix - 1, horizon - ih - 4, 2, 5);              // palmstam
      Sprites.px(ctx, '#3a8a4a', ix - 5, horizon - ih - 6, 11, 3);            // palmblad
    };
    island(64, 22, 13); island(196, 28, 17); island(300, 20, 11);
    // bewegende golflijnen op de zee
    for (let r = 0; r < 3; r++) {
      ctx.globalAlpha = 0.45 - r * 0.1;
      for (let x = -8; x < W + 8; x += 16) { const wob = Math.round(Math.sin(t / 300 + x * 0.08 + r) * 2); Sprites.px(ctx, '#cdeaf7', x + ((t * (0.2 + r * 0.1)) % 16), horizon + 6 + r * 6 + wob, 8, 2); }
    }
    ctx.globalAlpha = 1;
  },

  updateSmash(dt) {
    const p = this.player;
    if (p._weaponUntil && this.time > p._weaponUntil) { p.meleeId = p.baseMelee || 'bat'; p.weaponId = p.rangedId || p.meleeId; p._weaponUntil = 0; p.swingWeapon = null; }
    // drops spawnen: host (online) of lokaal (bot)
    if (this.vsBot || this.vs.role === 'host') {
      this._dropTimer -= dt;
      if (this._dropTimer <= 0 && this.drops.length < 3) { this._dropTimer = SMASH_DROP_EVERY; this.spawnDrop(); }
    }
    // eigen speler pakt op (niet tijdens het vliegen in de heli)
    for (const d of this.drops) {
      if (d.taken || this.player.heli) continue;
      if (Math.abs(this.player.x - d.x) < 16 && Math.abs((this.player.y - 12) - d.y) < 22) {
        d.taken = true; this.applyDrop(this.player, d);
        if (window.Net && !this.vsBot) Net.versusSend('pickup', { id: d.id });
      }
    }
    // bot pakt op + wapen-timer
    if (this.vsBot && this.bot && !this.bot.dead) {
      for (const d of this.drops) {
        if (d.taken || d.kind === 'giant' || d.kind === 'heli' || d.kind === 'beachball' || d.kind === 'coco' || d.kind === 'boom' || d.kind === 'dart') continue;   // bot gebruikt deze niet
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
    // vallende stenen (steen-powerup, alleen Cave)
    this.updateRocks(dt);
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
    if (window.Sfx) Sfx.play('dragonfire');
    for (let i = 0; i < 10; i++)
      this.particles.push(new Particle(wx + (Math.random() - 0.5) * 10, wy - 12 + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 1.5, -Math.random() * 1.2, Math.random() < 0.5 ? '#ff7a2a' : '#ffd24a', 320, 2));
    this.shake = Math.max(this.shake, 4);
  },

  onVersusDragon() { this.spawnDragon('foe'); },

  // ---- CAVE: sfeer (bats/druppels) + knoppen + muur ----
  updateCave(dt) {
    const mapW = this.vsMapW;
    // vleermuizen
    if (!this.caveBats.length) for (let i = 0; i < 5; i++)
      this.caveBats.push({ x: Math.random() * mapW, y: -10 + Math.random() * 70, vx: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), ph: Math.random() * 6 });
    for (const bt of this.caveBats) { bt.x += bt.vx * this.dtScale; bt.ph += dt * 0.02; bt.y += Math.sin(bt.ph) * 0.4; if (bt.x < -14) bt.x = mapW + 14; else if (bt.x > mapW + 14) bt.x = -14; }
    // waterdruppels
    if (Math.random() < 0.04) this.caveDrips.push({ x: Math.random() * mapW, y: -16 + Math.random() * 24, vy: 0 });
    for (const dr of this.caveDrips) { dr.vy += 0.25 * this.dtScale; dr.y += dr.vy * this.dtScale; }
    this.caveDrips = this.caveDrips.filter((dr) => dr.y < this.vsFallY);

    // knop scherp maken (host/lokaal)
    if ((this.vsBot || this.vs.role === 'host') && this.caveArmed < 0 && !this.caveWall && this.time >= this._caveArmAt) {
      this.caveArmed = Math.floor(Math.random() * this.caveButtons.length);
      if (window.Net && !this.vsBot) Net.versusSend('cavearm', { idx: this.caveArmed });
    }
    // knop indrukken
    if (this.caveArmed >= 0) {
      const b = this.caveButtons[this.caveArmed];
      const near = (e) => e && !e.dead && Math.abs(e.x - b.x) < 13 && Math.abs(e.y - b.y) < 16;
      if (near(this.player)) this.pressCaveButton(true);
      else if (this.vsBot && near(this.bot)) this.pressCaveButton(false);
    }
    // straal sweept over de map: raakt 'ie je -> schade + harde knockback (presser is veilig)
    if (this.caveWall) {
      const wl = this.caveWall;
      wl.x += CAVE_WALL_SPEED * this.dtScale;
      const safe = (e) => e._beamSafeUntil && this.time < e._beamSafeUntil;
      const hitIt = (e) => e && !e.dead && e.respawnInvuln <= 0 && !safe(e) && Math.abs(wl.x - e.x) < 11;
      if (!wl.hitP && hitIt(this.player)) {
        wl.hitP = true;
        this.onVersusHit({ dir: (this.player.x >= wl.x ? 1 : -1), power: CAVE_BEAM_KNOCK, vy: -7, dmg: 0 });   // alleen knockback, geen schade
      }
      if (this.vsBot && !wl.hitB && hitIt(this.bot)) {
        wl.hitB = true;
        this.applyHitToBot(this.bot.x >= wl.x ? 1 : -1, CAVE_BEAM_KNOCK, -7, 0);
      }
      if (wl.x > mapW + 30) this.caveWall = null;
    }
  },

  pressCaveButton(byPlayer) {
    if (this.caveArmed < 0) return;
    (byPlayer ? this.player : this.bot)._beamSafeUntil = this.time + 2200;   // de presser zelf is veilig
    this.triggerCaveWall();
    if (window.Net && !this.vsBot && byPlayer) Net.versusSend('cavewall', {});
  },
  triggerCaveWall() {
    this.caveWall = { x: -30, hitP: false, hitB: false };
    this.caveArmed = -1;
    this._caveArmAt = this.time + CAVE_ARM_MS;
    this.shake = Math.max(this.shake, 5);
    if (window.Sfx) Sfx.play('beam');
  },
  onCaveArm(p) { if (!this.caveWall) this.caveArmed = (p && typeof p.idx === 'number') ? p.idx : -1; },
  onCaveWall() { this.triggerCaveWall(); },

  // bliksem-effect op een doel (wereldpositie)
  strikeLightning(wx, wy) {
    this.lightningFx = { wx, wy, until: this.time + 450 };
    if (window.Sfx) Sfx.play('zap');
    for (let i = 0; i < 14; i++) this.particles.push(new Particle(wx + (Math.random() - 0.5) * 12, wy - 14 + (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 2, -Math.random() * 1.5, Math.random() < 0.5 ? '#9fe0ff' : '#4aa6ff', 360, 2));
    this.shake = Math.max(this.shake, 7);
  },
  // de tegenstander stunde MIJ (online) -> mezelf stunnen + bliksem tonen
  onVersusStun() {
    if (this.player.respawnInvuln <= 0 && !this.player.dead) this.player.stunUntil = this.time + SMASH_LIGHTNING_STUN;
    this.strikeLightning(this.player.x, this.player.y);
  },

  // ---- VULCAN: lavastraal + sfeer ----
  updateVulcan(dt) {
    const v = this.vulcan; if (!v) return;
    const mapW = this.vsMapW;
    // rook (stijgt op)
    if (Math.random() < 0.06) this.vulcanSmoke.push({ x: Math.random() * mapW, y: this.vsFallY - 6, vy: -(0.3 + Math.random() * 0.5), life: 2600 });
    for (const s of this.vulcanSmoke) { s.x += 0.2 * this.dtScale; s.y += s.vy * this.dtScale; s.life -= dt; }
    this.vulcanSmoke = this.vulcanSmoke.filter((s) => s.life > 0);
    // achtergrond-uitbarstingen (kleine lavaspatten ver weg)
    if (Math.random() < 0.014) this.vulcanBg.push({ x: 60 + Math.random() * (mapW - 120), y: this.vsFallY - 24, vy: -(1.6 + Math.random() * 1.6), life: 950 });
    for (const b of this.vulcanBg) { b.vy += 0.06 * this.dtScale; b.y += b.vy * this.dtScale; b.life -= dt; }
    this.vulcanBg = this.vulcanBg.filter((b) => b.life > 0);

    // toestand: host/lokaal stuurt, gast krijgt 'lava'
    if (this.vsBot || this.vs.role === 'host') {
      if (v.state === 'idle' && this.time >= v.nextAt) { this._vulcanPhase('bubble'); if (window.Net && !this.vsBot) Net.versusSend('lava', { ph: 'bubble' }); }
      else if (v.state === 'bubble' && this.time >= v.nextAt) { this._vulcanPhase('erupt'); if (window.Net && !this.vsBot) Net.versusSend('lava', { ph: 'erupt' }); }
      else if (v.state === 'erupt' && this.time >= v.nextAt) { this._vulcanPhase('idle'); if (window.Net && !this.vsBot) Net.versusSend('lava', { ph: 'idle' }); }
    } else if ((v.state === 'bubble' || v.state === 'erupt') && this.time >= v.nextAt + 600) {
      this._vulcanPhase('idle');     // gast-vangnet: trek de straal zelf in als de 'idle' niet aankwam
    }
    // lavastraal raakt spelers in de kolom -> hoog gelanceerd + 3s burn
    if (v.state === 'erupt') {
      const inJet = (e) => e && !e.dead && e.respawnInvuln <= 0 && Math.abs(e.x - v.x) < 18;
      if (!v.hitP && inJet(this.player)) { v.hitP = true; this.player.vy = -18; this.player.onGround = false; this.player.burnUntil = this.time + 3000; this.shake = Math.max(this.shake, 8); }
      if (this.vsBot && !v.hitB && inJet(this.bot)) { v.hitB = true; this.bot.vy = -18; this.bot.onGround = false; this.bot.burnUntil = this.time + 3000; }
      // vonken
      if (this.particles.length < 240) for (let i = 0; i < 2; i++) this.particles.push(new Particle(v.x + (Math.random() - 0.5) * 14, this.vsFallY - Math.random() * 120, (Math.random() - 0.5) * 1.2, -2 - Math.random() * 2, Math.random() < 0.5 ? '#ff7a2a' : '#ffd24a', 360, 2));
    }
  },
  _vulcanPhase(state) {
    const v = this.vulcan; v.state = state;
    if (state === 'bubble') v.nextAt = this.time + VULCAN_BUBBLE;
    else if (state === 'erupt') { v.nextAt = this.time + VULCAN_ERUPT; v.hitP = false; v.hitB = false; this.shake = Math.max(this.shake, 6); if (window.Sfx) Sfx.play('lava'); }
    else v.nextAt = this.time + VULCAN_EVERY;
  },
  onVersusLava(p) { if (this.vulcan && p && p.ph) this._vulcanPhase(p.ph); },

  // ---- PIRATE: zeemonster-tentakel ----
  updatePirate(dt) {
    const v = this.tentacle; if (!v) return;
    const W = this.vsMapW;
    if (this.vsBot || this.vs.role === 'host') {
      if (v.state === 'idle' && this.time >= v.nextAt) {
        const target = (Math.random() < 0.5) ? this.player : (this.vsBot ? this.bot : this.vs.remote);
        v.x = Math.max(70, Math.min(W - 70, Math.round(((target && target.x) || 360) + (Math.random() - 0.5) * 40)));
        v.mode = Math.random() < 0.5 ? 'flat' : 'knock';
        this._tentPhase('warn');
        if (window.Net && !this.vsBot) Net.versusSend('tentacle', { x: v.x, mode: v.mode, ph: 'warn' });
      } else if (v.state === 'warn' && this.time >= v.nextAt) {
        this._tentPhase('strike');
        if (window.Net && !this.vsBot) Net.versusSend('tentacle', { x: v.x, mode: v.mode, ph: 'strike' });
      } else if (v.state === 'strike' && this.time >= v.nextAt) { this._tentPhase('idle'); if (window.Net && !this.vsBot) Net.versusSend('tentacle', { ph: 'idle' }); }
    } else if ((v.state === 'warn' || v.state === 'strike') && this.time >= v.nextAt + 600) {
      this._tentPhase('idle');         // gast-vangnet: trek de tentakel zelf in als de 'idle' niet aankwam
    }
    if (v.state === 'strike') {
      const hit = (e) => e && !e.dead && e.respawnInvuln <= 0 && Math.abs(e.x - v.x) < 22;
      if (!v.hitP && hit(this.player)) { v.hitP = true; this._tentHit(this.player); }
      if (this.vsBot && !v.hitB && hit(this.bot)) { v.hitB = true; this._tentHit(this.bot); }
    }
  },
  _tentPhase(state) {
    const v = this.tentacle; v.state = state;
    if (state === 'warn') v.nextAt = this.time + PIRATE_TENT_WARN;
    else if (state === 'strike') { v.nextAt = this.time + PIRATE_TENT_STRIKE; v.hitP = false; v.hitB = false; this.shake = Math.max(this.shake, 6); if (window.Sfx) Sfx.play('monster'); }
    else v.nextAt = this.time + PIRATE_TENT_EVERY;
  },
  _tentHit(e) {
    if (this.tentacle.mode === 'flat') { e.flatUntil = this.time + SMASH_ROCK_FLAT; }     // platgeslagen (2s)
    else { const dir = e.x < this.tentacle.x ? -1 : 1; e.knockVx = dir * 30; e.vy = -7; e.onGround = false; }   // van de boot af
    this.shake = Math.max(this.shake, 8);
    for (let i = 0; i < 12; i++) this.particles.push(new Particle(e.x, e.y - 12, (Math.random() - 0.5) * 3, -Math.random() * 2, Math.random() < 0.5 ? '#3aa86a' : '#7fe0a0', 340, 2));
  },
  onVersusTentacle(p) {
    if (!this.tentacle || !p) return;
    if (p.x != null) this.tentacle.x = p.x;
    if (p.mode) this.tentacle.mode = p.mode;
    if (p.ph) this._tentPhase(p.ph);
  },

  // ---- JUNGLE: gorilla in de kooi ----
  _inCage(e) {
    const cg = this.jungleCage; if (!cg || !e || e.dead) return false;
    return Math.abs(e.x - cg.x) < cg.w / 2 + 6 && e.y > cg.floorY - 44 && e.y < cg.floorY + 12;
  },
  updateGorilla(dt) {
    const g = this.gorilla, cg = this.jungleCage; if (!g || !cg) return;
    if (g.hitFlash > 0) g.hitFlash -= dt;
    const host = this.vsBot || this.vs.role === 'host';
    if (!g.alive) return;                            // dood = weg voor de rest van het potje
    // doelwit: een speler die IN de kooi staat
    let target = this._inCage(this.player) ? this.player : (this.vsBot ? (this._inCage(this.bot) ? this.bot : null) : (this._inCage(this.vs.remote) ? this.vs.remote : null));
    if (host) {
      if (target) {
        g.dir = target.x >= g.x ? 1 : -1;
        if (Math.abs(target.x - g.x) > 14) g.x += g.dir * 0.5 * this.dtScale;
        g.x = Math.max(cg.x - cg.w / 2 + 12, Math.min(cg.x + cg.w / 2 - 12, g.x));
        if (this.time >= g.swipeCd && Math.abs(target.x - g.x) < GORILLA_REACH && Math.abs(target.y - g.y) < 38) {
          g.swipeCd = this.time + GORILLA_SWIPE_CD; g.swipeUntil = this.time + 260; g.state = 'swipe'; g._hitDone = false; this.shake = Math.max(this.shake, 5); if (window.Sfx) Sfx.play('gorilla');
        }
      }
      if (g.state === 'swipe' && this.time < g.swipeUntil && !g._hitDone) {
        g._hitDone = true;
        const kd = (t) => t.x >= g.x ? 1 : -1;
        // gorilla geeft GEEN knockback, alleen schade (power 0)
        if (this._inCage(this.player) && Math.abs(this.player.x - g.x) < GORILLA_REACH && this.player.respawnInvuln <= 0) this.onVersusHit({ dir: kd(this.player), power: 0, vy: 0, dmg: 18 });
        if (this.vsBot) { if (this._inCage(this.bot) && Math.abs(this.bot.x - g.x) < GORILLA_REACH) this.applyHitToBot(kd(this.bot), 0, 0, 18); }
        else if (this._inCage(this.vs.remote) && Math.abs(this.vs.remote.x - g.x) < GORILLA_REACH && window.Net) Net.versusSend('hit', { dir: kd(this.vs.remote), power: 0, vy: 0, dmg: 18 });
      }
      if (g.state === 'swipe' && this.time >= g.swipeUntil) g.state = 'idle';
      g._net += dt; if (g._net >= 100) { g._net = 0; this._broadcastGorilla(); }
    }
  },
  _broadcastGorilla() {
    if (window.Net && !this.vsBot && this.gorilla) Net.versusSend('gorilla', { x: Math.round(this.gorilla.x), hp: this.gorilla.hp, al: this.gorilla.alive ? 1 : 0, st: this.gorilla.state, d: this.gorilla.dir });
  },
  onVersusGorilla(p) {
    const g = this.gorilla; if (!g || !p) return;
    if (typeof p.x === 'number') g.x = p.x;
    if (typeof p.hp === 'number') g.hp = p.hp;
    g.alive = p.al !== 0; g.state = p.st || 'idle'; g.dir = p.d || -1;
  },
  // schade aan de gorilla (door een mep/kogel van de SPELER)
  hitGorilla(dmg) {
    const g = this.gorilla; if (!g || !g.alive) return;
    const lethal = (g.hp - dmg) <= 0;
    if (lethal) { this.player.hp = this.player.maxHp; this.spawnMonkey(true); }   // beloning: vol leven + helper-aapje
    g.hitFlash = 120;
    if (this.vsBot || this.vs.role === 'host') { g.hp -= dmg; if (g.hp <= 0) this._gorillaDie(); this._broadcastGorilla(); }
    else { if (window.Net) Net.versusSend('gorhit', { dmg }); if (lethal) { g.alive = false; g.state = 'dead'; } }
    for (let i = 0; i < 5; i++) this.particles.push(new Particle(g.x + (Math.random() - 0.5) * 16, g.y - 18, (Math.random() - 0.5) * 2, -Math.random() * 2, '#a33', 320, 2));
  },
  onVersusGorhit(p) {
    const g = this.gorilla; if (!g || !g.alive) return;
    if (this.vsBot || this.vs.role === 'host') { g.hp -= (p && p.dmg || 0); g.hitFlash = 120; if (g.hp <= 0) this._gorillaDie(); this._broadcastGorilla(); }
  },
  _gorillaDie() {
    const g = this.gorilla; g.alive = false; g.hp = 0; g.state = 'dead'; g.respawnAt = this.time + GORILLA_RESPAWN;
    this.shake = Math.max(this.shake, 9);
    if (this.player) this.player._caged = false;
    if (this.bot) this.bot._caged = false;
    for (let i = 0; i < 18; i++) this.particles.push(new Particle(g.x, g.y - 16, (Math.random() - 0.5) * 4, -Math.random() * 3, Math.random() < 0.5 ? '#5a3d22' : '#3a2615', 420, 3));
  },

  // opgesloten in de kooi tot de gorilla dood is (tralies dicht)
  confineCage(e) {
    const g = this.gorilla, cg = this.jungleCage; if (!g || !cg || !e || e.dead) return;
    if (!g.alive) { e._caged = false; return; }
    if (e.giant) {                                   // reus mag niet in de kooi -> gorilla mept 'm er meteen uit
      if (this._inCage(e)) {
        const side = e.x >= cg.x ? 1 : -1;
        e.x = cg.x + side * (cg.w / 2 + 18);
        e.knockVx = side * 12; e.vy = Math.min(e.vy, -5); e._caged = false;
        this.shake = Math.max(this.shake, 5);
      }
      return;
    }
    if (this._inCage(e)) e._caged = true;
    if (e._caged) {
      e.x = Math.max(cg.x - cg.w / 2 + 10, Math.min(cg.x + cg.w / 2 - 10, e.x));
      if (e.y < cg.top + 16) { e.y = cg.top + 16; if (e.vy < 0) e.vy = 0; }   // plafond: kun je er niet uit
    }
  },
  // de reus (Giant): bots iemand weg of stampt 'm (op iemand springen = schade)
  giantContact(dt) {
    const p = this.player; if (!p.giant || p.dead) return;
    const opp = this.vsBot ? this.bot : this.vs.remote;
    const oppDead = this.vsBot ? (!opp || opp.dead) : (!opp || opp.alive === false);
    if (oppDead) return;
    const dxp = opp.x - p.x;
    // reus is enorm -> ook ruim verticaal bereik (kan iemand die aan een liaan slingert raken)
    if (Math.abs(dxp) < 38 && (opp.y - p.y) < 12 && (p.y - opp.y) < 60 && this.time >= (p._giantHitCd || 0)) {
      p._giantHitCd = this.time + 200;
      const stomp = p.vy > 2 && p.y < opp.y - 4;          // op iemand springen = schade
      const kd = dxp >= 0 ? 1 : -1;                        // weg van de reus = naar achter
      if (this.vsBot) this.applyHitToBot(kd, stomp ? 22 : 28, stomp ? -6 : -3, stomp ? 24 : 0);
      else if (window.Net) Net.versusSend('hit', { dir: kd, power: stomp ? 22 : 28, vy: stomp ? -6 : -3, dmg: stomp ? 24 : 0 });
      if (window.Sfx) Sfx.play('stomp');
      this.shake = Math.max(this.shake, 4);
    }
  },

  // helper-aapje (beloning voor wie de gorilla doodt): vecht mee tegen de tegenstander, heel het potje
  spawnMonkey(mine) {
    this.monkey = { mine: !!mine, x: this.player.x - this.player.dir * 16, y: this.player.y - 18, dir: this.player.dir, atkCd: this.time + 700, _net: 0 };
    if (mine && !this.vsBot && window.Net) Net.versusSend('monkey', { x: Math.round(this.monkey.x), y: Math.round(this.monkey.y), d: this.monkey.dir });
    for (let i = 0; i < 10; i++) this.particles.push(new Particle(this.monkey.x, this.monkey.y, (Math.random() - 0.5) * 3, -Math.random() * 3, '#caa06a', 380, 2));
  },
  updateMonkey(dt) {
    const m = this.monkey; if (!m || !m.mine) return;     // het aapje van de tegenstander komt via sync binnen
    const owner = this.player;
    const opp = this.vsBot ? this.bot : this.vs.remote;
    const oppDead = this.vsBot ? (!opp || opp.dead) : (!opp || opp.alive === false);
    // standaard: dicht bij de eigenaar blijven. Alleen op de tegenstander af als die in de buurt komt.
    let tx = owner.x - owner.dir * 16, ty = owner.y - 18;
    const oppNear = !oppDead && Math.abs(opp.x - owner.x) < 90 && Math.abs(opp.y - owner.y) < 60;
    if (oppNear) { tx = opp.x - Math.sign(opp.x - m.x || 1) * 12; ty = opp.y - 14; }
    m.x += Math.max(-3.2, Math.min(3.2, (tx - m.x) * 0.16));
    m.y += Math.max(-3.2, Math.min(3.2, (ty - m.y) * 0.16));
    if (Math.abs(tx - m.x) > 2) m.dir = tx >= m.x ? 1 : -1;
    if (oppNear && Math.abs(opp.x - m.x) < 18 && Math.abs(opp.y - m.y) < 22 && this.time >= (m.atkCd || 0) && (!this.vsBot || opp.respawnInvuln <= 0)) {
      m.atkCd = this.time + 850;
      if (window.Sfx) Sfx.play('monkey');
      const kd = opp.x >= m.x ? 1 : -1;
      if (this.vsBot) this.applyHitToBot(kd, 6, -3, 8);
      else if (window.Net) Net.versusSend('hit', { dir: kd, power: 6, vy: -3, dmg: 8 });
      for (let i = 0; i < 3; i++) this.particles.push(new Particle(opp.x, opp.y - 14, (Math.random() - 0.5) * 2, -Math.random() * 2, '#fff', 220, 2));
    }
    if (!this.vsBot && window.Net) { m._net += dt; if (m._net >= 80) { m._net = 0; Net.versusSend('monkey', { x: Math.round(m.x), y: Math.round(m.y), d: m.dir }); } }
  },
  onVersusMonkey(p) {
    if (!p) return;
    if (!this.monkey) this.monkey = { mine: false, x: p.x, y: p.y, dir: p.d || 1, atkCd: 0 };
    if (!this.monkey.mine) { this.monkey.x = p.x; this.monkey.y = p.y; this.monkey.dir = p.d || 1; }
  },
  drawMonkey(ctx) {
    const m = this.monkey; if (!m) return;
    const x = Math.round(m.x), y = Math.round(m.y), s = m.dir;
    const fur = '#8a5e34', furDk = '#5e3f22';
    const sw = Math.round(Math.sin(this.time / 90) * 2);
    Sprites.px(ctx, furDk, x - s * 7, y - 6, s * 3, 2);    // staart
    Sprites.px(ctx, fur, x - 5, y - 10, 10, 12);           // lijf
    Sprites.px(ctx, furDk, x - 5, y - 10, 3, 12);
    Sprites.px(ctx, '#d8b48a', x - 3, y - 6, 6, 6);        // buik
    Sprites.px(ctx, fur, x - 8, y - 16, 3, 3); Sprites.px(ctx, fur, x + 5, y - 16, 3, 3);   // oortjes
    Sprites.px(ctx, fur, x - 5, y - 17, 10, 9);            // kop
    Sprites.px(ctx, '#d8b48a', x - 3, y - 13, 6, 4);       // snuit
    Sprites.px(ctx, '#000', x - 3, y - 15, 2, 2); Sprites.px(ctx, '#000', x + 1, y - 15, 2, 2);   // ogen
    Sprites.px(ctx, fur, x + s * 5, y - 8 + sw, s * 4, 3); // zwaaiend armpje
  },

  // ---- steen-powerup: 3 grote stenen vallen -> geraakt = 2s platgedrukt ----
  rockTargetXs(centerX) {
    const xs = [centerX + (Math.random() - 0.5) * 20];     // 1 steen gericht op het doel
    for (let i = 1; i < SMASH_ROCK_COUNT; i++) xs.push(centerX + (Math.random() - 0.5) * 2 * SMASH_ROCK_SPREAD);
    return xs.map((x) => Math.max(20, Math.min(this.vsMapW - 20, Math.round(x))));
  },
  castRocks(xs) {
    if (!this.rocks) this.rocks = [];
    const top = (this.vsMap && this.vsMap.camTop) || 0;
    for (const x of xs) this.rocks.push({ x, y: top - 50 - Math.random() * 50, vy: 0, dead: false });
  },
  onVersusRocks(p) { if (p && p.xs) this.castRocks(p.xs); },
  updateRocks(dt) {
    if (!this.rocks || !this.rocks.length) return;
    for (const rk of this.rocks) {
      rk.vy += 0.5 * this.dtScale; rk.y += rk.vy * this.dtScale;
      const hit = (e) => e && !e.dead && e.respawnInvuln <= 0 && Math.abs(rk.x - e.x) < 17 && rk.y > e.y - 30 && rk.y < e.y + 6;
      if (hit(this.player)) { rk.dead = true; this.player.flatUntil = this.time + SMASH_ROCK_FLAT; this.rockSmash(rk.x, this.player.y); }
      else if (this.vsBot && hit(this.bot)) { rk.dead = true; this.bot.flatUntil = this.time + SMASH_ROCK_FLAT; this.rockSmash(rk.x, this.bot.y); }
      else if (rk.y > this.vsFallY) { rk.dead = true; this.rockSmash(rk.x, CONFIG.GROUND_Y); }
    }
    this.rocks = this.rocks.filter((rk) => !rk.dead);
  },
  rockSmash(x, y) {
    for (let i = 0; i < 12; i++) this.particles.push(new Particle(x + (Math.random() - 0.5) * 16, y, (Math.random() - 0.5) * 3, -Math.random() * 1.8, Math.random() < 0.5 ? '#7a6a58' : '#9a8a74', 340, 2));
    this.shake = Math.max(this.shake, 6);
  },

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
    let pool = SMASH_DROPS.slice();
    const mid = this.vsMap && this.vsMap.id;
    if (this.journeyDrops) {
      // Journey: eigen basis (geen smash-projectielen) + de NIEUWE eiland-powerups van dit level
      pool = [{ kind: 'weapon', w: 30 }, { kind: 'health', w: 20 }, { kind: 'rage', w: 8 }, { kind: 'speed', w: 8 }];
      for (const k of this.journeyDrops) pool.push({ kind: k, w: 11 });
    } else {
      if (mid === 'cave' || mid === 'sky') pool.push({ kind: 'lightning', w: 8 });   // bliksem op Cave + Sky
      if (mid === 'cave') pool.push({ kind: 'rock', w: 8 });                          // steen alleen op Cave
      if (mid === 'pirate') pool.push({ kind: 'cannon', w: 9 });                      // kanonskogel alleen op Pirate Ship
      if (mid === 'pirate' || mid === 'sky') pool.push({ kind: 'shield', w: 9 });     // shield op Pirate + Sky
      if (mid === 'sky' || mid === 'lava') pool.push({ kind: 'heli', w: 6 });          // gevechtsheli op Sky + Volcano
      if (mid === 'beach') pool.push({ kind: 'beachball', w: 10 });                     // strandbal op Beach
      if (mid === 'jungle') { pool.push({ kind: 'giant', w: 6 }); pool.push({ kind: 'ak47', w: 9 }); }  // Giant + AK47 op Jungle
      if (mid === 'dohyo') {                                                          // Dohyo: ALLE power-ups
        pool.push({ kind: 'lightning', w: 8 }); pool.push({ kind: 'rock', w: 8 }); pool.push({ kind: 'cannon', w: 9 });
        pool.push({ kind: 'shield', w: 9 }); pool.push({ kind: 'giant', w: 6 }); pool.push({ kind: 'ak47', w: 9 });
      }
    }
    let tot = 0; for (const d of pool) tot += d.w;
    let r = Math.random() * tot, kind = 'health';
    for (const d of pool) { r -= d.w; if (r <= 0) { kind = d.kind; break; } }
    const pf = this.platforms[Math.floor(Math.random() * this.platforms.length)] || { x: 180, y: 140, w: 60 };
    const x = Math.round(pf.x + (Math.random() - 0.5) * Math.max(8, pf.w - 16));
    const y = Math.round(pf.y - 9);
    const wid = kind === 'weapon' ? SMASH_WEAPON_POOL[Math.floor(Math.random() * SMASH_WEAPON_POOL.length)] : 0;
    const id = this._dropId++;
    this.drops.push({ id, kind, x, y, wid, born: this.time, taken: false });
    if (window.Net && !this.vsBot) Net.versusSend('drop', { id, kind, x, y, wid });
  },

  applyDrop(pl, d) {
    if (window.Sfx && pl === this.player) Sfx.play('pickup');
    for (let i = 0; i < 8; i++) this.particles.push(new Particle(d.x, d.y, (Math.random() - 0.5) * 2, -Math.random() * 2, '#ffe27a', 340, 2));
    // een ander vuurwapen pakken vervangt de AK47
    if (d.kind === 'fireball' || d.kind === 'rocket' || d.kind === 'cannon' || d.kind === 'giant') { pl.gunAmmo = 0; if (pl.rangedId === 'ak47') pl.rangedId = null; }
    if (d.kind === 'weapon') { pl.meleeId = d.wid; pl.weaponId = pl.rangedId || d.wid; pl._weaponUntil = this.time + SMASH_WEAPON_TIME; }
    else if (d.kind === 'giant') {                                    // REUS: gigantisch, dubbel leven, kan niet aanvallen
      pl._baseMaxHp = pl._baseMaxHp || pl.maxHp;
      pl.giant = true; pl.maxHp = pl._baseMaxHp * 2; pl.hp = pl.maxHp;
      pl.fireballs = 0; pl.smashRockets = 0; pl.cannon = 0; pl.gunAmmo = 0; pl.rangedId = null;
      for (let i = 0; i < 14; i++) this.particles.push(new Particle(pl.x, pl.y - 14, (Math.random() - 0.5) * 3, -Math.random() * 3, '#7affa0', 420, 3));
    }
    else if (d.kind === 'ak47') { pl.rangedId = 'ak47'; pl.gunAmmo = 50; pl.weaponId = 'ak47'; }   // AK47 met 50 kogels
    else if (d.kind === 'fireball') pl.fireballs = SMASH_FIREBALL_SHOTS;
    else if (d.kind === 'rocket') pl.smashRockets = SMASH_ROCKETS;
    else if (d.kind === 'health') pl.hp = Math.min(pl.maxHp, pl.hp + 40);
    else if (d.kind === 'rage') pl.buffs.rage = this.time + POWERUPS.rage.dur;
    else if (d.kind === 'speed') pl.buffs.speed = this.time + POWERUPS.speed.dur;
    else if (d.kind === 'dragon') {
      if (pl === this.player) { this.spawnDragon('me'); if (window.Net && !this.vsBot) Net.versusSend('dragon', {}); }
      else { this.spawnDragon('bot'); }
    }
    else if (d.kind === 'lightning') {
      if (pl === this.player) {
        if (this.vsBot) { if (this.bot && this.bot.respawnInvuln <= 0 && !this.bot.dead) { this.bot.stunUntil = this.time + SMASH_LIGHTNING_STUN; this.strikeLightning(this.bot.x, this.bot.y); } }
        else { if (window.Net) Net.versusSend('stun', {}); const r = this.vs.remote; this.strikeLightning(r.x, r.y); }
      } else {                                   // bot pakte de bliksem -> stun de speler
        if (this.player.respawnInvuln <= 0 && !this.player.dead) { this.player.stunUntil = this.time + SMASH_LIGHTNING_STUN; this.strikeLightning(this.player.x, this.player.y); }
      }
    }
    else if (d.kind === 'rock') {
      if (pl === this.player) {
        const tx = this.vsBot ? (this.bot ? this.bot.x : pl.x) : this.vs.remote.x;
        const xs = this.rockTargetXs(tx); this.castRocks(xs);
        if (window.Net && !this.vsBot) Net.versusSend('rocks', { xs });
      } else { const xs = this.rockTargetXs(this.player.x); this.castRocks(xs); }   // bot pakte de steen
    }
    else if (d.kind === 'beachball') { pl.beachball = 1; }                          // strandbal (1 schot)
    else if (d.kind === 'coco') { pl.coco = COCO_AMMO; }                            // kokosbom
    else if (d.kind === 'boom') { pl.boomerang = BOOM_AMMO; }                       // boemerang
    else if (d.kind === 'dart') { pl.dart = DART_AMMO; }                            // gifdart
    else if (d.kind === 'cannon') { pl.cannon = (pl.cannon || 0) + 1; }            // 1 kanonskogel
    else if (d.kind === 'shield') { pl.shieldHp = SMASH_SHIELD; }                  // +50 hp schild
    else if (d.kind === 'heli') {                                                  // gevechtsheli: instappen
      pl.heli = true; pl.heliMinigun = HELI_MINIGUN; pl.heliRockets = HELI_ROCKETS;
      pl._heliFireCd = 0; pl._heliRocketCd = 0;
      pl.fireballs = 0; pl.smashRockets = 0; pl.cannon = 0; pl.gunAmmo = 0; pl.rangedId = null;
      pl.vy = 0; pl.onGround = false; pl.y -= 18;                                  // even opstijgen
      for (let i = 0; i < 14; i++) this.particles.push(new Particle(pl.x, pl.y + 6, (Math.random() - 0.5) * 3, Math.random() * 2, '#cfd6df', 360, 2));
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
    if (window.Sfx) Sfx.play((msg && msg.indexOf('JIJ') === 0) ? 'roundwin' : 'roundlose');
    this.dragons = [];                                  // draken stoppen bij rondewissel
    this.rocks = [];
    this.caveWall = null; this.caveArmed = -1; this._caveArmAt = this.time + CAVE_ARM_MS;
    if (this.vulcan) { this.vulcan.state = 'idle'; this.vulcan.nextAt = this.time + VULCAN_EVERY; }
    if (this.tentacle) { this.tentacle.state = 'idle'; this.tentacle.nextAt = this.time + PIRATE_TENT_EVERY; }
    if (this.tide) { this.tide.state = 'idle'; this.tide.level = 0; this.tide.nextAt = this.time + BEACH_TIDE_EVERY; }
    this.ball = null;
    this.shake = Math.max(this.shake, 7);
  },

  checkVersusHit() {
    const p = this.player, r = this.vs.remote;
    if (p.giant || p.heli) return;                    // reus/heli gebruiken geen melee-swing
    if (!r.alive) return;
    // alleen op het moment dat een NIEUWE mep begint (1 mep = 1 treffer)
    const sw = p.swingUntil || 0;
    if (sw && sw !== this.vs.lastSwing && this.time < sw) {
      this.vs.lastSwing = sw;
      const reach = 40;                              // ruime melee-reach in versus
      const dx = (r.x - p.x) * p.dir;
      const close = Math.abs(r.x - p.x) < 24;        // bijna in elkaar -> altijd raak (ook als je net de andere kant op kijkt)
      if ((close || (dx > -16 && dx < reach)) && Math.abs(r.y - p.y) < 34) {
        const kdir = (r.x >= p.x ? 1 : -1);
        // combo: opeenvolgende treffers binnen het venster -> hoger (x1..x5), meer schade
        p.combo = (this.time < (p.comboUntil || 0)) ? Math.min(COMBO_MAX, (p.combo || 0) + 1) : 1;
        p.comboUntil = this.time + COMBO_WINDOW;
        const wd = (WEAPONS[p.meleeId] ? WEAPONS[p.meleeId].damage : 34) * (p.meleeMul || 1) * (p.hasBuff('rage', this.time) ? 1.6 : 1) * comboMul(p.combo);
        const dmg = Math.round(wd * 0.45);                            // versus-melee-schade
        const kp = 15 + Math.max(0, p.combo - 1) * 8;                 // vanaf x2 fors meer knockback (x1=15 .. x5=47)
        const kvy = -5.5 - Math.max(0, p.combo - 1) * 0.7;            // en iets meer omhoog
        if (this.vsBot) this.applyHitToBot(kdir, kp, kvy, dmg);       // bot wegslaan + schade
        else Net.versusSend('hit', { dir: p.dir, power: kp, vy: kvy, dmg: dmg });
        // combo-XP (alleen online — geen XP-farmen tegen de bot)
        const cx = comboXp(p.combo);
        p._lastComboXp = this.vsBot ? 0 : cx;
        if (!this.vsBot) this._comboXp = (this._comboXp || 0) + cx;
        this.spawnBlood(r.x, r.y - 16);
        if (window.Sfx) Sfx.play('hit');
        this.shake = Math.max(this.shake, 6);
      }
      // mep raakt ook de kooi-gorilla (Jungle)
      const g = this.gorilla;
      if (g && g.alive) {
        const gdx = (g.x - p.x) * p.dir;
        if (gdx > -10 && gdx < reach && Math.abs(g.y - p.y) < 38) {
          const gwd = (WEAPONS[p.meleeId] ? WEAPONS[p.meleeId].damage : 34) * (p.meleeMul || 1) * (p.hasBuff('rage', this.time) ? 1.6 : 1);
          this.hitGorilla(Math.round(gwd * 0.45));
        }
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
    r.stunned = b.stunUntil && this.time < b.stunUntil;
    r.flat = b.flatUntil && this.time < b.flatUntil;
    r.rage = b.hasBuff('rage', this.time); r.burn = b.burnUntil > this.time;
    r.shieldHp = b.shieldHp || 0; r.giant = !!b.giant; r.heli = !!b.heli;
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
        b._shootCd = this.time + ((this.botCfg && this.botCfg.shootCd) || 1100);
      } else if (this.vsMode === 'smash' && b.fireballs > 0) {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 7.5, 0, 0); bl.kind = 'fire'; bl.hitDmg = 22; bl.power = 14;
        b.fireballs--; b._shootCd = this.time + 600;
      } else if (this.vsMode === 'smash' && b.smashRockets > 0) {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 6, 0, 0); bl.kind = 'rocket'; bl.hitDmg = 40; bl.power = 26;
        b.smashRockets--; b._shootCd = this.time + 950;
      } else if (this.vsMode === 'smash' && b.cannon > 0) {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 8, 0, 0); bl.kind = 'cannon'; bl.hitDmg = 18; bl.power = 42;
        b.cannon--; b._shootCd = this.time + 900;
      } else if (this.vsMode === 'smash' && b.gunAmmo > 0 && b.rangedId === 'ak47') {
        bl = new Bullet(b.x + sdir * 14, b.y - 16, sdir * 9, 0, 0); bl.kind = 'gun'; bl.hitDmg = 13; bl.power = 7;
        b.gunAmmo--; b._shootCd = this.time + 220;
        if (b.gunAmmo <= 0) { b.rangedId = null; b.weaponId = b.meleeId || 'bat'; }
      }
      if (bl) { b.dir = sdir; this.botBullets.push(bl); this.spawnMuzzleFlash(b.x + sdir * 14, b.y - 16, sdir); if (window.Sfx) Sfx.play(bl.kind === 'cannon' ? 'cannon' : bl.kind === 'rocket' ? 'rocket' : bl.kind === 'fire' ? 'fireball' : 'gun'); }
    }
    // bot-kogels bewegen + de speler raken
    if (this.botBullets && this.botBullets.length) {
      for (const bl of this.botBullets) {
        if ((bl.kind === 'fire' || bl.kind === 'rocket') && !this.player.dead && this.player.respawnInvuln <= 0) {
          if (this.player.heli && Math.sign(this.player.x - bl.x) === Math.sign(bl.vx)) this._homeBullet(bl, this.player.x, this.player.y - 12, bl.kind === 'rocket' ? 6 : 7.5);
          else this._softAim(bl, this.player);
        }
        bl.x += bl.vx * this.dtScale; bl.y += (bl.vy || 0) * this.dtScale; bl.life += dt;
      }
      for (const bl of this.botBullets) {
        const rw = bl.kind === 'rocket' ? 16 : (bl.kind === 'cannon' ? 18 : 11);
        const rh = bl.kind === 'rocket' ? 20 : (bl.kind === 'cannon' ? 22 : 16);
        if (bl.alive && this.player.respawnInvuln <= 0 && !this.player.dead &&
            Math.abs(bl.x - this.player.x) < rw && Math.abs(bl.y - (this.player.y - 16)) < rh) {
          bl.alive = false;
          const dmg = (bl.hitDmg != null) ? bl.hitDmg : Math.round((bl.damage || 20) * 0.4);
          this.onVersusHit({ dir: Math.sign(bl.vx) || 1, power: (bl.power != null ? bl.power : 9), vy: bl.kind === 'cannon' ? -8 : -3.5, dmg: dmg });
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
      const bClose = Math.abs(this.player.x - b.x) < 24;     // bijna in elkaar -> altijd raak
      if ((bClose || (dxp > -16 && dxp < 40)) && Math.abs(this.player.y - b.y) < 34 && this.player.respawnInvuln <= 0 && !this.player.dead) {
        const kd = this.player.x >= b.x ? 1 : -1;
        b.combo = (this.time < (b.comboUntil || 0)) ? Math.min(COMBO_MAX, (b.combo || 0) + 1) : 1;
        b.comboUntil = this.time + COMBO_WINDOW;
        const wd = (WEAPONS[b.meleeId] ? WEAPONS[b.meleeId].damage : 34) * (b.meleeMul || 1) * (b.hasBuff('rage', this.time) ? 1.6 : 1) * comboMul(b.combo);
        const kp = 15 + Math.max(0, b.combo - 1) * 8;                 // bot: vanaf x2 ook fors meer knockback
        this.onVersusHit({ dir: kd, power: kp, vy: -5.5 - Math.max(0, b.combo - 1) * 0.7, dmg: Math.round(wd * 0.45) });
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
    const blocking = b.ducking && b.onGround && !b._guardBroken;
    const parry = blocking && (this.time - (b._blockStart || 0)) <= PARRY_WINDOW;
    if (parry) {
      // bot parriet -> de speler (aanvaller) stuitert terug + verdoofd
      b.knockVx = 0; b.guard = Math.min(GUARD_MAX, b.guard + 400);
      this.spawnParryFlash(b.x, b.y - 14); this.shake = Math.max(this.shake, 6);
      const me = this.player;
      if (me && !me.dead && me.respawnInvuln <= 0) { me.knockVx = -dir * 20; me.vy = -4.5; me.onGround = false; me.stunUntil = this.time + 650; me.combo = 0; }
      return;
    }
    b.combo = 0; b.comboUntil = 0;                    // geraakt worden verbreekt de combo
    b.knockVx = dir * power * (blocking ? 0.10 : 1);
    if (!blocking) { b.vy = vy; b.onGround = false; }
    if (dmg) b.takeDamage(Math.round(dmg * (blocking ? 0.25 : 1)), 0, this, 0);
    if (blocking) {
      this.spawnArmorSpark(b.x + b.dir * 10, b.y - 12);
      b.guard -= GUARD_HIT_COST;
      if (b.guard <= 0) { b.guard = 0; b._guardBroken = true; b._guardBrokenUntil = this.time + GUARD_BREAK_STUN; b.stunUntil = Math.max(b.stunUntil || 0, this.time + GUARD_BREAK_STUN); this.onGuardBreak(b); }
    }
    this.shake = Math.max(this.shake, blocking ? 3 : 7);
  },

  respawnBot() {
    const b = this.bot; if (!b) return;
    const sp = this.vs.botSpawn;
    b.x = sp.x; b.y = sp.y; b.dir = sp.dir; b.vy = 0; b.knockVx = 0;
    b.onGround = true; b.dead = false; b.respawnInvuln = 1300; b.hp = b.maxHp; b.burnUntil = 0;
    b.swingWeapon = null; b.swingUntil = 0; b.stunUntil = 0; b.flatUntil = 0; b._beamSafeUntil = 0; b.combo = 0; b.comboUntil = 0; b.vine = null; b._caged = false;
    b.guard = GUARD_MAX; b._guardBroken = false; b._blockStart = 0;
    if (b.giant) { b.giant = false; if (b._baseMaxHp) b.maxHp = b._baseMaxHp; b.hp = b.maxHp; }
    b.heli = false; b.heliMinigun = 0; b.heliRockets = 0;
    if (this.vsMode === 'smash') { b.meleeId = b.baseMelee || 'bat'; b.weaponId = b.meleeId; b.fireballs = 0; b.smashRockets = 0; b.cannon = 0; b.shieldHp = 0; b._weaponUntil = 0; b.gunAmmo = 0; b.beachball = 0; b.coco = 0; b.boomerang = 0; b.dart = 0; }
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
    return Math.abs(tgt.x - cur.x) < 140 && (cur.y - tgt.y) < 100;
  },

  // beste tussenstap-platform richting de speler (wisselende route: laag/midden/hoog)
  bestHopToward(cur, tx, b) {
    if (this.time >= (b._routeAt || 0)) { b._route = Math.floor(Math.random() * 3); b._routeAt = this.time + 2500 + Math.random() * 2500; }
    const curDist = Math.abs(cur.x - tx);
    let best = null, bestScore = -1e9;
    for (const pf of this.platforms) {
      if (pf === cur) continue;                              // wolken mogen als opstapje dienen
      if (!this.reachablePlatform(cur, pf)) continue;
      const d = Math.abs(pf.x - tx);
      if (d > curDist - 2) continue;                        // moet dichter bij de speler brengen
      let score = (curDist - d);
      if (b._route === 2) score += (cur.y - pf.y) * 0.5;    // voorkeur omhoog
      else if (b._route === 0) score += (pf.y - cur.y) * 0.5;   // voorkeur omlaag
      score += (Math.random() - 0.5) * 24;                  // ruis -> variatie in route
      if (score > bestScore) { bestScore = score; best = pf; }
    }
    return best;
  },

  // de AI: speelstijl + moeilijkheid uit het profiel (this.botCfg, level 1..10)
  botThink() {
    const b = this.bot, p = this.player, now = this.time;
    const cfg = this.botCfg || BOT_PROFILES[4];
    const inp = { left: false, right: false, jump: false, duck: false, attack: false, melee: false, jumpPressed: false };
    if (b.dead) return inp;
    const dx = p.x - b.x;
    const aDx = Math.abs(dx);
    const face = () => { if (aDx > 8) b.dir = dx > 0 ? 1 : -1; };
    const inRange = aDx < 32 && Math.abs(p.y - b.y) < 24;
    if (inRange) { if (!b._inRangeSince) b._inRangeSince = now; } else b._inRangeSince = 0;
    const canMelee = () => inRange && now >= (b._meleeCd || 0) && b._inRangeSince && (now - b._inRangeSince) >= cfg.react;
    const doMelee = () => { inp.melee = true; b._meleeCd = now + cfg.meleeCd; face(); };

    // in een zachte wolk? -> omhoog drijven en richting de speler (zo steek je de Sky-kloof over)
    let botCloud = null;
    for (const pf of this.platforms) {
      if (pf.soft && Math.abs(b.x - pf.x) < pf.w / 2 + b.w / 2 && b.y > pf.y - 16 && b.y < pf.y + 12) { botCloud = pf; break; }
    }
    if (botCloud) {
      if (dx > 6) inp.right = true; else if (dx < -6) inp.left = true; else face();
      if (p.y < b.y - 6) inp.jump = true;                    // speler hoger -> omhoog drijven; lager -> door de wolk zakken
      if (canMelee()) doMelee();
      return inp;
    }

    // IN DE LUCHT: bij een 'foutje' geen volle sprong/dubbelsprong -> valt korter
    if (!b.onGround) {
      const target = (b._jumpTarget && this.platforms.indexOf(b._jumpTarget) >= 0) ? b._jumpTarget : this.nearestPlatform(b.x);
      if (target) {
        if (target.x > b.x + 6) inp.right = true; else if (target.x < b.x - 6) inp.left = true; else face();
        if (b.vy < 0 && !b._fumble) inp.jump = true;
        if (!b._fumble && b.jumps > 0 && now >= b._jumpCd && b.vy > 1 && (Math.abs(target.x - b.x) > 30 || b.y > target.y + 6)) {
          inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 300;
        }
      }
      if (canMelee()) doMelee();
      return inp;
    }

    const cur = this.platformUnder(b) || this.nearestPlatform(b.x);   // randen: val terug op dichtstbijzijnde
    b._jumpTarget = null; b._fumble = false;
    const eL = cur ? cur.x - cur.w / 2 + 9 : 0;
    const eR = cur ? cur.x + cur.w / 2 - 9 : CONFIG.VIEW_W;

    // BLOKKEN (kans uit profiel)
    if (inRange && this.time < (p.swingUntil || 0) && now >= (b._blockUntil || 0) && now >= (b._blockCd || 0) && Math.random() < cfg.block) {
      b._blockUntil = now + 420; b._blockCd = now + 1500;
    }
    if (now < (b._blockUntil || 0)) { inp.duck = true; face(); return inp; }

    // korte pauzes (lage aggro pauzeert vaker) — ze komen nog steeds naar je toe
    if (now >= (b._engageAt || 0)) { b._engaged = Math.random() < cfg.aggro; b._engageAt = now + (b._engaged ? 700 : 450); }

    const playerPf = this.platformUnder(p) || this.nearestPlatform(p.x);
    const onSame = cur && playerPf && cur === playerPf;
    const playerAirAbove = !p.onGround && p.y < b.y - 6;

    // navigeren: zelfde/bereikbaar platform -> de speler; anders een tussenstap richting speler
    let hop = null;
    if (!onSame && cur && !playerAirAbove) {
      hop = this.reachablePlatform(cur, playerPf) ? playerPf : this.bestHopToward(cur, p.x, b);
    }

    if (hop && hop !== cur) {
      // op weg naar de speler (ook als die stilstaat, ver weg): naar de rand en eraf springen
      const tdx = hop.x - b.x;
      if (tdx > 6) inp.right = true; else if (tdx < -6) inp.left = true; else face();
      const nearEdge = (tdx > 0 && b.x > eR - 6) || (tdx < 0 && b.x < eL + 6) || hop.y < cur.y - 8;
      if (nearEdge && now >= b._jumpCd && Math.random() < Math.max(cfg.jumpy, 0.5)) {
        b._fumble = Math.random() < cfg.mistake;            // spring-foutje (minder bij hogere levels)
        inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 650; b._jumpTarget = hop;
      }
    } else {
      // op het speler-vlak: naderen rond de standoff + meppen
      let want = 0;
      if (aDx > cfg.standoff + 6) want = (dx > 0 ? 1 : -1);           // ook van ver naderen -> ze komen naar je toe
      else if (aDx < cfg.standoff - 12) want = (dx > 0 ? -1 : 1);     // te dichtbij -> spacing
      if (!b._engaged && want > 0) want = 0;                          // tijdens een pauze even niet naderen
      if (want > 0 && b.x < eR) inp.right = true;
      else if (want < 0 && b.x > eL) inp.left = true;
      else face();
      if (canMelee()) doMelee();
      if (b._engaged && p.y < b.y - 18 && aDx < 60 && b.x > eL + 4 && b.x < eR - 4 && now >= b._jumpCd && Math.random() < cfg.jumpy) {
        b._fumble = Math.random() < cfg.mistake;
        inp.jump = true; inp.jumpPressed = true; b._jumpCd = now + 650; b._jumpTarget = playerPf;
      }
    }
    return inp;
  },

  onVersusHit(payload) {
    const p = this.player;
    if (p.respawnInvuln > 0 || p.dead) return;       // net gespawnd = even onkwetsbaar
    if (window.Sfx) Sfx.play('hit');
    const blocking = p.ducking && p.onGround && !p._guardBroken;   // bukken = blok
    const parry = blocking && (this.time - (p._blockStart || 0)) <= PARRY_WINDOW;   // net op tijd = parry
    if (parry) {
      // 100% geblokt + de aanvaller stuitert terug en is even verdoofd
      p.knockVx = 0; p.guard = Math.min(GUARD_MAX, p.guard + 400);
      this.spawnParryFlash(p.x, p.y - 14); this.shake = Math.max(this.shake, 6);
      if (this.vsBot && this.bot && !this.bot.dead) {
        const kd = this.bot.x >= p.x ? 1 : -1;
        this.bot.knockVx = kd * 20; this.bot.vy = -4.5; this.bot.onGround = false;
        this.bot.stunUntil = this.time + 650; this.bot.combo = 0;
      } else if (window.Net) Net.versusSend('parry', { dir: payload.dir || 1 });
      return;
    }
    p.combo = 0; p.comboUntil = 0;                    // geraakt worden verbreekt je combo
    p.knockVx = (payload.dir || 1) * (payload.power || 15) * (blocking ? 0.10 : 1);
    if (!blocking) { p.vy = payload.vy || -5.5; p.onGround = false; }
    if (payload.dmg) p.takeDamage(Math.round(payload.dmg * (blocking ? 0.25 : 1)));
    if (payload.stun && !blocking) p.stunUntil = Math.max(p.stunUntil || 0, this.time + payload.stun);   // gifdart
    if (blocking) {
      this.spawnArmorSpark(p.x + p.dir * 10, p.y - 12);
      p.guard -= GUARD_HIT_COST;
      if (p.guard <= 0) { p.guard = 0; p._guardBroken = true; p._guardBrokenUntil = this.time + GUARD_BREAK_STUN; p.stunUntil = Math.max(p.stunUntil || 0, this.time + GUARD_BREAK_STUN); this.onGuardBreak(p); }
    }
    this.shake = Math.max(this.shake, blocking ? 3 : 7);
  },

  // de aanvaller hoort dat z'n klap geparried is -> zelf terugstuiteren + verdoofd
  onVersusParry(payload) {
    const me = this.player;
    if (!me || me.dead) return;
    me.knockVx = -(payload && payload.dir ? payload.dir : 1) * 20; me.vy = -4.5; me.onGround = false;
    me.stunUntil = this.time + 650; me.combo = 0;
    this.spawnParryFlash(me.x, me.y - 14); this.shake = Math.max(this.shake, 5);
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
    this.player.stunUntil = 0; this.player.flatUntil = 0; this.player._beamSafeUntil = 0;
    this.player.combo = 0; this.player.comboUntil = 0; this.player.vine = null; this.player._caged = false;
    this.player.guard = GUARD_MAX; this.player._guardBroken = false; this.player._blockStart = 0;
    this.player.swingWeapon = null; this.player.swingUntil = 0;       // geen lingerende mep-animatie
    if (this.player.giant) { this.player.giant = false; if (this.player._baseMaxHp) this.player.maxHp = this.player._baseMaxHp; }  // reus eindigt bij rondewissel
    this.player.heli = false; this.player.heliMinigun = 0; this.player.heliRockets = 0;
    this.player.hp = this.player.maxHp;
    if (this.vsMode === 'smash') {                  // elke ronde weer met de knuppel
      this.player.meleeId = this.player.baseMelee || 'bat'; this.player.rangedId = null;
      this.player.weaponId = this.player.meleeId;    // ook het getekende wapen terug naar de knuppel
      this.player.fireballs = 0; this.player.smashRockets = 0; this.player.cannon = 0; this.player.shieldHp = 0; this.player._weaponUntil = 0; this.player.gunAmmo = 0; this.player.beachball = 0; this.player.coco = 0; this.player.boomerang = 0; this.player.dart = 0;
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
    r.stunned = s.su === 1;
    r.flat = s.fl === 1;
    r.hat = s.ht || 'none';
    r.rage = s.rg === 1; r.burn = s.bn === 1;
    r.shieldHp = s.shp || 0;
    r.giant = s.gi === 1;
    r.heli = s.hl === 1;
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
      wid: p.weaponId || 0, su: (p.stunUntil && this.time < p.stunUntil) ? 1 : 0, fl: (p.flatUntil && this.time < p.flatUntil) ? 1 : 0, ht: Storage.data.equippedHat || 'none',
      rg: p.hasBuff('rage', this.time) ? 1 : 0, bn: (p.burnUntil > this.time) ? 1 : 0, shp: Math.round(p.shieldHp || 0), gi: p.giant ? 1 : 0, hl: p.heli ? 1 : 0,
      wp: p.walkPhase || 0, al: p.dead ? 0 : 1, ch: Storage.data.equippedCharacter || 'ryan',
      h: Math.round(p.hp), mh: p.maxHp, dk: p.ducking ? 1 : 0,
    });
  },

  endVersus(won, peerLeft) {
    if (this.vs && this.vs.over) return;
    if (this.vs) this.vs.over = true;
    this.state = 'versusOver';
    const isBot = this.vsBot;
    // ----- JOURNEY: eigen afhandeling (level halen, unlocks, eigen uitslag) -----
    if (this.journey) {
      const jr = this.journey, idx = jr.idx;
      let unlocks = [];
      if (won) {
        const first = !Storage.journeyCleared(idx);
        unlocks = Storage.clearJourneyLevel(idx);
        const coins = (jr.lv && jr.lv.boss) ? 150 : 40, xp = (jr.lv && jr.lv.boss) ? 60 : 20;
        if (first) { Storage.data.coins = (Storage.data.coins || 0) + coins; Storage.data.xp = (Storage.data.xp || 0) + xp; Storage.save(); }
      }
      if (window.Sfx) Sfx.play(won ? 'win' : 'lose');
      const self = this, name = won ? 'JIJ' : ((jr.lv && jr.lv.boss) ? 'GORILLA KING' : 'BOT');
      UI.showWinCelebration(name, won);
      setTimeout(function () { if (self.state === 'versusOver') UI.showJourneyResult(won, idx, unlocks); }, 2600);
      return;
    }
    // betrouwbaar de uitslag naar de tegenstander sturen (paar keer tegen pakketverlies)
    if (!isBot && window.Net && this.vs) {
      const role = this.vs.role;
      const loserRole = won ? (role === 'host' ? 'guest' : 'host') : role;
      const send = () => Net.versusSend('over', { loserRole });
      send(); setTimeout(send, 300); setTimeout(send, 800);
    }
    // online: kanaal OPEN houden zodat een rematch mogelijk is (kanaal sluit pas bij menu/lobby)
    // tegen de bot: GEEN XP/wins. Echt duel: XP + wins (sync't naar de leaderboard).
    let gained = 0, coinsEarned = 0;
    if (!isBot) {
      gained = (won ? 100 : XP_LOSS) + (this._comboXp || 0);   // winst 100 XP + verdiende combo-XP
      coinsEarned = won ? 75 : 20;                              // winnaar 75 munten, verliezer 20
      Storage.data.xp = (Storage.data.xp || 0) + gained;
      Storage.data.coins = (Storage.data.coins || 0) + coinsEarned;
      if (won) Storage.data.mpWins = (Storage.data.mpWins || 0) + 1;
      else Storage.data.mpLosses = (Storage.data.mpLosses || 0) + 1;
      Storage.save();
    } else if (won && this.botLevel === 10) {           // win van de zwaarste bot -> kleine beloning
      gained = 30; coinsEarned = 50;
      Storage.data.xp = (Storage.data.xp || 0) + gained;
      Storage.data.coins = (Storage.data.coins || 0) + coinsEarned;
      Storage.save();
    }
    const myScore = this.vs ? this.vs.myScore : 0, oppScore = this.vs ? this.vs.oppScore : 0;
    if (peerLeft) { UI.showVersusResult(won, myScore, oppScore, gained, isBot, coinsEarned, peerLeft); return; }
    // korte win-celebratie met de naam van de winnaar, dan pas het uitslagscherm
    const winnerName = won
      ? ((window.Net && Net.isLoggedIn && Net.isLoggedIn()) ? Net.nickname() : 'Jij')
      : (isBot ? 'Bot' : 'Tegenstander');
    if (window.Sfx) Sfx.play(won ? 'win' : 'lose');
    UI.showWinCelebration(winnerName, won);
    const self = this;
    setTimeout(function () {
      if (self.state !== 'versusOver') return;   // intussen weggegaan
      UI.showVersusResult(won, myScore, oppScore, gained, isBot, coinsEarned, peerLeft);
    }, 2600);
  },

  // online match zelf verlaten: jij krijgt een loss (geen XP/munten), tegenstander wint (via 'bye')
  forfeitVersus() {
    if (this.vs && !this.vsBot) {
      Storage.data.mpLosses = (Storage.data.mpLosses || 0) + 1;
      Storage.save();
    }
    this.quitVersus();   // Net.leaveVersus() stuurt 'bye' -> tegenstander wint
  },

  quitVersus() {
    if (window.Net) Net.leaveVersus();
    this.vsBot = false; this.bot = null;
    this.journey = null; this.journeyDrops = null;
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
      // zon (rechtsboven, lichte parallax)
      const sunX = W - 64 - this.vsCamX * 0.05, sunY = 42 - this.vsCamY * 0.05;
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(sunX, sunY, 34, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(sunX, sunY, 17, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#fff6cf'; ctx.beginPath(); ctx.arc(sunX, sunY, 11, 0, 6.2832); ctx.fill();
      // wolken (2 parallax-lagen)
      const cloud = (cx, cy, sc, a) => { ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(cx, cy, 40 * sc, 9 * sc); ctx.fillRect(cx + 10 * sc, cy - 5 * sc, 24 * sc, 9 * sc); ctx.fillRect(cx + 4 * sc, cy - 2 * sc, 30 * sc, 7 * sc); };
      for (let i = 0; i < 4; i++) { const cx = ((i * 190 - this.vsCamX * 0.15) % (W + 220)) - 80; const cy = 30 + (i % 2) * 46 - this.vsCamY * 0.12; cloud(cx, cy, 1.4, 0.3); }   // ver
      for (let i = 0; i < 6; i++) { const cx = ((i * 150 - this.vsCamX * 0.3) % (W + 140)) - 60; const cy = 22 + (i % 3) * 52 - this.vsCamY * 0.25; cloud(cx, cy, 1.0, 0.6); }    // dichterbij
      ctx.globalAlpha = 1;
      // vogels (klein, klapperend, schuiven traag)
      ctx.strokeStyle = '#3a4760'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 5; i++) {
        const bx = ((i * 95 + this.time * 0.018) % (W + 60)) - 30;
        const by = 24 + (i * 19 % 46) - this.vsCamY * 0.1;
        const fl = Math.sin(this.time / 160 + i) * 2.5;
        ctx.beginPath(); ctx.moveTo(bx - 4, by + fl); ctx.lineTo(bx, by - 1); ctx.lineTo(bx + 4, by + fl); ctx.stroke();
      }
    }

    const shx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const shy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0;
    const camX = Math.round(this.vsCamX), camY = Math.round(this.vsCamY);
    ctx.save(); ctx.translate(-camX + shx, -camY + shy);

    if (map.cave) this.drawCaveBg(ctx);                 // diepe grotten / vleermuizen / druppels
    if (map.vulcan) this.drawVulcanBg(ctx);             // verre uitbarstingen + rook
    if (map.pirate) this.drawPirateBg(ctx);             // piratenschip-achtergrond + water
    if (map.jungle2) this.drawJungleBg(ctx);            // oerwoud-achtergrond + papegaaien
    if (map.dohyo) this.drawDohyoBg(ctx);               // Japanse dojo + hangend dak met kwasten
    if (map.beach) this.drawBeachBg(ctx);               // strand: zee + golven achter

    // afgrond onderin (map-thema), camera-bewust
    ctx.fillStyle = map.void || '#06090d'; ctx.fillRect(camX - 4, CONFIG.GROUND_Y - 2, W + 8, H + Math.abs(camY) + 320);
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#04060a'; ctx.fillRect(camX - 4, CONFIG.GROUND_Y + 18, W + 8, H + Math.abs(camY) + 320); ctx.globalAlpha = 1;

    if (map.pirate) this.drawPirateHull(ctx);           // scheepsromp onder het dek

    // platforms (bewegende krijgen een pijltjes-hint; zachte wolken pluizig; Vulcan = steen/schuin; Pirate = hout/masten)
    const platStyle = map.wood ? 'wood' : (map.stone ? 'stone' : (map.dohyo ? 'dohyo' : (map.sand ? 'sand' : null)));
    for (const pf of this.platforms) {
      if (pf.soft) { this.drawSoftCloud(ctx, pf); continue; }
      if (pf.mast) { this.drawMast(ctx, pf); continue; }
      if (pf.slide) { this.drawSlantPlatform(ctx, pf, platStyle); }
      else Sprites.drawPlatform(ctx, pf.x, pf.y, pf.w, platStyle);
      if (pf.mv) { ctx.globalAlpha = 0.5; Sprites.px(ctx, '#ffe9a0', pf.x - 1, pf.y - 5, 2, 2); ctx.globalAlpha = 1; }
    }

    if (map.pirate) this.drawPirateMast(ctx);           // middenmast loopt door het dek heen
    if (map.jungle2) { this.drawVines(ctx); this.drawGorilla(ctx); }   // lianen + gorilla (achter de spelers)
    if (map.cave) this.drawCaveButtons(ctx);            // knoppen op de platforms

    // portalen (Power Smash) — achter de spelers
    if (this.portals) for (const pt of this.portals) this.drawPortal(ctx, pt);

    // drops (Power Smash)
    if (this.drops) for (const d of this.drops) { if (!d.taken) this.drawDrop(ctx, d); }
    // vallende stenen (steen-powerup)
    if (this.rocks) for (const rk of this.rocks) this.drawRock(ctx, rk);

    // kogels: gewoon + fireball/rocket + ghost van de tegenstander + bot
    const drawBullet = (b) => {
      if (b.kind === 'fire') { Sprites.px(ctx, '#ff7a2a', b.x - 2, b.y - 2, 5, 5); Sprites.px(ctx, '#ffd24a', b.x - 1, b.y - 1, 3, 3); }
      else if (b.kind === 'rocket') { Sprites.px(ctx, '#cfd6df', b.x - 3, b.y - 1, 6, 3); Sprites.px(ctx, '#ffd24a', b.x - (Math.sign(b.vx) || 1) * 3, b.y - 1, 2, 3); }
      else if (b.kind === 'cannon') { Sprites.px(ctx, '#0e0e0e', b.x - 4, b.y - 4, 8, 8); Sprites.px(ctx, '#3a3a3a', b.x - 4, b.y - 4, 8, 2); Sprites.px(ctx, '#666', b.x - 2, b.y - 3, 2, 2); }
      else if (b.kind === 'coco') { Sprites.px(ctx, '#5e3f22', b.x - 4, b.y - 4, 8, 8); Sprites.px(ctx, '#8a5e36', b.x - 4, b.y - 4, 8, 3); Sprites.px(ctx, '#3a2614', b.x - 1, b.y - 1, 2, 2); }
      else if (b.kind === 'boom') { const a = Math.floor(this.time / 40) % 2; Sprites.px(ctx, '#a8824a', b.x - 4, b.y - 1, 8, 2); Sprites.px(ctx, '#a8824a', b.x - 1, b.y - 4, 2, 8); if (a) { Sprites.px(ctx, '#caa860', b.x - 4, b.y - 4, 3, 3); Sprites.px(ctx, '#caa860', b.x + 1, b.y + 1, 3, 3); } }
      else if (b.kind === 'dart') { const d = Math.sign(b.vx) || 1; Sprites.px(ctx, '#2f7a3a', b.x - d * 4, b.y - 1, 8, 2); Sprites.px(ctx, '#cfd6df', b.x + d * 3, b.y - 1, 2, 2); }
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
      if (r.onGround) Sprites.shadow(ctx, r.x, r.y + 1, r.giant ? 11 : 7);
      if (r.heli) { this.drawHeli(ctx, Math.round(r.x), Math.round(r.y), r.dir, rc.palette); }
      else {
      ctx.save(); ctx.translate(Math.round(r.x), Math.round(r.y)); const rg = r.giant ? 2.2 : 1; ctx.scale(rg, rg);
      Sprites.drawCharacter(ctx, 0, 0, r.dir, rc.palette, {
        walkPhase: r.walkPhase, airborne: !r.onGround, attacking: r.attacking, ducking: r.ducking,
        weapon: r.giant ? null : (r.swingWeapon || r.heldWeapon || 'bat'), build: rc.build, hair: rc.hair, squash: r.flat,
        hat: r.hat || 'none', t: this.time, rage: r.rage, burning: r.burn,
      });
      ctx.restore();
      }
      if (r.ducking) this.drawBlockGuard(ctx, Math.round(r.x), Math.round(r.y), r.dir);
      if (r.stunned) this.drawStunAura(ctx, Math.round(r.x), Math.round(r.y));
      this.drawVsMarker(ctx, Math.round(r.x), Math.round(r.y), rc.build, '#ff5a5a');
    }

    // eigen speler — GROEN pijltje erboven (knippert tijdens respawn)
    const p = this.player;
    const blink = p.respawnInvuln > 0 && Math.floor(this.time / 90) % 2 === 0;
    if (!p.dead) {
      if (!blink) {
        if (p.onGround) Sprites.shadow(ctx, p.x, p.y + 1, p.giant ? 11 : 7);
        const swinging = this.time < (p.swingUntil || 0) && p.swingWeapon;
        if (p.heli) { this.drawHeli(ctx, Math.round(p.x), Math.round(p.y), p.dir, p.pal); }
        else {
        ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); const pg = p.giant ? 2.2 : 1; ctx.scale(pg, pg);
        Sprites.drawCharacter(ctx, 0, 0, p.dir, p.pal, {
          walkPhase: p.walkPhase, airborne: !p.onGround, ducking: p.ducking,
          attacking: this.time < p.attackAnimUntil,
          weapon: p.giant ? null : (swinging ? p.swingWeapon : p.weaponId), build: p.build, hair: p.hairStyle,
          squash: (p.flatUntil && this.time < p.flatUntil),
          hat: Storage.data.equippedHat, t: this.time,
          rage: p.hasBuff('rage', this.time), burning: p.burnUntil > this.time,
        });
        ctx.restore();
        }
        if (p.ducking && p.onGround) this.drawBlockGuard(ctx, Math.round(p.x), Math.round(p.y), p.dir);
        if (p.stunUntil && this.time < p.stunUntil) this.drawStunAura(ctx, Math.round(p.x), Math.round(p.y));
      }
      this.drawVsMarker(ctx, Math.round(p.x), Math.round(p.y), p.build, '#5aff7a');
    }

    if (map.cave && this.caveWall) this.drawCaveWall(ctx);   // de muur sweept over de spelers heen
    if (map.vulcan) this.drawVulcanJet(ctx);                 // borrel-waarschuwing + lavastraal
    if (map.pirate && this.tentacle) this.drawTentacle(ctx); // zeemonster-tentakel
    if (map.jungle2 && this.monkey) this.drawMonkey(ctx);    // helper-aapje
    if (map.jungle2 && this.jungleCage) this.drawCage(ctx);  // kooi-tralies vóór de spelers
    if (this.ball) this.drawBall(ctx);                       // strandbal
    if (map.beach && this.tide) this.drawTideWater(ctx);     // vloed-water over de spelers
    ctx.restore();

    // draken (drakenei-powerup) — scherm-ruimte, over de wereld heen
    this.renderDragons(ctx);
    // bliksem (Cave/Sky) — scherm-ruimte
    this.renderLightning(ctx);
    // combo-teller
    this.drawComboHud(ctx);

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
    else if (d.kind === 'lightning') {
      // bliksemschicht-icoon (alleen Cave)
      ctx.globalAlpha = 0.3; Sprites.px(ctx, '#bfe6ff', x - 5, y - 8, 10, 14); ctx.globalAlpha = 1;
      Sprites.px(ctx, '#ffd24a', x - 1, y - 7, 3, 5);
      Sprites.px(ctx, '#bfe6ff', x - 3, y - 3, 3, 5);
      Sprites.px(ctx, '#fff', x, y - 2, 2, 4);
    }
    else if (d.kind === 'rock') {
      // steen-icoon
      Sprites.px(ctx, '#6a5e50', x - 5, y - 5, 10, 9);
      Sprites.px(ctx, '#8a7c6a', x - 5, y - 5, 10, 2);
      Sprites.px(ctx, '#4a4036', x - 5, y + 3, 10, 1);
      Sprites.px(ctx, '#3a3229', x - 2, y - 2, 2, 2);
    }
    else if (d.kind === 'cannon') {
      // kanonskogel-icoon
      Sprites.px(ctx, '#0e0e0e', x - 5, y - 4, 10, 10);
      Sprites.px(ctx, '#3a3a3a', x - 5, y - 4, 10, 2);
      Sprites.px(ctx, '#777', x - 2, y - 2, 2, 2);
      Sprites.px(ctx, '#6a4a2a', x - 1, y - 7, 2, 3);   // lont
      Sprites.px(ctx, '#ff8a3a', x - 1, y - 9, 2, 2);   // vonkje
    }
    else if (d.kind === 'shield') {
      // schild-icoon (blauw)
      Sprites.px(ctx, '#2f7ad0', x - 5, y - 6, 10, 9);
      Sprites.px(ctx, '#7fc8ff', x - 5, y - 6, 10, 3);
      Sprites.px(ctx, '#2f7ad0', x - 4, y + 3, 8, 2);
      Sprites.px(ctx, '#1a4f8e', x - 5, y - 6, 2, 9);
      Sprites.px(ctx, '#dff0ff', x - 1, y - 4, 2, 5);   // glans / kruis
      Sprites.px(ctx, '#dff0ff', x - 3, y - 2, 6, 2);
    }
    else if (d.kind === 'giant') {
      // Giant-icoon (grote groene vuist)
      Sprites.px(ctx, '#2f8a3a', x - 5, y - 5, 10, 9);
      Sprites.px(ctx, '#3fb04a', x - 5, y - 5, 10, 3);
      Sprites.px(ctx, '#1f5e28', x - 5, y + 3, 10, 1);
      Sprites.px(ctx, '#7affa0', x - 3, y - 3, 2, 2);
      Sprites.px(ctx, '#cfffe0', x + 2, y - 8, 2, 2);   // sprankel
    }
    else if (d.kind === 'ak47') {
      // AK47-icoon
      Sprites.px(ctx, '#2a2a2e', x - 6, y - 2, 12, 3);  // loop
      Sprites.px(ctx, '#5a3a22', x + 2, y - 1, 4, 5);   // kolf
      Sprites.px(ctx, '#3a2f22', x - 2, y + 1, 3, 4);   // magazijn (gebogen)
      Sprites.px(ctx, '#1a1a1e', x - 1, y + 4, 3, 2);
      Sprites.px(ctx, '#888', x - 6, y - 2, 3, 1);
    }
    else if (d.kind === 'beachball') {
      // strandbal-icoon (gekleurde partjes)
      Sprites.px(ctx, '#ffffff', x - 5, y - 5, 10, 10);
      Sprites.px(ctx, '#e8483b', x - 5, y - 5, 10, 3);
      Sprites.px(ctx, '#3aa0e0', x - 5, y + 2, 10, 3);
      Sprites.px(ctx, '#f2c94c', x - 1, y - 5, 2, 10);
    }
    else if (d.kind === 'coco') {                      // kokosbom
      Sprites.px(ctx, '#5e3f22', x - 5, y - 5, 10, 10); Sprites.px(ctx, '#8a5e36', x - 5, y - 5, 10, 3);
      Sprites.px(ctx, '#3a2614', x - 2, y - 1, 2, 2); Sprites.px(ctx, '#3a2614', x + 1, y + 1, 2, 2);
      Sprites.px(ctx, '#3a8a4a', x - 1, y - 8, 2, 3);   // steeltje
    }
    else if (d.kind === 'boom') {                      // boemerang
      Sprites.px(ctx, '#a8824a', x - 5, y - 1, 7, 2); Sprites.px(ctx, '#a8824a', x - 1, y - 5, 2, 7);
      Sprites.px(ctx, '#7a5e30', x - 5, y - 1, 2, 2); Sprites.px(ctx, '#7a5e30', x - 1, y - 5, 2, 2);
    }
    else if (d.kind === 'dart') {                      // gifdart
      Sprites.px(ctx, '#2f7a3a', x - 5, y - 1, 8, 2); Sprites.px(ctx, '#cfd6df', x + 3, y - 1, 3, 2);
      Sprites.px(ctx, '#6b4a2a', x - 6, y - 1, 2, 2);
    }
    else if (d.kind === 'heli') {
      // gevechtsheli-icoon
      Sprites.px(ctx, '#cfd6df', x - 7, y - 6, 14, 2);   // hoofdrotor
      Sprites.px(ctx, '#7a7a7a', x - 1, y - 5, 2, 2);    // mast
      Sprites.px(ctx, '#3f5a3a', x - 5, y - 3, 9, 6);    // romp
      Sprites.px(ctx, '#a8dcff', x + 1, y - 2, 3, 3);    // cockpit
      Sprites.px(ctx, '#3f5a3a', x - 9, y - 1, 5, 2);    // staart
      Sprites.px(ctx, '#7a7a7a', x - 5, y + 3, 9, 1);    // ski
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

  // ---- CAVE render ----
  drawCaveBg(ctx) {
    const mapW = this.vsMapW;
    // diepe grot-holtes achter de grond
    const holes = [[120, 150, 58, 40], [360, 168, 90, 54], [600, 150, 58, 40], [250, 116, 44, 28], [470, 116, 44, 28]];
    for (const h of holes) {
      ctx.globalAlpha = 0.65; Sprites.px(ctx, '#05030a', h[0] - h[2], h[1] - h[3], h[2] * 2, h[3] * 2);
      ctx.globalAlpha = 0.35; Sprites.px(ctx, '#1a1230', h[0] - h[2] + 2, h[1] - h[3] + 2, h[2] * 2 - 4, 3);
    }
    ctx.globalAlpha = 1;
    // vleermuizen
    for (const bt of this.caveBats) {
      const up = Math.sin(bt.ph) > 0 ? -2 : 0;
      const x = Math.round(bt.x), y = Math.round(bt.y);
      Sprites.px(ctx, '#0a0710', x - 3, y + up, 2, 2);
      Sprites.px(ctx, '#0a0710', x + 1, y + up, 2, 2);
      Sprites.px(ctx, '#1a1326', x - 1, y, 2, 2);
    }
    // waterdruppels
    for (const dr of this.caveDrips) Sprites.px(ctx, '#5aa0c8', Math.round(dr.x), Math.round(dr.y), 1, 3);
  },

  drawCaveButtons(ctx) {
    if (!this.caveButtons) return;
    for (let i = 0; i < this.caveButtons.length; i++) {
      const b = this.caveButtons[i];
      const armed = i === this.caveArmed;
      const blink = armed && Math.floor(this.time / 200) % 2 === 0;
      Sprites.px(ctx, '#2a2a33', b.x - 5, b.y - 6, 10, 6);                  // sokkel
      Sprites.px(ctx, armed ? (blink ? '#ff3030' : '#7a1414') : '#566', b.x - 3, b.y - 9, 6, 4);   // knop
      if (blink) { ctx.globalAlpha = 0.4; Sprites.px(ctx, '#ff5a5a', b.x - 7, b.y - 13, 14, 12); ctx.globalAlpha = 1; }
    }
  },

  drawCaveWall(ctx) {
    const wl = this.caveWall, map = this.vsMap;
    const y0 = (map.camTop || 0) - 20, y1 = this.vsFallY + 12, x = wl.x;
    ctx.globalAlpha = 0.3; Sprites.px(ctx, '#ff8a4a', x - 8, y0, 8, y1 - y0); ctx.globalAlpha = 1;   // gloed
    Sprites.px(ctx, '#c0392b', x - 3, y0, 6, y1 - y0);                    // dunne straal
    Sprites.px(ctx, '#ffd24a', x - 1, y0, 2, y1 - y0);                    // kern
    for (let i = 0; i < 3; i++) Sprites.px(ctx, '#ffe9a0', x - 2, y0 + ((this.time / 40 + i * 30) % (y1 - y0)), 4, 2);   // sprankels
  },

  // zachte wolk-platform (Sky): pluizig en doorschijnend (je zakt erdoorheen)
  drawSoftCloud(ctx, pf) {
    const x = pf.x, y = pf.y, w = pf.w;
    const bob = Math.sin((this.time + x * 7) / 600) * 1.5;
    ctx.globalAlpha = 0.85;
    Sprites.px(ctx, '#f2f7ff', x - w / 2, y - 3 + bob, w, 8);
    for (let i = -w / 2; i < w / 2 - 2; i += 9) Sprites.px(ctx, '#ffffff', x + i, y - 8 + bob, 13, 8);
    ctx.globalAlpha = 0.35; Sprites.px(ctx, '#c9d8ec', x - w / 2, y + 4 + bob, w, 3);   // zachte onderkant
    ctx.globalAlpha = 1;
  },

  drawRock(ctx, rk) {
    const x = Math.round(rk.x), y = Math.round(rk.y);
    ctx.globalAlpha = 0.25; Sprites.px(ctx, '#000', x - 9, y - 8, 18, 18); ctx.globalAlpha = 1;
    Sprites.px(ctx, '#6a5e50', x - 9, y - 8, 18, 16);
    Sprites.px(ctx, '#8a7c6a', x - 9, y - 8, 18, 3);
    Sprites.px(ctx, '#4a4036', x - 9, y + 5, 18, 3);
    Sprites.px(ctx, '#3a3229', x - 4, y - 3, 3, 3); Sprites.px(ctx, '#3a3229', x + 2, y + 1, 3, 3);
  },

  // schuin (gekanteld) stenen platform
  drawSlantPlatform(ctx, pf, style) {
    ctx.save();
    ctx.translate(Math.round(pf.x), Math.round(pf.y));
    ctx.rotate((pf.slide || 0) * 0.16);
    Sprites.drawPlatform(ctx, 0, 0, pf.w, style || 'stone');
    ctx.restore();
  },

  // mast met kraaiennest (Pirate): houten paal omlaag tot het dek + platform om bovenin te staan
  drawMast(ctx, pf) {
    const x = Math.round(pf.x), deckY = 178;
    Sprites.px(ctx, '#5a3d22', x - 2, pf.y, 4, deckY - pf.y);             // mastpaal
    Sprites.px(ctx, '#4a3219', x - 2, pf.y, 1, deckY - pf.y);
    Sprites.drawPlatform(ctx, pf.x, pf.y, pf.w, 'wood');                  // kraaiennest
    Sprites.px(ctx, '#3a2615', x - pf.w / 2, pf.y - 5, pf.w, 4);          // randje van het nest
  },

  // piratenschip-achtergrond: water + zeil + (langzaam opkomend) zeemonster op de achtergrond
  drawPirateBg(ctx) {
    const W = this.vsMapW, deckY = 178;
    // water (golvend) ver op de achtergrond
    for (let i = 0; i < W; i += 16) {
      const wy = deckY - 8 + Math.round(Math.sin(this.time / 320 + i * 0.05) * 2);
      ctx.globalAlpha = 0.5; Sprites.px(ctx, '#1d4f78', i, wy, 16, deckY - wy + 6); ctx.globalAlpha = 1;
      Sprites.px(ctx, '#2f74a8', i, wy, 9, 2);
    }
    // groot zeil op de achtergrond
    ctx.globalAlpha = 0.5;
    Sprites.px(ctx, '#d8cba8', W / 2 - 70, 26, 140, 64);
    Sprites.px(ctx, '#c8b890', W / 2 - 70, 26, 140, 4);
    Sprites.px(ctx, '#b84a3a', W / 2 - 12, 40, 24, 20);                   // doodskopvlag-vlak
    ctx.globalAlpha = 1;
    // zeemonster komt LANGZAAM uit het water op de achtergrond (achter het schip)
    this.drawSeaMonster(ctx);
  },

  // het zeemonster-hoofd dat langzaam uit het achtergrondwater opkomt
  drawSeaMonster(ctx) {
    const v = this.tentacle; if (!v || v.state === 'idle') return;
    const deckY = 178, x = v.x;
    let rise = 0;
    if (v.state === 'warn') rise = Math.max(0, Math.min(1, (PIRATE_TENT_WARN - (v.nextAt - this.time)) / PIRATE_TENT_WARN));
    else if (v.state === 'strike') rise = 1;
    const top = (deckY + 6) - Math.round(96 * rise);     // top van de kop, komt langzaam omhoog
    const h = (deckY + 6) - top;
    if (h < 4) return;
    Sprites.px(ctx, '#14352a', x - 26, top, 52, h);       // donkere kop
    Sprites.px(ctx, '#1f5640', x - 26, top, 52, 4);       // bovenrand
    Sprites.px(ctx, '#0e261d', x - 26, top, 4, h);        // schaduw
    if (h > 22) {                                         // gloeiende ogen verschijnen
      Sprites.px(ctx, '#ffe27a', x - 14, top + 9, 6, 6); Sprites.px(ctx, '#ffe27a', x + 8, top + 9, 6, 6);
      Sprites.px(ctx, '#000', x - 12, top + 11, 3, 3); Sprites.px(ctx, '#000', x + 10, top + 11, 3, 3);
    }
  },

  // zeemonster-tentakel: waarschuwing (water borrelt), daarna slaat 'ie LANGZAAM HARD op en neer
  drawTentacle(ctx) {
    const v = this.tentacle; if (!v || v.state === 'idle') return;
    const x = v.x, deckY = 178, waterY = deckY + 4;
    if (v.state === 'warn') {
      for (let i = 0; i < 7; i++) { const bx = x + Math.sin(this.time / 110 + i) * 14; const by = waterY - ((this.time / 170 + i * 6) % 18); Sprites.px(ctx, '#7fe0a0', Math.round(bx), Math.round(by), 3, 3); }
      ctx.globalAlpha = 0.5; Sprites.px(ctx, '#3aa86a', x - 16, waterY - 2, 32, 4); ctx.globalAlpha = 1;
    } else if (v.state === 'strike') {
      // de tentakel zwaait langzaam met grote slag op en neer
      const sway = Math.sin(this.time / 240);                            // langzaam
      const topY = (this.vsMap.camTop || 0) + 8 + Math.round(sway * 34);  // tip zwaait op/neer
      const h = waterY - topY;
      for (let i = 0; i < h; i += 4) {
        const t = i / h;
        const wob = Math.round(Math.sin(this.time / 200 + i * 0.1) * (4 + t * 22));
        const w = Math.max(4, Math.round(12 - t * 7));
        Sprites.px(ctx, '#2e8a58', x - w / 2 + wob, waterY - i, w, 4);
        Sprites.px(ctx, '#3aa86a', x - w / 2 + wob + 1, waterY - i, 2, 4);
        if (i % 12 === 0) Sprites.px(ctx, '#1e5e3a', x - w / 2 + wob, waterY - i, 2, 2);   // zuignap
      }
    }
  },

  // ---- JUNGLE render ----
  drawJungleBg(ctx) {
    const W = this.vsMapW, gy = CONFIG.GROUND_Y;
    for (let i = -40; i < W + 40; i += 70) { const h = 60 + ((Math.abs(i) * 37) % 50); Sprites.px(ctx, '#0f2a19', i, gy - h, 62, h); }
    for (let i = -20; i < W + 40; i += 92) { const h = 92 + ((Math.abs(i) * 23) % 64); Sprites.px(ctx, '#15391f', i, gy - h, 66, h); }
    for (let i = -40; i < W + 40; i += 42) Sprites.px(ctx, '#1c4a2c', i - 6, -34, 54, 38);   // bladerdak bovenin
    // papegaaien (vliegen traag over)
    const cols = ['#e8483b', '#f2c94c', '#3aa0e0', '#7affa0', '#ff8a3a'];
    for (let k = 0; k < 5; k++) {
      const px = ((k * 220 + this.time * 0.03) % (W + 90)) - 45;
      const py = 0 + (k * 27 % 80) + Math.sin(this.time / 120 + k) * 3;
      const c = cols[k % cols.length];
      Sprites.px(ctx, c, Math.round(px - 3), Math.round(py), 6, 3);            // lijf
      Sprites.px(ctx, c, Math.round(px - 5), Math.round(py - 1), 3, 2);        // vleugel
      Sprites.px(ctx, '#ffd24a', Math.round(px + 3), Math.round(py), 2, 2);    // snavel
      Sprites.px(ctx, '#1c4a2c', Math.round(px - 8), Math.round(py + 1), 4, 1);// staart
    }
  },
  // Dohyo-achtergrond: Japanse dojo met shoji-wand, rijzende zon en een hangend dak (tsuriyane) met 4 kwasten
  drawDohyoBg(ctx) {
    const W = this.vsMapW || 360, gy = CONFIG.GROUND_Y, cx = Math.round(W / 2);
    // rijzende zon achter het midden
    ctx.fillStyle = '#c85038'; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(cx, 96, 70, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // houten achterwand + shoji (rijstpapier) panelen
    Sprites.px(ctx, '#4a3826', 0, gy - 64, W, 12);                 // donkere houten plint boven de vloer
    for (let px = 8; px < W - 30; px += 48) {
      Sprites.px(ctx, '#e7ddc6', px, 34, 42, 80);                  // papier
      Sprites.px(ctx, '#6b5238', px, 34, 2, 80); Sprites.px(ctx, '#6b5238', px + 40, 34, 2, 80);  // verticale frames
      Sprites.px(ctx, '#6b5238', px, 34, 42, 2); Sprites.px(ctx, '#6b5238', px, 72, 42, 2);        // dwarslatten
      Sprites.px(ctx, '#6b5238', px + 20, 34, 1, 80);             // middenlat
    }
    // hangend dak (tsuriyane) boven de ring
    const ry = -6, rw = 96;
    Sprites.px(ctx, '#2a1c12', cx - rw / 2 - 6, ry + 12, rw + 12, 5);     // onderrand dak
    for (let i = 0; i < 9; i++) Sprites.px(ctx, '#7a2418', cx - rw / 2 + i * 3, ry + 2 + i, rw - i * 6, 1); // schuin pannendak
    Sprites.px(ctx, '#b8862e', cx - rw / 2 - 6, ry + 10, rw + 12, 2);     // gouden rand
    // 4 kwasten (fusa) aan de hoeken: paars, wit, rood, zwart
    const fusa = ['#6b3fa0', '#e8e0cf', '#c83838', '#2a2a2a'];
    const fx = [cx - rw / 2 - 4, cx - rw / 6, cx + rw / 6, cx + rw / 2 + 1];
    for (let i = 0; i < 4; i++) { Sprites.px(ctx, fusa[i], fx[i], ry + 16, 4, 9); Sprites.px(ctx, fusa[i], fx[i] + 1, ry + 25, 2, 3); }
    // verticale banners (nobori) aan de zijkanten
    Sprites.px(ctx, '#b83a2a', 6, 40, 7, 70); Sprites.px(ctx, '#e8e0cf', 8, 46, 3, 20);
    Sprites.px(ctx, '#b83a2a', W - 13, 40, 7, 70); Sprites.px(ctx, '#e8e0cf', W - 11, 46, 3, 20);
  },
  drawVines(ctx) {
    if (!this.vsVines) return;
    for (const vn of this.vsVines) {
      let angle = null, len = vn.len;
      // hangt iemand eraan? -> de liaan slingert mee
      if (this.player.vine && Math.abs(this.player.vine.vx - vn.x) < 2) { angle = this.player.vine.angle; len = this.player.vine.len; }
      else if (this.vs && this.vs.remote && this.vs.remote.alive && !this.vs.remote.onGround) {
        const r = this.vs.remote, dx = r.x - vn.x, dy = r.y - vn.ay, dist = Math.hypot(dx, dy);
        if (Math.abs(dx) < 16 && dy > 20 && dist < vn.len + 18) { angle = Math.atan2(dx, dy); len = Math.min(vn.len, dist); }
      }
      if (angle == null) angle = Math.sin(this.time / 900 + vn.x * 0.05) * 0.16;   // zachte sway als er niemand hangt
      for (let i = 0; i <= len; i += 6) {
        const sx = vn.x + Math.sin(angle) * i, sy = vn.ay + Math.cos(angle) * i;
        Sprites.px(ctx, (i % 18 < 9) ? '#3a6b2a' : '#346024', Math.round(sx) - 1, Math.round(sy), 3, 6);
      }
      Sprites.px(ctx, '#2a5020', vn.x - 2, vn.ay - 2, 5, 4);                   // ankerknoop
      Sprites.px(ctx, '#4a8a3a', Math.round(vn.x + Math.sin(angle) * len) - 3, Math.round(vn.ay + Math.cos(angle) * len), 7, 4);  // blad
    }
  },
  drawGorilla(ctx) {
    const g = this.gorilla; if (!g || !g.alive) return;
    const x = Math.round(g.x), y = Math.round(g.y), s = g.dir;
    const fur = (g.hitFlash > 0 && Math.floor(this.time / 60) % 2 === 0) ? '#d8a0a0' : '#3a3330', furDk = '#2a2522';
    Sprites.px(ctx, fur, x - 24, y - 30, 8, 26); Sprites.px(ctx, fur, x + 16, y - 30, 8, 26);   // armen
    Sprites.px(ctx, fur, x - 16, y - 34, 32, 34);                              // lijf
    Sprites.px(ctx, furDk, x - 16, y - 34, 5, 34);
    Sprites.px(ctx, '#5a524c', x - 8, y - 26, 16, 18);                         // borst
    Sprites.px(ctx, fur, x - 12, y - 47, 24, 15);                             // kop
    Sprites.px(ctx, '#d8b89a', x - 7, y - 40, 14, 6);                         // snuit
    Sprites.px(ctx, '#000', x - 5, y - 44, 2, 2); Sprites.px(ctx, '#000', x + 3, y - 44, 2, 2);  // ogen
    if (g.state === 'swipe') { Sprites.px(ctx, fur, x + (s > 0 ? 14 : -26), y - 46, 12, 8); }   // klap-arm omhoog
    if (g.hp < g.maxHp) { const bw = 44; Sprites.px(ctx, '#11151e', x - bw / 2 - 1, y - 58, bw + 2, 5); Sprites.px(ctx, '#cc3333', x - bw / 2, y - 57, Math.round(bw * Math.max(0, g.hp / g.maxHp)), 3); }
  },
  drawCage(ctx) {
    const cg = this.jungleCage; const L = cg.x - cg.w / 2, R = cg.x + cg.w / 2, top = cg.top, bot = cg.floorY + 4;
    Sprites.px(ctx, '#6b6b73', L - 4, top, 4, bot - top); Sprites.px(ctx, '#6b6b73', R, top, 4, bot - top);   // hoekpalen
    ctx.globalAlpha = 0.45;
    for (let bx = L + 6; bx < R; bx += 15) Sprites.px(ctx, '#9a9aa2', bx, top, 2, bot - top);   // zijtralies (doorzichtig)
    ctx.globalAlpha = 1;
    // bovenkant: tralies dicht zolang er iemand opgesloten is (gorilla leeft)
    const closed = this.gorilla && this.gorilla.alive && (this.player._caged || (this.bot && this.bot._caged) || (!this.vsBot && this._inCage(this.vs.remote)));
    if (closed) {
      Sprites.px(ctx, '#5a5a62', L - 4, top - 5, cg.w + 8, 5);                 // dwarsbalk
      for (let bx = L; bx <= R; bx += 9) Sprites.px(ctx, '#9a9aa2', bx, top - 4, 2, 7);   // dichte spijlen over de opening
    } else {
      Sprites.px(ctx, '#5a5a62', L - 4, top - 4, cg.w + 8, 4);                 // open: alleen de dwarsbalk
    }
  },

  // scheepsromp onder het dek (boot-vorm: breed bovenaan, smaller onderaan)
  drawPirateHull(ctx) {
    const W = this.vsMapW, deckY = 178;
    const left = 90, right = W - 90, bottom = deckY + 48;
    for (let y = 0; y < bottom - deckY; y++) {
      const t = y / (bottom - deckY);
      const inset = Math.round(t * t * 80);              // krommer naar onderen -> boog
      const lx = left + inset, rx = right - inset;
      const col = y < 4 ? '#6b4a2b' : (y < 10 ? '#5a3d22' : '#46301c');
      Sprites.px(ctx, col, lx, deckY + y, rx - lx, 1);
    }
    // plank-naden + kiel-streep
    for (let px = left + 30; px < right - 20; px += 60) Sprites.px(ctx, '#3a2615', px, deckY + 4, 1, 30);
    Sprites.px(ctx, '#3a2615', Math.round(W / 2) - 1, deckY + 4, 2, 42);
  },

  // de middenmast loopt door het dek heen tot in de romp
  drawPirateMast(ctx) {
    const W = this.vsMapW, x = Math.round(W / 2);
    Sprites.px(ctx, '#5a3d22', x - 3, 18, 6, 200);       // dikke mast van boven tot in de romp
    Sprites.px(ctx, '#4a3219', x - 3, 18, 2, 200);       // schaduwkant
    Sprites.px(ctx, '#6b4a2b', x - 34, 30, 68, 4);       // ra (dwarsbalk voor het zeil)
  },

  // Vulcan-achtergrond: verre vulkanen met gloeiende krater, lavaspatten + rook
  drawVulcanBg(ctx) {
    const baseY = this.vsFallY, mapW = this.vsMapW;
    const mtn = (mx, mw, mh) => {
      for (let i = 0; i < mh; i++) { const ww = Math.max(2, Math.round(mw * (1 - i / mh))); Sprites.px(ctx, '#1c0f0c', mx - ww, baseY - 26 - i, ww * 2, 1); }
      Sprites.px(ctx, '#ff5a2a', mx - 6, baseY - 26 - mh, 12, 3);   // gloeiende krater
      ctx.globalAlpha = 0.3; Sprites.px(ctx, '#ff7a2a', mx - 9, baseY - 30 - mh, 18, 5); ctx.globalAlpha = 1;
    };
    mtn(140, 64, 58); mtn(580, 74, 66);
    for (const b of this.vulcanBg) Sprites.px(ctx, '#ff7a2a', Math.round(b.x), Math.round(b.y), 2, 3);
    for (const s of this.vulcanSmoke) { ctx.globalAlpha = Math.max(0, Math.min(0.4, s.life / 3000)); Sprites.px(ctx, '#6a5a55', Math.round(s.x), Math.round(s.y), 6, 6); }
    ctx.globalAlpha = 1;
  },

  // de lavastraal in het midden (borrel-waarschuwing + uitbarsting)
  drawVulcanJet(ctx) {
    const v = this.vulcan; if (!v) return;
    const x = v.x, baseY = this.vsFallY, topY = ((this.vsMap.camTop || 0) - 10);
    if (v.state === 'bubble') {
      Sprites.px(ctx, '#ff5a2a', x - 13, baseY - 6, 26, 6);                      // gloeiende poel
      ctx.globalAlpha = 0.4; Sprites.px(ctx, '#ff7a2a', x - 15, baseY - 12, 30, 8); ctx.globalAlpha = 1;
      // bubbels komen nu veel hoger op (beter zichtbaar)
      for (let i = 0; i < 8; i++) {
        const bx = x + Math.sin(this.time / 110 + i * 1.3) * 11;
        const by = baseY - 6 - ((this.time / 150 + i * 9) % 56);
        const sz = 3 + (i % 3);
        Sprites.px(ctx, i % 2 ? '#ff9a3a' : '#ffd24a', Math.round(bx), Math.round(by), sz, sz);
      }
    } else if (v.state === 'erupt') {
      const w = 24, h = baseY - topY;                                            // dikkere straal
      ctx.globalAlpha = 0.3; Sprites.px(ctx, '#ff9a3a', x - w / 2 - 5, topY, w + 10, h); ctx.globalAlpha = 1;
      Sprites.px(ctx, '#ff5a1e', x - w / 2, topY, w, h);                          // buitenstraal
      Sprites.px(ctx, '#ff8a3a', x - w / 2 + 3, topY, w - 6, h);                  // mid
      Sprites.px(ctx, '#ffd24a', x - 5, topY, 10, h);                             // hete kern
    }
  },

  drawStunAura(ctx, x, footY) {
    const t = this.time;
    ctx.globalAlpha = 0.22; Sprites.px(ctx, '#6ab8ff', x - 7, footY - 32, 14, 32); ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) {
      const a = t / 55 + i * Math.PI / 2;
      Sprites.px(ctx, (i % 2 ? '#cfeeff' : '#4aa6ff'), Math.round(x + Math.cos(a) * 9), Math.round(footY - 16 + Math.sin(a) * 13), 2, 2);
    }
  },

  // combo-teller in beeld (x1..x5) + verdiende XP
  drawComboHud(ctx) {
    const p = this.player;
    if (!p.combo || this.time >= (p.comboUntil || 0)) return;
    const W = CONFIG.VIEW_W;
    const alpha = Math.min(1, (p.comboUntil - this.time) / 400);     // fade-out op het einde
    ctx.save();
    ctx.globalAlpha = alpha; ctx.textAlign = 'center';
    const col = p.combo >= 5 ? '#ff4d4d' : (p.combo >= 3 ? '#ffb02e' : '#ffe27a');
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = '#000'; ctx.fillText('x' + p.combo, W / 2 + 1, 45);
    ctx.fillStyle = col; ctx.fillText('x' + p.combo, W / 2, 44);
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.fillStyle = '#cfe6ff';
    ctx.fillText(p._lastComboXp ? ('+' + p._lastComboXp + ' XP') : 'COMBO', W / 2, 57);
    ctx.restore();
    ctx.textAlign = 'left';
  },

  renderLightning(ctx) {
    if (!this.lightningFx) return;
    if (this.time > this.lightningFx.until) { this.lightningFx = null; return; }
    const camX = Math.round(this.vsCamX), camY = Math.round(this.vsCamY);
    const tx = Math.round(this.lightningFx.wx - camX), ty = Math.round(this.lightningFx.wy - camY - 8);
    ctx.save(); ctx.lineCap = 'round';
    const zig = () => { ctx.beginPath(); ctx.moveTo(tx, 0); const segs = 6; for (let i = 1; i <= segs; i++) { const cy = ty * i / segs; const cx = tx + (i < segs ? (Math.random() - 0.5) * 24 : 0); ctx.lineTo(cx, cy); } ctx.stroke(); };
    ctx.globalAlpha = 0.4; ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 6; zig();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; zig();
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
    if (this.state === 'story') { this._storyElapsed = (this._storyElapsed || 0) + dt; this.renderStory(); }

    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  },
};
