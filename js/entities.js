/* ============================================================
   ENTITIES — Player (Ryan), Zombie, Bullet, Particle.
   Coördinaten: x = wereld-x (midden), y = voeten (grond).
   ============================================================ */

class Player {
  constructor(meleeId, rangedId, charId) {
    this.x = 60;
    this.y = CONFIG.GROUND_Y;
    this.vy = 0;
    this.onGround = true;
    this.dir = 1;
    // character-eigenschappen
    this.charId = charId;
    const ch = CHARACTERS[charId] || CHARACTERS.ryan;
    this.meleeId = ch.forcedMelee || meleeId || 'bat';   // Tygo: altijd het schild
    this.rangedId = rangedId || null;       // null = geen vuurwapen uitgerust
    // wapen dat standaard in de hand getoond wordt
    this.weaponId = this.rangedId || this.meleeId;
    this.pal = ch.palette;
    this.build = ch.build || 'normal';
    this.hairStyle = ch.hair || 'natural';
    this.meleeMul = ch.meleeMul || 1;
    this.maxHp = ch.maxHp || 100;
    this.hp = this.maxHp;
    this.speed = 2.2 * (ch.speedMul || 1);
    this.w = this.build === 'bulky' ? 14 : (this.build === 'tall' ? 13 : (this.build === 'small' ? 10 : 12));
    // hitbox-breedte tegen projectielen (klein = lastiger te raken)
    this.hitHalfW = this.build === 'small' ? 5 : (this.build === 'bulky' ? 9 : 8);
    // schild-blok (Tygo)
    this.shieldBlock = !!ch.shieldBlock;
    this.blockCdUntil = 0;
    this._shieldUp = false;
    this._now = 0;
    this.ducking = false;
    this.walkPhase = 0;
    this.walkTimer = 0;
    this.lastAttack = -9999;
    this.attackAnimUntil = 0;
    this.buffs = { rage: 0, speed: 0, shield: 0 }; // eindtijden van power-ups
    this.maxJumps = 1;   // wordt 2 in wereld 2 (dubbel-jump)
    this.jumps = 1;
    this.dblJumpMul = ch.dblJumpMul || 1;   // Tygo springt z'n dubbel-jump hoger
    this.groundPound = !!ch.groundPound;    // Just: stamp-schade bij de landing
    this._poundCd = 0; this._poundHit = false;
    this.jumping = false; // bezig met een (variabele) sprong
    // Vince: vuuraura — elke 30s, 5s lang; aanraking geeft 3s burn
    this.fireAura = !!ch.fireAura;
    this.auraNextAt = 30000;   // eerste aura na 30s spelen
    this.auraUntil = 0;
    this._auraOn = false;
    // Timo: automatische rage — elke 30s, 3s lang (2x schade)
    this.autoRage = !!ch.autoRage;
    this.rageNextAt = 30000;
    this.burnUntil = 0;        // brandt de speler zelf (versus)
    this.burnNextTick = 0;
  }

  get height() { return this.ducking ? 20 : 29; }

  hasBuff(name, time) { return (this.buffs[name] || 0) > time; }
  get dmgMult() { return this._rageActive ? 2 : 1; }

  // blokkeer op auto's (springen) en lage balken (duiken)
  resolveObstacles(game, prevX) {
    for (const o of game.obstacles) {
      if (o.dead) continue;
      const overlap = Math.abs(this.x - o.x) < (o.w / 2 + this.w / 2);
      if (!overlap) continue;
      if (o.type === 'car') {
        const topY = CONFIG.GROUND_Y - o.h;
        if (this.y > topY + 3) this.x = prevX;   // niet hoog genoeg -> geblokkeerd (spring eroverheen)
      } else if (o.type === 'lowbar') {
        if (!this.ducking) this.x = prevX;        // alleen duikend erdoor
      }
    }
  }

  update(dt, game, inputOverride) {
    const s = game.dtScale;
    const inp = inputOverride || Input.state;          // bot kan eigen input meegeven

    // richting bepalen
    if (inp.left && !inp.right) this.dir = -1;
    else if (inp.right && !inp.left) this.dir = 1;

    // duiken (alleen op de grond)
    this.ducking = inp.duck && this.onGround;

    // dash: 2x snel links/rechts tikken -> korte snelle burst (met cooldown)
    const dashDir = inputOverride ? (inp.dashDir || 0) : Input.dashDir;
    if (dashDir && !this.ducking && game.time >= (this.dashCdUntil || 0)) {
      this.dir = dashDir;
      this.dashVx = dashDir * CONFIG.DASH_SPEED;
      this.dashUntil = game.time + CONFIG.DASH_TIME;
      this.dashCdUntil = game.time + CONFIG.DASH_CD;
      // stofwolk bij de voeten
      if (game.particles) for (let i = 0; i < 6; i++)
        game.particles.push(new Particle(this.x - dashDir * 8, this.y - 4 + Math.random() * 4, -dashDir * (0.6 + Math.random()), -Math.random() * 0.5, '#cfd6e0', 280, 2));
    }

    // actieve power-ups
    this._rageActive = this.hasBuff('rage', game.time);
    this._shieldActive = this.hasBuff('shield', game.time);

    // Tygo's schild: omhoog zolang je de meleeknop indrukt (en niet in cooldown na een blok)
    this._now = game.time;
    const meleeHeld = inp.melee || (!this.rangedId && inp.attack);
    this._shieldUp = this.shieldBlock && meleeHeld && game.time >= this.blockCdUntil;
    if (this._blockedHit) { // visuele feedback na een blok
      this._blockedHit = false;
      game.spawnArmorSpark(this.x + this.dir * 14, this.y - 16);
      game.shake = Math.max(game.shake, 4);
    }

    // Vince: vuuraura (elke 30s, 5s lang) — aanraking zet zombies in brand
    if (this.fireAura) {
      if (game.time >= this.auraNextAt) {
        this.auraUntil = game.time + 5000;          // 5s actief
        this.auraNextAt = game.time + 30000;        // weer over 30s
      }
      this._auraOn = game.time < this.auraUntil;
      if (this._auraOn) {
        // vuur-deeltjes om Vince heen
        if (game.particles && game.particles.length < 240) {
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 8;
            game.particles.push(new Particle(
              this.x + Math.cos(a) * r, this.y - 14 + Math.sin(a) * 12,
              (Math.random() - 0.5) * 0.6, -0.6 - Math.random() * 0.8,
              Math.random() < 0.5 ? '#ff8a2a' : '#ffd24a', 360, 2));
          }
        }
        // zombies binnen de aura in brand zetten (3s)
        for (const z of game.zombies) {
          if (z.alive && Math.abs(z.x - this.x) < 22 && Math.abs(z.cy - (this.y - 14)) < 24) {
            z.burnUntil = game.time + 3000;
          }
        }
      }
    }

