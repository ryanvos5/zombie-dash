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
    this.meleeId = meleeId || 'bat';
    this.rangedId = rangedId || null;       // null = geen vuurwapen uitgerust
    // wapen dat standaard in de hand getoond wordt
    this.weaponId = this.rangedId || this.meleeId;
    // character-eigenschappen
    this.charId = charId;
    const ch = CHARACTERS[charId] || CHARACTERS.ryan;
    this.pal = ch.palette;
    this.build = ch.build || 'normal';
    this.hairStyle = ch.hair || 'natural';
    this.meleeMul = ch.meleeMul || 1;
    this.maxHp = ch.maxHp || 100;
    this.hp = this.maxHp;
    this.speed = 2.2 * (ch.speedMul || 1);
    this.w = this.build === 'bulky' ? 14 : 12;
    this.ducking = false;
    this.walkPhase = 0;
    this.walkTimer = 0;
    this.lastAttack = -9999;
    this.attackAnimUntil = 0;
    this.buffs = { rage: 0, speed: 0, shield: 0 }; // eindtijden van power-ups
    this.maxJumps = 1;   // wordt 2 in wereld 2 (dubbel-jump)
    this.jumps = 1;
    this.jumping = false; // bezig met een (variabele) sprong
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

  update(dt, game) {
    const s = game.dtScale;
    const inp = Input.state;

    // richting bepalen
    if (inp.left && !inp.right) this.dir = -1;
    else if (inp.right && !inp.left) this.dir = 1;

    // duiken (alleen op de grond)
    this.ducking = inp.duck && this.onGround;

    // actieve power-ups
    this._rageActive = this.hasBuff('rage', game.time);
    this._shieldActive = this.hasBuff('shield', game.time);

    // snelheid (power-up + duik-loop is langzamer)
    let spd = this.speed;
    if (this.hasBuff('speed', game.time)) spd *= 1.5;
    if (this.ducking) spd *= 0.5;

    // horizontaal bewegen (ook tijdens duiken, maar langzaam)
    const prevX = this.x;
    let moving = false;
    if (inp.left) { this.x -= spd * s; moving = true; }
    if (inp.right) { this.x += spd * s; moving = true; }
    // binnen het level houden
    this.x = Math.max(20, Math.min(game.level.length + 40, this.x));
    // botsing met obstakels (auto's blokkeren staand, lage balken blokkeren tenzij je duikt)
    if (game.obstacles) this.resolveObstacles(game, prevX);

    // springen (met dubbel-jump vanaf wereld 2)
    if (Input.jumpPressed && !this.ducking && this.jumps > 0) {
      this.vy = CONFIG.JUMP_VELOCITY;
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
    // gewone grond (NIET in parkour-levels — daar is een ravijn)
    if (!game.level.parkour && this.y >= CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y; this.vy = 0; this.onGround = true;
    }
    // bij landing de sprongen weer opladen
    if (this.onGround) this.jumps = this.maxJumps;

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
      if (dx > -6 && dx < reach && Math.abs(z.y - this.y) < 30) {
        z.takeDamage(dmg, this.dir, game, 9); // melee slaat zombies hard naar achter
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
        // ballon: zweef hoog, drift langzaam zodat hij ~boven de speler blijft + bobt
        const targetY = 80 + Math.sin(game.time / 800) * 10;
        this.y += Math.max(-0.6 * s, Math.min(0.6 * s, targetY - this.y));
        if (Math.abs(this.x - player.x) > 50) this.x += this.dir * this.speed * s;
        else this.x += Math.sin(game.time / 1000) * 0.4 * s;
      } else {
        // vogel: duik richting de speler (x én y), met wat gewiebel
        const dxp = player.x - this.x, dyp = (player.y - 16) - this.y;
        const d = Math.hypot(dxp, dyp) || 1;
        this.x += (dxp / d) * this.speed * s;
        this.y += (dyp / d) * this.speed * 0.65 * s + Math.sin(game.time / 180 + this.tint) * 0.4;
        // aanraking met een vogel: direct dood in de bergniveaus, maar gewone schade in de boss fight
        if (Math.abs(player.x - this.x) < this.reach && Math.abs((player.y - 16) - this.y) < 18) {
          if (game.level.isBoss) {
            if (game.time - this.lastBite > t.biteCd) { this.lastBite = game.time; player.takeDamage(t.dmg); }
          } else {
            game.spawnBlood(player.x, player.y - 16);
            player.takeDamage(9999);
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

    // loop-animatie
    this.walkTimer += dt;
    if (this.walkTimer > 150) { this.walkTimer = 0; this.walkPhase = (this.walkPhase + 1) % 4; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  // kan deze zombie de speler op deze hoogte raken?
  // normale zombies missen als je over ze heen springt; brutes/baas (groot) en
  // zelf-springende zombies (crawler-leap) raken je ook in de lucht.
  reachesVertically(player) {
    if (this.type.id === 'brute' || this.type.id === 'boss') return true;
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
    if (this.aimed) {
      // gerichte bom: treft op nabijheid (ontwijk door weg te bewegen/springen)
      hit = Math.abs(p.x - this.x) < 12 && Math.abs((p.y - 16) - this.y) < 14;
    } else {
      // grond-zuur op torso-hoogte: spring eroverheen (airHeight > 22 = mis)
      hit = Math.abs(p.x - this.x) < 11 && (CONFIG.GROUND_Y - p.y) < 22;
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
