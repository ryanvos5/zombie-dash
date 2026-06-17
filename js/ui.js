/* ============================================================
   UI — schermbeheer, shop, level-select, HUD.
   ============================================================ */

const UI = {
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), touch: $('touch-controls'), pause: $('pause-btn'),
      menu: $('menu-screen'), level: $('level-screen'), shop: $('shop-screen'),
      win: $('win-screen'), lose: $('lose-screen'),
      progressFill: $('progress-fill'), progressPlayer: $('progress-player'),
      levelName: $('level-name'), healthFill: $('health-fill'),
      coinCount: $('coin-count'), weaponName: $('weapon-name'),
      ammoCount: $('ammo-count'), ammoNum: $('ammo-num'),
      banner: $('game-banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'),
      bossHpWrap: $('boss-hp-wrap'), bossHpFill: $('boss-hp-fill'), tutorialBox: $('tutorial-box'),
      menuCoins: $('menu-coin-count'), shopCoins: $('shop-coin-count'),
      charCoins: $('char-coin-count'),
      levelGrid: $('level-grid'), shopGrid: $('shop-grid'), charGrid: $('character-grid'),
      character: $('character-screen'), arena: $('arena-screen'),
      arenaRound: $('arena-round'), arenaCoins: $('arena-coins'), arenaBest: $('arena-best'),
      arenaLeft: $('arena-left'), arenaRecord: $('arena-record'),
      winKills: $('win-kills'), winCoins: $('win-coins'),
      loseKills: $('lose-kills'), loseCoins: $('lose-coins'), loseTitle: $('lose-title'),
    };

    // menu knoppen
    $('btn-play').onclick = () => { this.renderLevels(); this.show('level'); };
    $('btn-shop').onclick = () => { this.renderShop(); this.show('shop'); };
    $('btn-characters').onclick = () => { this.renderCharacters(); this.show('character'); };
    $('btn-win-shop').onclick = () => { this.renderShop(); this.show('shop'); };
    $('btn-arena').onclick = () => this.startArena();
    $('btn-arena-again').onclick = () => this.startArena();
    $('btn-next').onclick = () => Game.nextLevel();
    $('btn-retry').onclick = () => Game.retryLevel();

    // terug-knoppen
    document.querySelectorAll('[data-back]').forEach((b) => {
      b.onclick = () => {
        const t = b.dataset.back;
        if (t === 'level') { this.renderLevels(); this.show('level'); }
        else this.show('menu');
      };
    });

    // pauze
    this.el.pause.onclick = () => Game.togglePause();
    $('btn-resume').onclick = () => Game.togglePause();
    $('btn-restart').onclick = () => Game.retryLevel();
    $('btn-quit').onclick = () => Game.quitToMenu();

    // nieuw spel (wist alle voortgang)
    $('btn-newgame').onclick = () => {
      if (confirm('Nieuw spel starten? Al je munten, wapens, characters en levelvoortgang worden gewist.')) {
        Storage.reset();
        this.show('menu');
      }
    };

    // fullscreen
    const fsBtn = document.getElementById('fs-btn');
    if (fsBtn) fsBtn.onclick = () => this.toggleFullscreen();
    ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) =>
      document.addEventListener(ev, () => {
        const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
        document.body.classList.toggle('fs', on);
      })
    );

    if (Input.isTouch()) document.body.classList.add('is-touch');
  },

  toggleFullscreen() {
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        const p = req.call(el);
        // probeer landscape af te dwingen (werkt op Android/Chrome; iPhone negeert dit stil)
        const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); } catch (e) {} };
        if (p && p.then) p.then(lock).catch(() => {}); else lock();
      } else {
        // iPhone Safari heeft geen fullscreen-API: tip de speler over 'Zet op beginscherm'
        alert('Tip voor iPhone: draai je telefoon horizontaal, of voeg de pagina toe aan je beginscherm (deel-knop → "Zet op beginscherm") voor volledig scherm.');
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
    }
  },

  // toon één scherm; regel HUD/touch/pauze zichtbaarheid
  // Zombie Knock-out starten (met dagelijkse limiet)
  startArena() {
    const left = Storage.arenaPlaysLeft();
    if (left <= 0) {
      alert('Je hebt vandaag al ' + ARENA_PLAYS_PER_DAY + ' keer Zombie Knock-out gespeeld. Kom morgen terug!');
      return;
    }
    Game.startArena();
  },

  showArenaOver(stats) {
    this.el.arenaRound.textContent = stats.round;
    this.el.arenaCoins.textContent = stats.coins;
    this.el.arenaBest.textContent = stats.best;
    this.el.arenaLeft.textContent = Storage.arenaPlaysLeft();
    this.el.arenaRecord.classList.toggle('hidden', !stats.record);
    // knop uitschakelen als er geen pogingen meer zijn
    const again = document.getElementById('btn-arena-again');
    if (Storage.arenaPlaysLeft() <= 0) { again.classList.add('cant'); again.disabled = true; }
    else { again.classList.remove('cant'); again.disabled = false; }
    this.show('arena');
  },

  show(name) {
    ['menu', 'level', 'shop', 'character', 'arena', 'win', 'lose'].forEach((s) => {
      this.el[s].classList.toggle('hidden', s !== name);
    });
    const inGame = (name === 'game');
    document.body.classList.toggle('in-game', inGame);
    this.el.hud.classList.toggle('hidden', !inGame);
    this.el.pause.classList.toggle('hidden', !inGame);
    this.el.touch.classList.toggle('hidden', !inGame || !Input.isTouch());
    if (!inGame) { this.el.tutorialBox.classList.add('hidden'); this.el.banner.classList.add('hidden'); }

    // muntentellers bijwerken
    this.el.menuCoins.textContent = Storage.data.coins;
    if (name === 'menu') {
      const ab = document.getElementById('btn-arena');
      if (ab) ab.textContent = 'ZOMBIE KNOCK-OUT (' + Storage.arenaPlaysLeft() + '×)';
    }
  },

  // wereld 2 is pas open als wereld 1 (incl. boss) is uitgespeeld
  worldUnlocked(worldId) { return worldId === 1 || Storage.highestCleared(worldId - 1) >= 10; },

  // ---------- LEVEL SELECT ----------
  renderLevels() {
    if (!this.viewWorld || !this.worldUnlocked(this.viewWorld)) this.viewWorld = 1;
    // wereld-tabs
    const tabs = document.getElementById('world-tabs');
    tabs.innerHTML = '';
    WORLDS.forEach((w) => {
      const open = this.worldUnlocked(w.id);
      const tab = document.createElement('button');
      tab.className = 'world-tab' + (w.id === this.viewWorld ? ' active' : '') + (open ? '' : ' locked');
      tab.textContent = open ? ('Wereld ' + w.id) : ('Wereld ' + w.id + ' 🔒');
      if (open) tab.onclick = () => { this.viewWorld = w.id; this.renderLevels(); };
      tabs.appendChild(tab);
    });

    const world = WORLDS.find((w) => w.id === this.viewWorld);
    document.getElementById('world-sub').textContent = 'Wereld ' + world.id + ' — ' + world.name;

    const grid = this.el.levelGrid;
    grid.innerHTML = '';
    const cleared = Storage.highestCleared(world.id);
    world.levels.forEach((lv) => {
      const unlocked = Storage.isLevelUnlocked(world.id, lv.id);
      const isCleared = lv.id <= cleared;
      const cell = document.createElement('div');
      cell.className = 'level-cell' + (unlocked ? '' : ' locked') + (isCleared ? ' cleared' : '');
      const badge = lv.mode === 'horde' ? '<div class="lvl-badge">HORDE</div>'
        : lv.mode === 'melee' ? '<div class="lvl-badge">MELEE</div>'
        : lv.mode === 'boss' ? '<div class="lvl-badge boss">BOSS</div>'
        : lv.parkour ? '<div class="lvl-badge">PARKOUR</div>' : '';
      cell.innerHTML = `${badge}<div class="num">${lv.id}</div><div class="stars">${isCleared ? '★' : ''}</div>`;
      if (unlocked) cell.onclick = () => Game.startLevel(world.id, lv.id);
      grid.appendChild(cell);
    });
  },

  // ---------- SHOP ----------
  renderShop() {
    this.el.shopCoins.textContent = Storage.data.coins;
    const grid = this.el.shopGrid;
    grid.innerHTML = '';

    WEAPON_ORDER.forEach((wid) => {
      const w = WEAPONS[wid];
      const owned = Storage.ownsWeapon(wid);
      const equipped = Storage.isEquipped(wid);

      const card = document.createElement('div');
      card.className = 'shop-card' + (owned ? ' owned' : '');

      const canvas = document.createElement('canvas');
      canvas.width = 110; canvas.height = 56;
      const cctx = canvas.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      Sprites.drawWeaponIcon(cctx, wid, 2);

      const slot = w.type === 'melee' ? 'MELEE' : 'VUURWAPEN';
      const dps = w.type === 'melee'
        ? `Schade <b>${w.damage}</b> · Melee`
        : `Schade <b>${w.damage}</b> · ${Math.round(60000 / w.cooldown)}/min`;

      const info = document.createElement('div');
      info.innerHTML = `<div class="w-name">${w.name} <span class="w-slot">${slot}</span></div>
        <div class="w-stats">${dps}<br>${w.desc}</div>`;

      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      if (equipped) {
        btn.classList.add('equipped'); btn.textContent = 'UITGERUST';
      } else if (owned) {
        btn.classList.add('equip'); btn.textContent = 'UITRUSTEN';
        btn.onclick = () => { Storage.equipWeapon(wid); this.renderShop(); };
      } else if (Storage.data.coins >= w.cost) {
        btn.classList.add('buy'); btn.textContent = `KOOP — ${w.cost} ●`;
        btn.onclick = () => {
          if (Storage.buyWeapon(wid)) { Storage.equipWeapon(wid); this.renderShop(); }
        };
      } else {
        btn.classList.add('cant'); btn.textContent = `${w.cost} ● (te weinig)`;
      }

      card.appendChild(canvas);
      card.appendChild(info);
      card.appendChild(btn);
      grid.appendChild(card);
    });

    // ---- kogels bijkopen ----
    const aCard = document.createElement('div');
    aCard.className = 'shop-card owned';
    const aCanvas = document.createElement('canvas');
    aCanvas.width = 110; aCanvas.height = 56;
    const actx = aCanvas.getContext('2d');
    actx.imageSmoothingEnabled = false;
    Sprites.drawAmmoBox(actx, 55, 42, 0);
    Sprites.drawAmmoBox(actx, 40, 42, 1.5);
    Sprites.drawAmmoBox(actx, 70, 42, 3);
    const aInfo = document.createElement('div');
    aInfo.innerHTML = `<div class="w-name">Munitie <span class="w-slot">VOORRAAD</span></div>
      <div class="w-stats">Je hebt nu <b>${Storage.data.ammo}</b> / ${AMMO_MAX} kogels<br>+${AMMO_PACK.amount} kogels per koop</div>`;
    const aBtn = document.createElement('button');
    aBtn.className = 'shop-buy';
    if (Storage.data.ammo >= AMMO_MAX) {
      aBtn.classList.add('cant'); aBtn.textContent = 'VOORRAAD VOL';
    } else if (Storage.data.coins >= AMMO_PACK.cost) {
      aBtn.classList.add('buy'); aBtn.textContent = `KOOP +${AMMO_PACK.amount} — ${AMMO_PACK.cost} ●`;
      aBtn.onclick = () => { if (Storage.buyAmmo()) this.renderShop(); };
    } else {
      aBtn.classList.add('cant'); aBtn.textContent = `${AMMO_PACK.cost} ● (te weinig)`;
    }
    aCard.appendChild(aCanvas);
    aCard.appendChild(aInfo);
    aCard.appendChild(aBtn);
    grid.appendChild(aCard);

    // ---- raketten bijkopen (alleen met Rocket Launcher) ----
    if (Storage.ownsWeapon('rocket')) {
      const rCard = document.createElement('div');
      rCard.className = 'shop-card owned';
      const rCanvas = document.createElement('canvas');
      rCanvas.width = 110; rCanvas.height = 56;
      const rctx = rCanvas.getContext('2d');
      rctx.imageSmoothingEnabled = false;
      Sprites.drawRocketPickup(rctx, 55, 40, 0);
      const rInfo = document.createElement('div');
      rInfo.innerHTML = `<div class="w-name">Raketten <span class="w-slot">RPG</span></div>
        <div class="w-stats">Je hebt nu <b>${Storage.data.rockets}</b> raketten<br>krachtig & explosief (AoE)</div>`;
      const rBtn = document.createElement('button');
      rBtn.className = 'shop-buy';
      if (Storage.data.coins >= ROCKET_COST) {
        rBtn.classList.add('buy'); rBtn.textContent = `KOOP +1 — ${ROCKET_COST} ●`;
        rBtn.onclick = () => { if (Storage.buyRocket()) this.renderShop(); };
      } else {
        rBtn.classList.add('cant'); rBtn.textContent = `${ROCKET_COST} ● (te weinig)`;
      }
      rCard.appendChild(rCanvas);
      rCard.appendChild(rInfo);
      rCard.appendChild(rBtn);
      grid.appendChild(rCard);
    }
  },

  // ---------- CHARACTER SHOP ----------
  renderCharacters() {
    this.el.charCoins.textContent = Storage.data.coins;
    const grid = this.el.charGrid;
    grid.innerHTML = '';

    CHARACTER_ORDER.forEach((cid) => {
      const c = CHARACTERS[cid];
      const owned = Storage.ownsCharacter(cid);
      const equipped = Storage.data.equippedCharacter === cid;

      const card = document.createElement('div');
      card.className = 'shop-card' + (owned ? ' owned' : '');

      // preview-tekening van het character
      const canvas = document.createElement('canvas');
      canvas.width = 110; canvas.height = 64;
      const cctx = canvas.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      cctx.save();
      cctx.translate(55, 4); cctx.scale(1.4, 1.4);
      Sprites.drawCharacter(cctx, 0, 38, 1, c.palette, {
        weapon: 'bat', build: c.build, hair: c.hair,
      });
      cctx.restore();

      // stats t.o.v. Ryan
      const spd = c.speedMul >= 1 ? 'snel' : (c.speedMul >= 0.9 ? 'iets trager' : 'traag');
      const mel = c.meleeMul > 1 ? `+${Math.round((c.meleeMul - 1) * 100)}%` : 'normaal';
      const info = document.createElement('div');
      info.innerHTML = `<div class="w-name">${c.name}</div>
        <div class="w-stats">❤ <b>${c.maxHp}</b> · melee ${mel} · ${spd}<br>${c.desc}</div>`;

      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      if (equipped) {
        btn.classList.add('equipped'); btn.textContent = 'UITGERUST';
      } else if (owned) {
        btn.classList.add('equip'); btn.textContent = 'UITRUSTEN';
        btn.onclick = () => { Storage.equipCharacter(cid); this.renderCharacters(); };
      } else if (Storage.data.coins >= c.cost) {
        btn.classList.add('buy'); btn.textContent = `KOOP — ${c.cost} ●`;
        btn.onclick = () => { if (Storage.buyCharacter(cid)) { Storage.equipCharacter(cid); this.renderCharacters(); } };
      } else {
        btn.classList.add('cant'); btn.textContent = `${c.cost} ● (te weinig)`;
      }

      card.appendChild(canvas);
      card.appendChild(info);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  },

  // ---------- HUD (elke frame) ----------
  updateHUD(game) {
    const lv = game.level;
    let prog;
    if (lv.arena) {
      prog = game.roundTarget ? Math.max(0, Math.min(1, game.roundKills / game.roundTarget)) : 0;
      this.el.levelName.textContent = 'ARENA';
    } else {
      prog = Math.max(0, Math.min(1, (game.player.x - 60) / (lv.length - 60)));
      this.el.levelName.textContent = 'LEVEL ' + lv.id;
    }
    this.el.progressFill.style.width = (prog * 100) + '%';
    this.el.progressPlayer.style.left = (prog * 100) + '%';
    this.el.healthFill.style.width = (game.player.hp / game.player.maxHp * 100) + '%';
    this.el.coinCount.textContent = game.runCoins;
    // melee-wapen altijd tonen (is altijd beschikbaar)
    this.el.weaponName.textContent = '🏏 ' + WEAPONS[game.player.meleeId].name;
    // vuurwapen + munitie alleen als er een gun is uitgerust
    if (game.player.rangedId) {
      const rw = WEAPONS[game.player.rangedId];
      this.el.ammoCount.classList.remove('hidden');
      if (rw.ammoType === 'rocket') {
        this.el.ammoNum.textContent = rw.name + '  🚀' + game.rockets;
        this.el.ammoCount.classList.toggle('low', game.rockets <= 0);
      } else {
        this.el.ammoNum.textContent = rw.name + ' ' + game.ammo;
        this.el.ammoCount.classList.toggle('low', game.ammo <= 10);
      }
    } else {
      this.el.ammoCount.classList.add('hidden');
    }
    this.updateBanner(game);
    this.updateTutorial(game);
  },

  // scherpe status-tekst (objectief / timers / boss) in de DOM
  updateBanner(game) {
    let main = '', sub = '', cls = '', bossFrac = -1;
    const lv = game.level;
    if (game.boss && game.boss.alive) {
      main = lv.balloonBoss ? '🎈 BALLON ZOMBIE' : '☠ MEGA ZOMBIE';
      sub = lv.balloonBoss ? 'spring & schiet de ballon neer!' : 'raak alleen het HOOFD — spring!';
      cls = 'danger';
      bossFrac = Math.max(0, game.boss.hp / game.boss.maxHp);
    } else if (lv.arena) {
      main = 'RONDE ' + game.round; cls = 'good';
      if (game.roundBreak > 0) sub = 'RONDE VOLTOOID! +' + game.roundCfg.bonus + ' ●';
      else sub = 'nog ' + Math.max(0, game.roundTarget - game.roundKills) + ' zombies   •   record: ronde ' + Storage.data.arenaBest;
    } else if (lv.mode === 'horde') {
      const sec = Math.ceil(game.hordeLeft / 1000);
      main = 'OVERLEEF: ' + sec + 's'; cls = sec <= 5 ? 'danger' : '';
    } else {
      const parts = [];
      if (lv.killAll) {
        const rem = game.zombiesRemaining();
        main = rem > 0 ? ('ZOMBIES OVER: ' + rem) : '→ NAAR DE FINISH!';
        cls = rem > 0 ? 'danger' : 'good';
      }
      if (lv.midTime && !game.midReached) parts.push('⚑ checkpoint: ' + Math.ceil(game.midLeft / 1000) + 's');
      if (lv.mode === 'melee') parts.push('⚠ alleen melee');
      sub = parts.join('   •   ');
    }
    if (main || sub) {
      this.el.banner.classList.remove('hidden');
      this.el.bannerMain.textContent = main;
      this.el.bannerMain.className = cls;
      this.el.bannerSub.textContent = sub;
      this.el.bossHpWrap.classList.toggle('hidden', bossFrac < 0);
      if (bossFrac >= 0) this.el.bossHpFill.style.width = (bossFrac * 100) + '%';
    } else {
      this.el.banner.classList.add('hidden');
    }
  },

  updateTutorial(game) {
    const show = game.tutorialMsg && game.time < game.tutorialUntil;
    this.el.tutorialBox.classList.toggle('hidden', !show);
    if (show) this.el.tutorialBox.textContent = game.tutorialMsg;
  },

  showWin(stats) {
    this.el.winKills.textContent = stats.kills;
    this.el.winCoins.textContent = stats.coins;
    this.show('win');
  },
  showLose(stats) {
    this.el.loseKills.textContent = stats.kills;
    this.el.loseCoins.textContent = stats.coins;
    this.el.loseTitle.textContent = stats.reason === 'time' ? 'NIET BINNEN DE TIJD' : 'DOOD';
    this.show('lose');
  },
};