    // Timo: automatische rage (elke 30s, 3s lang -> 2x schade)
    if (this.autoRage && game.time >= this.rageNextAt) {
      this.buffs.rage = game.time + 3000;
      this.rageNextAt = game.time + 30000;
      if (game.particles) for (let i = 0; i < 8; i++)
        game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 14, this.y - 14, (Math.random() - 0.5) * 2, -1 - Math.random(), '#ff5a3a', 360, 2));
    }

    // brandt de speler zelf? (versus) -> schade over tijd
    if (this.burnUntil > game.time) {
      if (game.time >= this.burnNextTick) { this.burnNextTick = game.time + 500; this.takeDamage(7); }
    }

    // snelheid (power-up + duik-loop is langzamer)
    let spd = this.speed;
    if (this.hasBuff('speed', game.time)) spd *= 1.5;
    if (this.ducking) spd *= 0.5;

    // horizontaal bewegen (ook tijdens duiken, maar langzaam)
    const prevX = this.x;
    let moving = false;
    if (inp.left) { this.x -= spd * s; moving = true; }
    if (inp.right) { this.x += spd * s; moving = true; }
    // dash-burst (zelf-geactiveerd) — beweegt snel tot dashUntil
    if (game.time < (this.dashUntil || 0)) { this.x += this.dashVx * s; moving = true; this._dashing = true; }
    else this._dashing = false;
    // weggeslagen worden (versus: grote melee-knockback) — momentum dat uitdooft
    if (this.knockVx) {
      this.x += this.knockVx * s;
      this.knockVx *= 0.90;
      if (Math.abs(this.knockVx) < 0.3) this.knockVx = 0;
    }
    // binnen het level houden (in versus mag je eraf vallen -> geen klem)
    if (!game.level.versus) this.x = Math.max(20, Math.min(game.level.length + 40, this.x));
    // botsing met obstakels (auto's blokkeren staand, lage balken blokkeren tenzij je duikt)
    if (game.obstacles) this.resolveObstacles(game, prevX);

    // springen (met dubbel-jump vanaf wereld 2)
    const jumpPressed = inputOverride ? inp.jumpPressed : Input.jumpPressed;
    if (jumpPressed && !this.ducking && this.jumps > 0) {
      const air = !this.onGround;              // dit is de dubbel-jump (al in de lucht)
      this.vy = CONFIG.JUMP_VELOCITY * (air ? this.dblJumpMul : 1);
      this.onGround = false;
      this.jumps--;
      this.jumping = true;     // variabele spronghoogte: actief
    }
    // variabele spronghoogte: knop vroeg loslaten = sprong inkorten (lager springen)
    if (this.jumping) {
      if (this.vy >= 0) this.jumping = false;                 // top voorbij
      else if (!inp.jump && this.vy < -6) { this.vy = -6; this.jumping = false; }
    }
    // zwaartekracht
    const prevFeetY = this.y;
    const wasGround = this.onGround;
    const fallSpeed = this.vy;               // valsnelheid bij frame-start (voor de stamp)
    this.onGround = false;
    this.vy += CONFIG.GRAVITY * s;
    this.y += this.vy * s;
    // op autodaken landen (eenrichtings-platform: alleen van bovenaf)
    if (this.vy >= 0 && game.obstacles) {
      for (const o of game.obstacles) {
        if (o.type !== 'car' || o.dead) continue;
        const top = CONFIG.GROUND_Y - o.h;
        if (Math.abs(this.x - o.x) < o.w / 2 + this.w / 2 && prevFeetY <= top + 2 && this.y >= top) {
          this.y = top; this.vy = 0; this.onGround = true;
        }
      }
    }
    // op zwevende parkour-platforms landen (eenrichtings)
    if (this.vy >= 0 && game.platforms) {
      for (const pf of game.platforms) {
        if (Math.abs(this.x - pf.x) < pf.w / 2 + this.w / 2 && prevFeetY <= pf.y + 3 && this.y >= pf.y) {
          this.y = pf.y; this.vy = 0; this.onGround = true;
        }
      }
    }
    // gewone grond (NIET in parkour-levels — daar is een ravijn; ook niet boven een gat)
    if (!game.level.parkour && this.y >= CONFIG.GROUND_Y && !game.overPit(this.x)) {
      this.y = CONFIG.GROUND_Y; this.vy = 0; this.onGround = true;
    }
    // bij landing de sprongen weer opladen
    if (this.onGround) this.jumps = this.maxJumps;

    // Just: STAMP bij een harde landing -> schade rondom
    if (this.groundPound && !wasGround && this.onGround && fallSpeed > 3.5 && game.time >= this._poundCd) {
      this._poundCd = game.time + 450;
      this._poundHit = true;                 // versus leest dit (raakt de tegenstander)
      game.shake = Math.max(game.shake || 0, 7);
      if (game.particles) for (let i = 0; i < 10; i++)
        game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 34, this.y, (Math.random() - 0.5) * 3.5, -0.6 - Math.random(), '#d8d0c0', 320, 2));
      // campagne: zombies in de buurt
      if (game.zombies) for (const z of game.zombies) {
        if (z.alive && Math.abs(z.x - this.x) < 36 && Math.abs(z.cy - this.y) < 42)
          z.takeDamage(Math.round(30 * this.meleeMul), (z.x >= this.x ? 1 : -1), game, 9);
      }
    }

    // loop-animatie
    if (moving && this.onGround) {
      this.walkTimer += dt;
      if (this.walkTimer > 120) { this.walkTimer = 0; this.walkPhase = (this.walkPhase + 1) % 4; }
    } else { this.walkPhase = 0; }

    // aanvallen — aparte slots: vuurknop schiet, meleeknop slaat
    const ranged = this.rangedId ? WEAPONS[this.rangedId] : null;
    const melee = WEAPONS[this.meleeId];
    const gunsJammed = game.level.mode === 'melee';   // melee-only ronde
    if (inp.attack) {
      if (ranged && !gunsJammed) this.useRanged(game, ranged);
      else this.useMelee(game, melee);
    }
    if (inp.melee) this.useMelee(game, melee);   // meleeknop slaat altijd
  }

  useMelee(game, w) {
    const key = 'lastMelee_' + w.id;
    if (game.time - (this[key] || -9999) < w.cooldown) return;
    this[key] = game.time;
    this.attackAnimUntil = game.time + 140;
    this.swingWeapon = w.id;                 // welk wapen er nu gezwaaid wordt (voor de tekening)
    this.swingUntil = game.time + 140;
    const reach = w.range;
    const knock = (w.knock != null) ? w.knock : 9;        // per-wapen terugslag
    const dmg = w.damage * this.meleeMul * (this.hasBuff('rage', game.time) ? 2 : 1);
    for (const z of game.zombies) {
      if (!z.alive) continue;
      if (z.type.id === 'boss') {
        // baas: alleen op de kop raken -> spring ernaast en sla het hoofd
        const atkY = this.y - 16;
        if (Math.abs(z.x - this.x) < reach + z.weakHalfW &&
            atkY >= z.y + z.weakTop && atkY <= z.y + z.weakBot) {
          z.takeDamage(dmg, this.dir, game, 0);
        }
        continue;
      }
      const dx = (z.x - this.x) * this.dir;
      // 'arc'-wapens (flail/bo staff) raken vijanden aan BEIDE kanten (zwiep om je heen)
      const hit = w.arc ? (Math.abs(z.x - this.x) < reach) : (dx > -6 && dx < reach);
      if (hit && Math.abs(z.y - this.y) < 30) {
        const kdir = (z.x >= this.x ? 1 : -1);             // altijd van de speler vandaan
        z.takeDamage(dmg, kdir, game, knock);
      }
    }
    // explosieve vaten kapotslaan
    game.hitBarrels(this.x + this.dir * reach * 0.6, 18, game);
    game.spawnMeleeSwing(this);
  }

  useRanged(game, w) {
    if (game.time - (this.lastShoot || -9999) < w.cooldown) return;
    const hx = this.x + this.dir * 16;
    const hy = this.y - 16;
    const dmg = w.damage * (this.hasBuff('rage', game.time) ? 2 : 1);
    if (w.ammoType === 'rocket') {
      if (game.rockets <= 0) return;          // geen raketten -> gebruik de melee
      this.lastShoot = game.time; game.rockets--;
      this.attackAnimUntil = game.time + 160; this.swingWeapon = null;
      game.rocketShots.push(new Rocket(hx, hy, this.dir * w.bulletSpeed, dmg));
      game.spawnMuzzleFlash(hx, hy, this.dir);
      return;
    }
    if (game.ammo <= 0) { return; }          // geen kogels meer -> gebruik de knuppel
    this.lastShoot = game.time;
    game.ammo--;
    this.attackAnimUntil = game.time + 140;
    this.swingWeapon = null;
    for (let i = 0; i < (w.pellets || 1); i++) {
      const spread = (w.pellets > 1) ? (Math.random() - 0.5) * 1.4 : 0;
      game.bullets.push(new Bullet(hx, hy + i, this.dir * w.bulletSpeed, dmg, spread));
    }
    game.spawnMuzzleFlash(hx, hy, this.dir);
  }

  takeDamage(n) {
    if (this._shieldActive) return;          // schild-power-up blokkeert schade
    if (this._shieldUp) {                    // Tygo's schild blokt deze treffer -> 3s cooldown
      this._shieldUp = false;
      this.blockCdUntil = this._now + SHIELD_BLOCK_CD;
      this._blockedHit = true;
      return;
    }
    this.hp = Math.max(0, this.hp - n);
  }
}

