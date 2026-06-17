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
      menuCoins: $('menu-coin-count'), shopCoins: $('shop-coin-count'),
      charCoins: $('char-coin-count'),
      levelGrid: $('level-grid'), shopGrid: $('shop-grid'), charGrid: $('character-grid'),
      character: $('character-screen'),
      winKills: $('win-kills'), winCoins: $('win-coins'),
      loseKills: $('lose-kills'), loseCoins: $('lose-coins'),
    };

    // menu knoppen
    $('btn-play').onclick = () => { this.renderLevels(); this.show('level'); };
    $('btn-shop').onclick = () => { this.renderShop(); this.show('shop'); };
    $('btn-characters').onclick = () => { this.renderCharacters(); this.show('character'); };
    $('btn-win-shop').onclick = () => { this.renderShop(); this.show('shop'); };
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
  show(name) {
    ['menu', 'level', 'shop', 'character', 'win', 'lose'].forEach((s) => {
      this.el[s].classList.toggle('hidden', s !== name);
    });
    const inGame = (name === 'game');
    document.body.classList.toggle('in-game', inGame);
    this.el.hud.classList.toggle('hidden', !inGame);
    this.el.pause.classList.toggle('hidden', !inGame);
    this.el.touch.classList.toggle('hidden', !inGame || !Input.isTouch());

    // muntentellers bijwerken
    this.el.menuCoins.textContent = Storage.data.coins;
    if (name === 'menu') this.el.menuCoins.textContent = Storage.data.coins;
  },

  // ---------- LEVEL SELECT ----------
  renderLevels() {
    const world = WORLDS[0];
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
        : lv.mode === 'boss' ? '<div class="lvl-badge boss">BOSS</div>' : '';
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
    const prog = Math.max(0, Math.min(1, (game.player.x - 60) / (lv.length - 60)));
    this.el.progressFill.style.width = (prog * 100) + '%';
    this.el.progressPlayer.style.left = (prog * 100) + '%';
    this.el.levelName.textContent = 'LEVEL ' + lv.id;
    this.el.healthFill.style.width = (game.player.hp / game.player.maxHp * 100) + '%';
    this.el.coinCount.textContent = game.runCoins;
    // melee-wapen altijd tonen (is altijd beschikbaar)
    this.el.weaponName.textContent = '🏏 ' + WEAPONS[game.player.meleeId].name;
    // vuurwapen + munitie alleen als er een gun is uitgerust
    if (game.player.rangedId) {
      this.el.ammoCount.classList.remove('hidden');
      this.el.ammoNum.textContent = WEAPONS[game.player.rangedId].name + ' ' + game.ammo;
      this.el.ammoCount.classList.toggle('low', game.ammo <= 10);
    } else {
      this.el.ammoCount.classList.add('hidden');
    }
  },

  showWin(stats) {
    this.el.winKills.textContent = stats.kills;
    this.el.winCoins.textContent = stats.coins;
    this.show('win');
  },
  showLose(stats) {
    this.el.loseKills.textContent = stats.kills;
    this.el.loseCoins.textContent = stats.coins;
    this.show('lose');
  },
};