// kies een zombietype op basis van level-kansen
function pickZombieType(level) {
  const r = Math.random();
  if (level.bruteChance && r < level.bruteChance) return ZOMBIE_TYPES.brute;
  if (level.crawlerChance && r < level.bruteChance + level.crawlerChance) return ZOMBIE_TYPES.crawler;
  if (r < level.bruteChance + level.crawlerChance + level.runnerChance) return ZOMBIE_TYPES.runner;
  return ZOMBIE_TYPES.walker;
}

class Zombie {
  constructor(x, level, type) {
    this.type = type || pickZombieType(level);
    const t = this.type;
    this.x = x;
    this.y = CONFIG.GROUND_Y;
    this.vy = 0;
    this.onGround = true;
    this.dir = -1;                 // loopt naar links (richting speler)
    this.maxHp = Math.round(level.zombieHp * t.hpMul);
    this.hp = this.maxHp;
    this.speed = Math.min(level.zombieSpeed * t.speedMul, MAX_ZOMBIE_SPEED);
    this.scale = t.scale;
    this.alive = true;
    this.walkPhase = 0;
    this.walkTimer = 0;
    this.lastBite = -9999;
    this.lastJump = -9999;
    this.hitFlash = 0;
    this.tint = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); // kleurvariatie
    this.emerging = 0;             // > 0 = komt net uit een deur (vervaagt in)

    // aanval-statemachine: 'walk' -> 'windup' -> 'strike'
    this.atk = 'walk';
    this.atkTimer = 0;
    this.struck = false;
    this.lungeVx = 0;

    this.addTimer = 0; // timer voor de baas die adds oproept
    this.shotTimer = 0; // timer voor baas-projectielen

    // hitbox (per type)
    this.reach = t.reach * t.scale;
    if (t.low) { this.cyOff = 9 * t.scale; this.halfH = 11 * t.scale; this.halfW = 10 * t.scale; }
    else { this.cyOff = 16 * t.scale; this.halfH = 17 * t.scale; this.halfW = 7 * t.scale; }

    // zwakke plek (alleen de baas): je kunt 'm enkel op het HOOFD raken
    if (t.id === 'boss') { this.weakTop = -98; this.weakBot = -44; this.weakHalfW = 16; }

    // vliegende types: starten in de lucht met een eigen (centraal) hitbox
    if (t.flying) {
      this.onGround = false;
      this.y = 90;
      this.cyOff = 0;
      this.halfH = t.boss ? 24 : 11;
      this.halfW = t.boss ? 22 : 11;
      this.reach = t.reach;
    }
  }

  // is een treffer op positie (px,py) een kop-treffer? (alleen voor de baas)
  isHeadHit(px, py) {
    return Math.abs(px - this.x) < this.weakHalfW + 2 &&
           py >= this.y + this.weakTop && py <= this.y + this.weakBot;
  }

  // baas roept kleine zombies op (max enkele tegelijk) — ook van achter de speler
  updateSpawner(dt, game) {
    this.addTimer += dt;
    if (this.addTimer < 3200) return;
    this.addTimer = 0;
    const adds = game.zombies.filter((z) => z.alive && z.type.id !== 'boss').length;
    if (adds >= 3) return;
    const type = Math.random() < 0.5 ? ZOMBIE_TYPES.walker : ZOMBIE_TYPES.runner;
    let sx;
    if (Math.random() < 0.3) {
      sx = Math.max(24, game.player.x - 45 - Math.random() * 25);  // achter de speler (verrassing)
    } else {
      sx = this.x - 20 + Math.random() * 40;                        // bij de baas
    }
    let z;
    if (this.type.id === 'balloon') {
      // ballon roept zombie-vogels op (in de lucht)
      z = new Zombie(game.player.x + (Math.random() - 0.5) * 120, game.level, ZOMBIE_TYPES.flyer);
      z.y = 70 + Math.random() * 50;
    } else {
      z = new Zombie(sx, game.level, type);
    }
    z.emerging = 250;
    game.pendingZombies.push(z); // na de update-lus toevoegen (veilig)
  }

  // baas spuugt projectielen — grond-baas spuugt zuur, ballon dropt bommen op de speler
  updateShooter(dt, game) {
    const t = this.type;
    this.shotTimer += dt;
    const enrage = this.hp < this.maxHp * 0.4 ? 0.6 : 1;
    if (this.shotTimer < t.shootEvery * enrage) return;
    this.shotTimer = 0;
    const p = game.player;
    if (t.flying) {
      // ballon: bom richting de speler (ontwijk door weg te bewegen)
      const dxp = p.x - this.x, dyp = (p.y - 16) - this.y, d = Math.hypot(dxp, dyp) || 1;
      const sh = new EnemyShot(this.x, this.y + 8, (dxp / d) * t.shotSpeed, t.shotDmg);
      sh.vyShot = (dyp / d) * t.shotSpeed; sh.aimed = true;
      game.enemyShots.push(sh);
    } else {
      const dir = p.x < this.x ? -1 : 1;
      game.enemyShots.push(new EnemyShot(this.x + dir * 22, CONFIG.GROUND_Y - 16, dir * t.shotSpeed, t.shotDmg));
    }
  }

  get cy() { return this.y - this.cyOff; }

  update(dt, game) {
    if (!this.alive) return;
    // brandwond (Vince' vuuraura): schade over tijd + vuurdeeltjes
    if (this.burnUntil && this.burnUntil > game.time) {
      if (game.time >= (this.burnNextTick || 0)) {
        this.burnNextTick = game.time + 500;
        if (game.particles && game.particles.length < 260)
          game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 8, this.cy - 4, (Math.random() - 0.5) * 0.5, -0.8, '#ff8a2a', 320, 2));
        this.takeDamage(6, 0, game, 0);
        if (!this.alive) return;
      }
    }
    // de baas blijft staan tot de speler begint te lopen
    if (this.type.spawner && !game.spawnArmed) return;
    const s = game.dtScale;
    const player = game.player;
    const t = this.type;

    if (this.emerging > 0) this.emerging -= dt;

    // de baas roept periodiek kleine zombies op + spuugt projectielen
    if (t.spawner) this.updateSpawner(dt, game);
    if (t.shootEvery) this.updateShooter(dt, game);

    // ---- VLIEGENDE types (zombie-vogels & ballon-baas) ----
    if (t.flying) {
      this.onGround = false;
      this.dir = player.x < this.x ? -1 : 1;
      if (t.boss) {
        this._frameT = game.time;   // voor de pulserende schild-bubbel in de tekening
        // af en toe een onkwetsbaar schild om de ballon (een paar seconden)
        if (this._shieldNext == null) this._shieldNext = game.time + 4500;
        if (this.shielded) {
          if (game.time >= this.shieldUntil) {
            this.shielded = false;
            this._shieldNext = game.time + 5000 + Math.random() * 3000; // 5-8s pauze
          }
        } else if (game.time >= this._shieldNext) {
          this.shielded = true;
          this.shieldUntil = game.time + 3000;                          // 3s beschermd
        }
        // ballon: zweef hoog, drift langzaam zodat hij ~boven de speler blijft + bobt
        const targetY = 80 + Math.sin(game.time / 800) * 10;
        this.y += Math.max(-0.6 * s, Math.min(0.6 * s, targetY - this.y));
        if (Math.abs(this.x - player.x) > 50) this.x += this.dir * this.speed * s;
        else this.x += Math.sin(game.time / 1000) * 0.4 * s;
      } else if (t.dropper) {
        // kleine luchtballon: zweeft hoog en dropt af en toe een zombie van bovenaf
        const targetY = 48 + Math.sin(game.time / 700 + this.tint) * 8;
        this.y += Math.max(-0.5 * s, Math.min(0.5 * s, targetY - this.y));
        const dxp = player.x - this.x;
        if (Math.abs(dxp) > 24) this.x += Math.sign(dxp) * this.speed * s;   // drijf naar (boven) de speler
        this.dropTimer = (this.dropTimer || 0) + dt;
        const aliveCount = game.zombies.reduce((n, q) => n + (q.alive ? 1 : 0), 0);
        const ceiling = (game.level.maxAlive || 10) + 6;   // niet eindeloos blijven stapelen
        if (this.dropTimer >= (t.dropEvery || 3200) && aliveCount < ceiling) {
          this.dropTimer = 0;
          const r = Math.random();
          const dt2 = r < 0.35 ? ZOMBIE_TYPES.runner : (r < 0.5 ? ZOMBIE_TYPES.crawler : ZOMBIE_TYPES.walker);
          const dz = new Zombie(this.x, game.level, dt2);
          dz.y = this.y + 8; dz.vy = 1; dz.onGround = false; dz.emerging = 180;  // valt naar beneden
          game.pendingZombies.push(dz);
          for (let k = 0; k < 5; k++) game.spawnBlood(this.x + (Math.random() - 0.5) * 8, this.y + 8);
        }
      } else {
        // vogel: duik richting de speler (x én y), met wat gewiebel
        const dxp = player.x - this.x, dyp = (player.y - 16) - this.y;
        const d = Math.hypot(dxp, dyp) || 1;
        this.x += (dxp / d) * this.speed * s;
        this.y += (dyp / d) * this.speed * 0.65 * s + Math.sin(game.time / 180 + this.tint) * 0.4;
        // aanraking met een vogel: direct dood in de berg-parkour (ravijn-niveaus),
        // maar gewone schade in de jungle (wereld 3) en in de boss fight
        if (Math.abs(player.x - this.x) < this.reach && Math.abs((player.y - 16) - this.y) < 18) {
          if (game.level.flyerOnly && !game.level.isBoss) {
            game.spawnBlood(player.x, player.y - 16);
            player.takeDamage(9999);
          } else {
            if (game.time - this.lastBite > t.biteCd) { this.lastBite = game.time; player.takeDamage(t.dmg); }
          }
        }
      }
      this.walkTimer += dt;
      if (this.walkTimer > 110) { this.walkTimer = 0; this.walkPhase = (this.walkPhase + 1) % 4; }
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }

    // zwaartekracht (voor springende crawlers)
    this.vy += CONFIG.GRAVITY * s;
    this.y += this.vy * s;
    if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.onGround = true; }

    const dx = this.x - player.x;
    const dist = Math.abs(dx);
    this.dir = dx > 0 ? -1 : 1;

    // ---- MEGA ZOMBIE-AAP: springt in één keer naar de speler toe ----
    if (t.apeLeap) {
      const enraged = this.hp < this.maxHp * 0.4;          // razend bij weinig leven
      this.enraged = enraged;
      this._frameT = game.time;                            // voor de pulserende enrage-gloed
      if (this.apeCd == null) this.apeCd = 900;
      if (!this.onGround) {
        this.x += (this.leapVx || 0) * s;                 // boog richting de speler
      } else if (this.leapVx) {
        // LANDING: dreun + SCHOKGOLF over de grond -> spring eroverheen of je krijgt schade
        this.leapVx = 0;
        game.shake = Math.max(game.shake, 12);
        const shockR = 86;
        for (let k = 0; k < 14; k++) game.spawnBlood(this.x + (Math.random() - 0.5) * shockR * 2, CONFIG.GROUND_Y);
        if (this.apeTouches(player)) {
          player.takeDamage(t.dmg); this.lastBite = game.time;            // direct lijf-contact
        } else if (player.onGround && Math.abs(this.x - player.x) < shockR) {
          player.takeDamage(Math.round(t.dmg * 0.6)); this.lastBite = game.time;  // grond-schokgolf
          game.knockPlayer(player.x < this.x ? -1 : 1, 9);
        }
        // razend: vrijwel meteen weer aanvallen (ketting-sprongen)
        this.apeCd = enraged ? 300 + Math.random() * 300 : 900 + Math.random() * 800;
      } else if (this.crouchT > 0) {
        this.crouchT -= dt;                                // ineengedoken (telegraaf vóór de sprong)
        if (this.crouchT <= 0) {
          const dxp = player.x - this.x;
          const vyJump = enraged ? -11.5 : -10.5;          // hoge sprong
          this.vy = vyJump;
          const airFrames = (2 * Math.abs(vyJump)) / CONFIG.GRAVITY;
          const maxVx = enraged ? 9.5 : 7.5;
          this.leapVx = Math.max(-maxVx, Math.min(maxVx, dxp / airFrames));
          this.onGround = false;
        }
      } else {
        this.apeCd -= dt;
        if (this.apeTouches(player) && game.time - this.lastBite > t.biteCd) {
          player.takeDamage(t.dmg); this.lastBite = game.time;  // alleen bij echt contact
        } else if (this.apeCd <= 0 && dist > 30) {
          this.crouchT = enraged ? 190 : 280;             // korter telegraaf bij razend
          this.apeCd = enraged ? 600 + Math.random() * 500 : 1400 + Math.random() * 900;
        } else {
          const sp = this.speed * (enraged ? 1.7 : 1.25);  // sneller naderbij
          this.x += this.dir * sp * s;
          this.separate(game, s);
        }
      }
      // binnen de (kleine) arena houden
      this.x = Math.max(20, Math.min(game.level.length + 20, this.x));
      this.walkTimer += dt;
      if (this.walkTimer > 150) { this.walkTimer = 0; this.walkPhase = (this.walkPhase + 1) % 4; }
      if (this.hitFlash > 0) this.hitFlash -= dt;
      return;
    }

    // crawlers springen naar de speler toe om afstand te overbruggen
    if (t.jumps && this.onGround && dist > this.reach && dist < 110 && game.time - this.lastJump > 1300) {
      this.lastJump = game.time;
      this.vy = -6.5;
      this.x += this.dir * 6;
    }

    // ---- aanval-statemachine ----
    if (this.atk === 'walk') {
      const triggerRange = this.reach + (t.lunge ? 22 : 4);
      if (this.onGround && dist <= triggerRange && game.time - this.lastBite > t.biteCd) {
        if (t.lunge) { this.atk = 'windup'; this.atkTimer = 220; }   // even uithalen (telegraaf)
        else { this.bite(game, player); }
      } else {
        // naar speler lopen (lichte onderlinge afstand zodat ze verdringen, niet stapelen)
        let sp = this.speed;
        this.x += this.dir * sp * s;
        this.separate(game, s);
      }
    } else if (this.atk === 'windup') {
      this.atkTimer -= dt;
      if (this.atkTimer <= 0) { this.atk = 'strike'; this.atkTimer = 200; this.struck = false; this.lungeVx = this.dir * t.lungeSpeed; }
    } else if (this.atk === 'strike') {
      this.atkTimer -= dt;
      this.x += this.lungeVx * s;            // schiet vooruit
      if (!this.struck && Math.abs(this.x - player.x) <= this.reach + 4) {
        this.struck = true;
        this.bite(game, player);
      }
      if (this.atkTimer <= 0) { this.atk = 'walk'; this.lastBite = game.time; }
    }

    // grond-zombies vallen niet in ravijn-gaten: stop netjes aan de rand
    if (this.onGround && game.pits && game.pits.length) {
      for (const p of game.pits) {
        if (this.x > p.x0 - 7 && this.x < p.x1 + 7) {
          this.x = this.dir < 0 ? p.x1 + 7 : p.x0 - 7;   // duw terug naar de rand aan hun kant
          break;
        }
      }
    }

    // loop-animatie
    this.walkTimer += dt;
    if (this.walkTimer > 150) { this.walkTimer = 0; this.walkPhase = (this.walkPhase + 1) % 4; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // raakt de mega-aap de speler ECHT? (alleen bij lijf-contact: dichtbij + niet eroverheen gesprongen)
  apeTouches(player) {
    const dx = Math.abs(this.x - player.x);
    if (dx > this.halfW + 8) return false;            // buiten de lijfbreedte -> mis (ontwijk horizontaal)
    const apeHeadTop = this.y - 76;                     // bovenkant van de aap-kop (sprite)
    return player.y > apeHeadTop;                       // hoog over zijn kop springen = veilig
  }

  // kan deze zombie de speler op deze hoogte raken?
  // normale zombies missen als je over ze heen springt; brutes/baas (groot) en
  // zelf-springende zombies (crawler-leap) raken je ook in de lucht.
  reachesVertically(player) {
    if (this.type.id === 'brute' || this.type.id === 'boss' || this.type.id === 'ape') return true;
    if (!this.onGround) return true;               // deze zombie springt zelf
    const airHeight = CONFIG.GROUND_Y - player.y;  // 0 = op de grond
    return airHeight < 22;                          // hoger = je sprong eroverheen
  }

  bite(game, player) {
    this.lastBite = game.time;
    if (!this.reachesVertically(player)) return;   // speler sprong eroverheen -> mis
    player.takeDamage(this.type.dmg);
    // brutes slaan altijd terug, andere zombies met een kans
    const always = this.type.knockback;
    if (always || Math.random() < (this.type.knockChance || 0)) {
      game.knockPlayer(this.dir, this.type.knockPlayer || 8);
    }
  }

  // duw lichtjes weg van andere zombies (verdringen i.p.v. perfect stapelen)
  separate(game, s) {
    for (const o of game.zombies) {
      if (o === this || !o.alive) continue;
      const d = this.x - o.x;
      if (Math.abs(d) < 11) { this.x += (d >= 0 ? 0.4 : -0.4) * s; }
    }
  }

  takeDamage(n, knockDir, game, knockAmount) {
    if (!this.alive) return;
    if (this.shielded) {                       // ballon-baas: schild absorbeert alles
      this.hitFlash = 60;
      if (game && game.spawnArmorSpark) game.spawnArmorSpark(this.x, this.y - 16);
      return;
    }
    this.hp -= n;
    this.hitFlash = 100;
    const resist = this.type.knockResist != null ? this.type.knockResist : 1;
    const amt = (knockAmount || 4) * resist;
    this.x += knockDir * amt; // door speler weggeslagen (brutes/baas weerstaan dit)
    // klein sprongetje omhoog bij de klap (niet bij knockback-immune zoals de baas)
    if (this.onGround && amt > 0.5) {
      this.vy = -Math.min(4.5, 1.5 + amt * 0.35);
      this.onGround = false;
    }
    if (this.hp <= 0) {
      this.alive = false;
      game.onZombieKilled(this, this.type.coin);
    }
  }
}

class Bullet {
  constructor(x, y, vx, damage, spread) {
    this.x = x; this.y = y;
    this.vx = vx;
    this.vy = spread || 0;
    this.damage = damage;
    this.alive = true;
    this.life = 0;
  }

  update(dt, game) {
    const s = game.dtScale;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.life += dt;
    if (this.life > 1200) this.alive = false;

    for (const z of game.zombies) {
      if (!z.alive) continue;
      if (z.type.id === 'boss') {
        // alleen de KOP doet schade; de body (lager) is gepantserd; ernaast = mis
        if (z.isHeadHit(this.x, this.y)) {
          z.takeDamage(this.damage, Math.sign(this.vx), game, 0);
          game.spawnBlood(this.x, this.y);
          this.alive = false;
          return;
        }
        const bodyTop = z.y + z.weakBot, bodyBot = z.y + 4; // body zit ónder de kop
        if (Math.abs(z.x - this.x) < z.halfW + 2 && this.y >= bodyTop && this.y <= bodyBot) {
          game.spawnArmorSpark(this.x, this.y); // ketst af op het pantser
          this.alive = false;
          return;
        }
        continue; // op kophoogte ernaast: vliegt door tot de kop-kolom
      }
      if (Math.abs(z.x - this.x) < z.halfW + 2 && Math.abs(z.cy - this.y) < z.halfH) {
        z.takeDamage(this.damage, Math.sign(this.vx), game, 4); // kogels duwen licht
        this.alive = false;
        game.spawnBlood(this.x, this.y);
        return;
      }
    }
    // explosief vat raken
    if (game.hitBarrels && game.hitBarrels(this.x, 10, game)) {
      this.alive = false;
    }
  }
}

// raket van de Rocket Launcher: vliegt, ontploft op de eerste zombie of aan het eind (AoE)
class Rocket {
  constructor(x, y, vx, damage) {
    this.x = x; this.y = y; this.vx = vx; this.damage = damage;
    this.alive = true; this.life = 0;
  }
  update(dt, game) {
    const s = game.dtScale;
    this.x += this.vx * s; this.life += dt;
    // rookspoor
    if (Math.random() < 0.7) game.particles.push(new Particle(this.x - Math.sign(this.vx) * 4, this.y, (Math.random() - 0.5), (Math.random() - 0.5), '#9aa3ad', 280, 2));
    if (this.life > 2500 || this.x < 6 || this.x > game.level.length + 60) { game.explodeAt(this.x, this.y, this.damage); this.alive = false; return; }
    for (const z of game.zombies) {
      if (!z.alive) continue;
      if (Math.abs(z.x - this.x) < z.halfW + 6 && Math.abs(z.cy - this.y) < z.halfH + 6) {
        game.explodeAt(this.x, this.y, this.damage); this.alive = false; return;
      }
    }
  }
}

// raket-pickup (geeft 1 raket) — valt zeldzaam, alleen als je de RPG hebt
class RocketPickup {
  constructor(x) {
    this.x = x; this.y = CONFIG.GROUND_Y;
    this.vx = (Math.random() - 0.5) * 2.4; this.vy = -2.6 - Math.random() * 1.5;
    this.onGround = false; this.life = 16000; this.dead = false; this.bob = Math.random() * 6.28;
    this.isRocket = true;
  }
  update(dt, game) {
    const s = game.dtScale;
    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * s; this.y += this.vy * s; this.x += this.vx * s;
      if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.vx = 0; this.onGround = true; }
    }
    this.bob += dt * 0.005; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    if (Math.abs(p.x - this.x) < 15 && Math.abs(p.y - this.y) < 28) {
      game.rockets += 1;
      game.ammoFx.push({ x: this.x, y: this.y - 18, n: 0, rocket: 1, vy: -0.6, life: 900 });
      this.dead = true;
    }
  }
}

// vijandelijk projectiel. grond-zuur: spring eroverheen. aimed (ballon-bom): ontwijk door weg te bewegen.
class EnemyShot {
  constructor(x, y, vx, dmg) {
    this.x = x; this.y = y; this.vx = vx; this.vyShot = 0; this.dmg = dmg;
    this.aimed = false;
    this.alive = true; this.life = 0; this.spin = 0;
  }
  update(dt, game) {
    const s = game.dtScale;
    this.x += this.vx * s;
    this.y += this.vyShot * s;
    this.life += dt; this.spin += dt * 0.02;
    if (this.life > 5000 || this.x < 6 || this.x > game.level.length + 60 || this.y > CONFIG.VIEW_H + 10) { this.alive = false; return; }
    const p = game.player;
    let hit;
    const hw = (p.hitHalfW != null) ? p.hitHalfW : 8;   // kleine karakters = kleinere hitbox
    if (this.aimed) {
      // gerichte bom: treft op nabijheid (ontwijk door weg te bewegen/springen)
      hit = Math.abs(p.x - this.x) < hw + 4 && Math.abs((p.y - 16) - this.y) < 14;
    } else {
      // grond-zuur op torso-hoogte: spring eroverheen (airHeight > 22 = mis)
      hit = Math.abs(p.x - this.x) < hw + 3 && (CONFIG.GROUND_Y - p.y) < 22;
    }
    if (hit) {
      p.takeDamage(this.dmg);
      game.knockPlayer(Math.sign(this.vx) || 1, 8);
      game.spawnBlood(this.x, this.y);
      this.alive = false;
    }
  }
}

// power-up op de grond (loop erover om op te pakken)
class PowerUpPickup {
  constructor(x, kind) {
    this.x = x;
    this.y = CONFIG.GROUND_Y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -3 - Math.random() * 1.5;
    this.onGround = false;
    this.kind = kind;
    this.life = 14000;
    this.dead = false;
    this.bob = Math.random() * 6.28;
  }
  update(dt, game) {
    const s = game.dtScale;
    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * s;
      this.y += this.vy * s; this.x += this.vx * s;
      if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.vx = 0; this.onGround = true; }
    }
    this.bob += dt * 0.006;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    if (Math.abs(p.x - this.x) < 15 && Math.abs(p.y - this.y) < 30) {
      const pu = POWERUPS[this.kind];
      p.buffs[this.kind] = game.time + pu.dur;
      game.onPowerUp(this.kind, this.x);
      this.dead = true;
    }
  }
}

// munitie die op de grond valt; loop erover om op te rapen
class AmmoPickup {
  constructor(x, amount) {
    this.x = x;
    this.y = CONFIG.GROUND_Y;
    this.vx = (Math.random() - 0.5) * 2.4;       // spat een beetje weg
    this.vy = -2.5 - Math.random() * 1.6;        // wipt omhoog en valt dan
    this.onGround = false;
    this.amount = amount;
    this.life = 14000;                           // blijft 14s liggen, dan verdwijnt
    this.dead = false;
    this.bob = Math.random() * 6.28;
  }

  update(dt, game) {
    const s = game.dtScale;
    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * s;
      this.y += this.vy * s;
      this.x += this.vx * s;
      if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.vx = 0; this.onGround = true; }
    }
    this.bob += dt * 0.005;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    // oppakken bij contact met de speler
    const p = game.player;
    if (Math.abs(p.x - this.x) < 14 && Math.abs(p.y - this.y) < 28) {
      game.ammo += this.amount;
      game.ammoFx.push({ x: this.x, y: this.y - 18, n: this.amount, vy: -0.6, life: 800 });
      this.dead = true;
    }
  }
}

// EHBO-doosje; loop erover om HP terug te krijgen
class HealthPickup {
  constructor(x) {
    this.x = x;
    this.y = CONFIG.GROUND_Y;
    this.vx = (Math.random() - 0.5) * 2.4;
    this.vy = -2.5 - Math.random() * 1.6;
    this.onGround = false;
    this.life = 16000;
    this.dead = false;
    this.bob = Math.random() * 6.28;
  }
  update(dt, game) {
    const s = game.dtScale;
    if (!this.onGround) {
      this.vy += CONFIG.GRAVITY * s;
      this.y += this.vy * s;
      this.x += this.vx * s;
      if (this.y >= CONFIG.GROUND_Y) { this.y = CONFIG.GROUND_Y; this.vy = 0; this.vx = 0; this.onGround = true; }
    }
    this.bob += dt * 0.005;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    // alleen oppakken als je niet al vol leven hebt
    if (p.hp < p.maxHp && Math.abs(p.x - this.x) < 14 && Math.abs(p.y - this.y) < 28) {
      p.hp = Math.min(p.maxHp, p.hp + HEALTH_PACK_HEAL);
      game.ammoFx.push({ x: this.x, y: this.y - 18, n: 0, hp: HEALTH_PACK_HEAL, vy: -0.6, life: 800 });
      this.dead = true;
    }
  }
}

class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
    this.size = size || 2;
  }
  update(dt, game) {
    const s = game.dtScale;
    this.x += this.vx * s;
    this.y += this.vy * s;
    this.vy += 0.25 * s;
    this.life -= dt;
  }
}
