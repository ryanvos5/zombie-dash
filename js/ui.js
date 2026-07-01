/* ============================================================
   UI — schermbeheer, shop, level-select, HUD.
   ============================================================ */

const UI = {
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    // splash bij opstarten netjes laten wegfaden + daarna verwijderen (gegarandeerd weg)
    setTimeout(() => { const s = $('splash'); if (s) s.classList.add('fading'); }, 2000);
    setTimeout(() => { const s = $('splash'); if (s) s.classList.add('gone'); }, 2600);
    this.el = {
      hud: $('hud'), touch: $('touch-controls'), pause: $('pause-btn'),
      menu: $('menu-screen'), level: $('level-screen'), shop: $('shop-screen'),
      journey: $('journey-screen'),
      win: $('win-screen'), lose: $('lose-screen'),
      progressFill: $('progress-fill'), progressPlayer: $('progress-player'),
      levelName: $('level-name'), healthFill: $('health-fill'),
      coinCount: $('coin-count'), weaponName: $('weapon-name'),
      ammoCount: $('ammo-count'), ammoNum: $('ammo-num'),
      banner: $('game-banner'), bannerMain: $('banner-main'), bannerSub: $('banner-sub'),
      bossHpWrap: $('boss-hp-wrap'), bossHpFill: $('boss-hp-fill'), tutorialBox: $('tutorial-box'),
      menuCoins: $('menu-coin-count'), shopCoins: $('shop-coin-count'),
      levelGrid: $('level-grid'), shopGrid: $('shop-grid'),
      arena: $('arena-screen'), versus: $('versus-screen'),
      inventory: $('inventory-screen'),
      leaderboard: $('leaderboard-screen'), chat: $('chat-screen'),
      arenaRound: $('arena-round'), arenaCoins: $('arena-coins'), arenaBest: $('arena-best'),
      arenaLeft: $('arena-left'), arenaRecord: $('arena-record'),
      winKills: $('win-kills'), winCoins: $('win-coins'), winReplayNote: $('win-replay-note'),
      loseKills: $('lose-kills'), loseCoins: $('lose-coins'), loseTitle: $('lose-title'),
    };

    if (window.MenuBg) { MenuBg.init(); MenuBg.start(); }   // dynamische vulkaan-achtergrond
    this.renderChests();                                    // kist-balk op het menu

    // menu knoppen (singleplayer-werelden zijn uit — focus op multiplayer)
    $('btn-shop').onclick = () => this.openShop();
    $('btn-win-shop').onclick = () => this.openShop();
    document.querySelectorAll('.shop-tab').forEach((b) => { b.onclick = () => { this._shopTab = b.dataset.tab; this.renderShop(); }; });
    $('btn-journey').onclick = () => this.openJourney();
    $('btn-inventory').onclick = () => this.openInventory();
    $('btn-inventory-back').onclick = () => this.show('menu');
    document.querySelectorAll('#inv-tabs .shop-tab').forEach((b) => { b.onclick = () => { this._invTab = b.dataset.invtab; this.renderInventory(); }; });
    document.querySelectorAll('.chest-slot').forEach((b) => { b.onclick = () => this.chestClick(+b.dataset.chest); });
    document.querySelectorAll('.loadout-slot').forEach((b) => {
      b.onclick = () => { const id = b.dataset.pu; if (id) { Game.usePowerupSlot(id); } };
    });
    $('btn-journey-skip').onclick = () => Game.skipStory();
    $('btn-journey-next').onclick = () => Game.storyNext();
    const aa = $('btn-arena-again'); if (aa) aa.onclick = () => this.show('menu');   // oude arena-knop (mode is weg)
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
    // TERUG in het versus-scherm: eerst matchmaking + verbinding netjes stoppen
    $('btn-vs-back').onclick = () => { this._stopMatchmaking(); this.leaveLobby(); if (window.Net) Net.leaveVersus(); this.show('menu'); };

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

    // ---- instellingen (overlay met account / update / nieuw spel) ----
    $('btn-settings').onclick = () => document.getElementById('settings-screen').classList.remove('hidden');
    $('btn-settings-close').onclick = () => document.getElementById('settings-screen').classList.add('hidden');
    // geluid aan/uit
    const sb = $('btn-sound');
    if (sb) {
      const upd = () => { sb.textContent = 'Geluid: ' + (window.Sfx && Sfx.enabled ? 'Aan' : 'Uit'); };
      upd();
      sb.onclick = () => { if (window.Sfx) Sfx.setEnabled(!Sfx.enabled); upd(); };
    }
    // klikgeluid op menu-knoppen
    document.addEventListener('pointerdown', (e) => {
      if (window.Sfx && e.target && e.target.closest && e.target.closest('.stone-btn,.stone-tile,.stone-icon,.big-btn,.shop-tab,.world-tab,.back-btn')) Sfx.play('click');
    });

    // ---- account (inloggen / registreren) ----
    this.authMode = 'login';
    $('btn-account').onclick = () => this.openAuth('login');
    $('btn-logout').onclick = () => { if (window.Net) Net.logout(); };
    $('btn-nick').onclick = () => this.promptNickname();
    $('btn-auth-close').onclick = () => $('auth-screen').classList.add('hidden');
    $('btn-auth-toggle').onclick = () => this.openAuth(this.authMode === 'login' ? 'register' : 'login');
    $('btn-auth-submit').onclick = () => this.submitAuth();
    this.refreshAuthUI();

    // ---- lobby chat ----
    $('btn-chat').onclick = () => this.openChat();
    $('btn-chat-back').onclick = () => { this.closeChat(); this.show('menu'); };
    $('chat-send').onclick = () => this.sendChat();
    $('chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendChat(); });
    $('btn-invite-accept').onclick = () => this.acceptChatInvite();
    $('btn-invite-ignore').onclick = () => { document.getElementById('invite-screen').classList.add('hidden'); this._chatInvite = null; };

    // ---- leaderboard ----
    $('btn-leaderboard').onclick = () => this.openLeaderboard();
    document.querySelectorAll('#lb-tabs [data-lb]').forEach((t) => {
      t.onclick = () => {
        document.querySelectorAll('#lb-tabs [data-lb]').forEach((b) => b.classList.toggle('active', b === t));
        this.renderLeaderboard(t.dataset.lb);
      };
    });

    // ---- 1 vs 1 online ----
    $('btn-versus').onclick = () => this.startMatchmaking();
    $('btn-mm-cancel').onclick = () => this.cancelMatchmaking();
    $('btn-mm-friends').onclick = () => { this._stopMatchmaking(); if (window.Net) Net.leaveVersus(); this.openVersusLobby(); };
    $('btn-vs-host').onclick = () => this.versusHost();
    $('btn-vs-join').onclick = () => this.versusJoin();
    $('btn-vs-bot').onclick = () => this.openBotSetup();
    const diffSlider = document.getElementById('vs-diff-slider');
    if (diffSlider) diffSlider.oninput = () => this.setBotDiff(parseInt(diffSlider.value, 10));
    $('btn-vs-quit').onclick = () => {
      // online tijdens een live match: bevestigen + verlaten = jij verliest, tegenstander wint
      if (Game.state === 'versus' && !Game.vsBot && window.Net && Net.versus) {
        if (confirm('Weet je zeker dat je de match wilt verlaten?')) Game.forfeitVersus();
      } else {
        Game.quitVersus();
      }
    };
    $('btn-vs-again').onclick = () => { document.getElementById('versus-result').classList.add('hidden'); this.openVersusLobby(); };
    $('btn-vs-menu').onclick = () => { document.getElementById('versus-result').classList.add('hidden'); this.leaveLobby(); this.show('menu'); };
    $('btn-vs-rematch').onclick = () => this.doRematch();
    $('btn-vs-back').onclick = () => { this.leaveLobby(); this.show('menu'); };
    $('btn-vs-ready').onclick = () => this.toggleReady();
    document.querySelectorAll('.vs-mode-btn').forEach((b) => {
      b.onclick = () => this.setVoteMode(b.dataset.mode);
    });

    // spel updaten (verse versie laden zonder het icoon te verwijderen)
    $('btn-update').onclick = () => this.forceUpdate();


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
  // Zombie Knock-out starten — dag-limiet via ACCOUNT (cache wissen helpt niet)
  async startArena() {
    // ingelogd: server bepaalt of je nog mag (atomair verbruiken)
    if (window.Net && Net.ready && Net.isLoggedIn()) {
      let left;
      try { left = await Net.arenaUsePlay(); }
      catch (e) { alert('Kon de daglimiet niet controleren: ' + (e.message || e)); return; }
      if (left === -1) {
        alert('Je hebt vandaag al ' + ARENA_PLAYS_PER_DAY + ' keer Zombie Knock-out gespeeld.\nDe limiet reset elke ochtend om 06:00.');
        return;
      }
      this._arenaLeft = left;
      Game.startArena();
      return;
    }
    // niet ingelogd: verplicht inloggen zodat de daglimiet eerlijk telt (niet te omzeilen)
    if (window.Net && Net.ready) {
      alert('Log in met een account om Zombie Knock-out te spelen.\nZo geldt de daglimiet (3× per dag, reset 06:00) eerlijk voor iedereen.');
      this.openAuth('login');
      return;
    }
    // server onbereikbaar: lokale fallback zodat het offline speelbaar blijft
    const left = Storage.arenaPlaysLeft();
    if (left <= 0) { alert('Je hebt vandaag al ' + ARENA_PLAYS_PER_DAY + ' keer gespeeld. Kom morgen terug!'); return; }
    Storage.useArenaPlay();
    this._arenaLeft = left - 1;
    Game.startArena();
  },

  // Journey-tegel bijwerken (voortgang)
  updateArenaButton() {
    const c = document.getElementById('journey-prog');
    if (!c) return;
    const total = (JOURNEY[1].levels || []).length;
    const done = Math.min(total, Storage.data.journey1 || 0);
    c.textContent = done >= total ? 'Wereld 1 ✓' : ('Lvl ' + (done + 1) + '/' + total);
  },

  // ---------- JOURNEY (singleplayer) ----------
  openJourney() { this.renderJourney(); this.show('journey'); },
  renderJourney() {
    const grid = document.getElementById('journey-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const levels = JOURNEY[1].levels;
    levels.forEach((lv, i) => {
      const n = i + 1;
      const cleared = Storage.journeyCleared(n);
      const open = Storage.journeyUnlocked(n);
      const cell = document.createElement('button');
      cell.className = 'level-cell' + (cleared ? ' cleared' : '') + (open ? '' : ' locked');
      cell.innerHTML = '<span class="lvl-badge">' + (lv.boss ? 'BAAS' : ('Lvl ' + n)) + '</span><span class="num">' + (lv.boss ? '👑' : n) + '</span><span class="stars">' + (cleared ? '★' : (open ? '' : '🔒')) + '</span>';
      if (open) cell.onclick = () => this.pickJourneyLevel(n);
      grid.appendChild(cell);
    });
  },
  pickJourneyLevel(n) {
    const script = this._journeyStoryFor(n);
    if (script) { this.playStory(script, n); return; }
    this.startJourneyLevel(n);
  },
  // welk verhaaltje hoort bij dit level? (intro vóór lvl 1, confrontatie bij elke nieuwe aap)
  // speelt nu elke keer dat je het level start — ook bij herhalen (te skippen met "Overslaan")
  _journeyStoryFor(n) {
    if (n === 1) return 'intro';
    if (n === 5) return 'baviaan';   // Baviaan
    if (n === 10) return 'koba';     // Koba
    if (n === 15) return 'kong';     // Gorilla King (eindbaas)
    return null;
  },
  // verhaal-cutscene op het canvas afspelen, daarna het level starten
  playStory(script, n) {
    ['menu', 'level', 'shop', 'journey', 'arena', 'win', 'lose', 'versus', 'leaderboard', 'chat', 'inventory'].forEach((s) => this.el[s].classList.add('hidden'));
    document.body.classList.add('in-game');
    this.el.hud.classList.add('hidden'); this.el.touch.classList.add('hidden'); this.el.pause.classList.add('hidden');
    Game.playJourneyIntro(script, () => this.startJourneyLevel(n));
  },
  startJourneyLevel(n) {
    document.getElementById('versus-result').classList.add('hidden');
    this.showVersus();                  // juiste HUD/touch-setup, alle schermen weg
    Game.startJourney(n);
    this.el.pause.classList.remove('hidden');                       // Journey heeft een pauzeknop (singleplayer)
    document.getElementById('btn-vs-quit').classList.add('hidden'); // ✕ weg: pauzeknop vervangt 'm (geen overlap)
  },
  showJourneyResult(won, idx, unlocks, rewards, myScore, oppScore) {
    const levels = JOURNEY[1].levels, total = levels.length, hasNext = won && idx < total;
    const vw = document.getElementById('vs-win'); if (vw) vw.classList.add('hidden');   // win-celebratie weg
    const rb = document.getElementById('vs-round-banner'); if (rb) rb.classList.add('hidden');
    this.el.touch.classList.add('hidden'); document.body.classList.remove('in-game');
    this.el.pause.classList.add('hidden');
    document.getElementById('loadout-bar').classList.add('hidden');
    document.getElementById('versus-hud').classList.add('hidden');
    const t = document.getElementById('vs-result-title');
    t.textContent = won ? (idx >= total ? 'EILAND VERSLAGEN! 🏆' : 'LEVEL GEHAALD!') : 'VERLOREN';
    t.className = 'screen-title ' + (won ? 'win' : 'lose');
    document.getElementById('vs-result-score').textContent = (myScore || 0) + ' – ' + (oppScore || 0);
    const xpEl = document.getElementById('vs-result-xp');
    xpEl.classList.remove('hidden');
    const lvlName = (levels[idx - 1] ? levels[idx - 1].name : ('Level ' + idx));
    xpEl.innerHTML = lvlName + '<br>' + (won ? 'Level ' + idx + ' gehaald!' : 'Probeer het opnieuw.');
    const voteBox = document.getElementById('vs-result-vote'); if (voteBox) voteBox.classList.add('hidden');
    const rs = document.getElementById('vs-rematch-status'); if (rs) rs.textContent = '';
    const rbtn = document.getElementById('btn-vs-rematch');
    rbtn.classList.remove('hidden'); rbtn.disabled = false;
    rbtn.textContent = won ? (hasNext ? '▶ VOLGENDE LEVEL' : '✓ KLAAR') : '↻ OPNIEUW';
    rbtn.onclick = () => {
      document.getElementById('versus-result').classList.add('hidden');
      if (won && hasNext) this.pickJourneyLevel(idx + 1);   // via story-check: verhaal speelt ook hier
      else if (!won) this.pickJourneyLevel(idx);
      else { Game.journey = null; this.openJourney(); }
    };
    const again = document.getElementById('btn-vs-again');
    again.textContent = '🗺 WERELDKAART';
    again.onclick = () => { document.getElementById('versus-result').classList.add('hidden'); Game.journey = null; if (window.Net) Net.leaveVersus(); this.openJourney(); };
    document.getElementById('btn-vs-menu').onclick = () => { document.getElementById('versus-result').classList.add('hidden'); Game.journey = null; this.show('menu'); };
    document.getElementById('versus-result').classList.remove('hidden');
    document.getElementById('versus-screen').classList.add('hidden');
    if (rewards && rewards.length) this.showRewards(rewards);   // beloning-popups bovenop de uitslag
  },

  // ===== Beloning-popups met wachtrij: munten/xp + unlock-kaartjes (OK = volgende) =====
  showRewards(list, onDone) {
    this._rewardQueue = (list || []).filter(Boolean);
    this._rewardDone = onDone || null;
    this._rewardTotal = this._rewardQueue.length;
    this._rewardShown = 0;
    if (!this._rewardQueue.length) { if (onDone) onDone(); return; }
    const ok = document.getElementById('btn-reward-ok');
    if (ok) ok.onclick = () => { if (window.Sfx) Sfx.play('click'); this._nextReward(); };
    this._nextReward();
  },
  _nextReward() {
    const pop = document.getElementById('reward-pop'); if (!pop) return;
    const r = this._rewardQueue.shift();
    if (!r) { pop.classList.add('hidden'); const cb = this._rewardDone; this._rewardDone = null; if (cb) cb(); return; }
    this._rewardShown++;
    this._drawReward(r);
    const cnt = document.getElementById('reward-count');
    if (cnt) cnt.textContent = this._rewardTotal > 1 ? (this._rewardShown + ' / ' + this._rewardTotal) : '';
    pop.classList.remove('hidden');
    const card = pop.querySelector('.reward-card');         // pop-animatie opnieuw afspelen
    if (card) { card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
    if (window.Sfx) Sfx.play(r.type === 'earn' ? 'coin' : 'win');
  },
  _drawReward(r) {
    const title = document.getElementById('reward-title');
    const nameEl = document.getElementById('reward-name');
    const cv = document.getElementById('reward-canvas'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
    if (r.type === 'char') {
      title.textContent = '🎉 VRIJGESPEELD!';
      const c = CHARACTERS[r.id] || CHARACTERS.ryan;
      ctx.save(); ctx.translate(cv.width / 2, 8); ctx.scale(2.5, 2.5);
      Sprites.drawCharacter(ctx, 0, 42, 1, c.palette, { weapon: c.startMelee || c.forcedMelee || 'bat', build: c.build, hair: c.hair, hat: 'none' });
      ctx.restore();
      nameEl.textContent = 'Nieuw character: ' + (r.name || c.name);
    } else if (r.type === 'hat') {
      title.textContent = '🎉 VRIJGESPEELD!';
      const cc = CHARACTERS[Storage.data.equippedCharacter] || CHARACTERS.ryan;
      ctx.save(); ctx.translate(cv.width / 2, 8); ctx.scale(2.5, 2.5);
      Sprites.drawCharacter(ctx, 0, 42, 1, cc.palette, { weapon: cc.forcedMelee || 'bat', build: cc.build, hair: cc.hair, hat: r.id });
      ctx.restore();
      nameEl.textContent = 'Nieuwe hoed: ' + (r.name || (HATS[r.id] && HATS[r.id].name) || '');
    } else if (r.type === 'pu') {   // power-up uit een kist
      title.textContent = '🎁 POWER-UP';
      const pu = SHOP_POWERUPS[r.id] || {};
      ctx.save(); ctx.translate(cv.width / 2, cv.height / 2 - 6); ctx.scale(2.6, 2.6);
      if (Game && Game.drawDrop) Game.drawDrop(ctx, { kind: pu.kind, x: 0, y: 0, id: 0 });
      ctx.restore();
      nameEl.textContent = (pu.name || r.id) + (r.n > 1 ? '  x' + r.n : '');
    } else if (r.type === 'chest') {   // nieuwe kist uit een match
      title.textContent = '📦 NIEUWE KIST!';
      ctx.save(); ctx.translate(cv.width / 2, cv.height / 2 - 6); ctx.scale(2.8, 2.8);
      this._chestArt(ctx, r.rarity); ctx.restore();
      nameEl.textContent = (CHEST_TYPES[r.rarity] || {}).name + '-kist — open in het menu!';
    } else { // 'earn' — munten + xp
      title.textContent = '🏆 BELONING';
      this._drawCoinXp(ctx, cv, r.coins || 0, r.xp || 0);
      const parts = [];
      if (r.xp) parts.push('+' + r.xp + ' XP');
      if (r.coins) parts.push('+' + r.coins + ' munten');
      nameEl.textContent = parts.join('   ·   ');
    }
  },
  _drawCoinXp(ctx, cv, coins, xp) {
    const cx = cv.width / 2, cy = 54;
    const both = coins && xp;
    const coinX = both ? cx - 38 : cx, xpX = both ? cx + 38 : cx;
    if (coins) {                                            // gouden munt met ●
      ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(coinX, cy, 26, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(coinX, cy, 22, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffe98a'; ctx.beginPath(); ctx.arc(coinX - 6, cy - 6, 6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#a9760a'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('●', coinX, cy + 1);
    }
    if (xp) {                                               // blauwe ster
      ctx.fillStyle = '#1e7fc0'; this._star(ctx, xpX, cy, 26, 5);
      ctx.fillStyle = '#46c0ff'; this._star(ctx, xpX, cy, 21, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('XP', xpX, cy + 1);
    }
  },
  _star(ctx, cx, cy, r, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const rad = (i % 2 === 0) ? r : r * 0.46, a = (Math.PI / pts) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  },

  showArenaOver(stats) {
    this.el.arenaRound.textContent = stats.round;
    this.el.arenaCoins.textContent = stats.coins;
    this.el.arenaBest.textContent = stats.best;
    const left = (typeof this._arenaLeft === 'number') ? this._arenaLeft : Storage.arenaPlaysLeft();
    this.el.arenaLeft.textContent = left;
    this.el.arenaRecord.classList.toggle('hidden', !stats.record);
    // knop uitschakelen als er geen pogingen meer zijn
    const again = document.getElementById('btn-arena-again');
    if (left <= 0) { again.classList.add('cant'); again.disabled = true; }
    else { again.classList.remove('cant'); again.disabled = false; }
    this.show('arena');
  },

  // ---- SPEL UPDATEN (verse versie laden) ----
  async forceUpdate() {
    const btn = document.getElementById('btn-update');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Updaten…'; }
    // eventuele caches legen (helpt bij hardnekkige browsers / PWA)
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {}
    // verse herladen met een unieke querystring -> browser haalt alles opnieuw op
    const base = location.origin + location.pathname;
    let stamp = '' + (window.Date && Date.now ? Date.now() : Math.floor(performance.now()));
    location.replace(base + '?u=' + stamp);
  },

  // ---- ACCOUNT-UI ----
  syncCoins() {
    if (this.el.menuCoins) this.el.menuCoins.textContent = Storage.data.coins;
    if (this.el.shopCoins) this.el.shopCoins.textContent = Storage.data.coins;
  },

  refreshAuthUI() {
    const status = document.getElementById('account-status');
    const btnAcc = document.getElementById('btn-account');
    const btnOut = document.getElementById('btn-logout');
    const inLogged = window.Net && Net.isLoggedIn && Net.isLoggedIn();
    // header-regel "Nickname | Lvl"
    const line = document.getElementById('menu-userline');
    if (line) line.textContent = (inLogged ? Net.nickname() : 'Gast') + ' | Lvl ' + playerLevel(Storage.data.xp || 0);
    if (!status || !btnAcc || !btnOut) return;
    const xpWrap = document.getElementById('xp-bar-wrap');
    const btnNick = document.getElementById('btn-nick');
    if (inLogged) {
      status.textContent = '👤 ' + Net.nickname() + ' · Lvl ' + playerLevel(Storage.data.xp || 0);
      status.classList.remove('hidden');
      btnOut.classList.remove('hidden');
      btnAcc.classList.add('hidden');
      if (btnNick) btnNick.classList.remove('hidden');
      if (xpWrap) { xpWrap.classList.remove('hidden'); this.renderXpBar(); }
    } else {
      status.classList.add('hidden');
      btnOut.classList.add('hidden');
      btnAcc.classList.remove('hidden');
      if (btnNick) btnNick.classList.add('hidden');
      if (xpWrap) xpWrap.classList.add('hidden');
    }
    this.updateArenaButton();
  },

  // heeft de ingelogde speler een echte nickname? (anders valt nickname() terug op de e-mail)
  _hasNickname() {
    return !!(window.Net && Net.user && Net.user.user_metadata && Net.user.user_metadata.nickname);
  },

  async promptNickname() {
    const cur = this._hasNickname() ? Net.nickname() : '';
    const nick = window.prompt('Kies je speler-naam (zo sta je op de leaderboard):', cur);
    if (nick == null) return;                       // geannuleerd
    if (!nick.trim()) { alert('Naam mag niet leeg zijn.'); return; }
    try { await Net.setNickname(nick); this.syncCoins(); }
    catch (e) { alert('Kon de naam niet opslaan: ' + (e.message || e)); }
  },

  // na (her)inloggen: vraag een naam als die nog ontbreekt
  afterNetLogin() {
    this.refreshAuthUI();
    if (window.Net && Net.isLoggedIn() && !this._hasNickname()) {
      setTimeout(() => this.promptNickname(), 400);
    }
  },

  // XP-balk: voortgang binnen het huidige level
  renderXpBar() {
    const fill = document.getElementById('xp-bar-fill');
    const label = document.getElementById('xp-bar-label');
    if (!fill || !label) return;
    const xp = Storage.data.xp || 0;
    const L = playerLevel(xp);
    const start = xpForLevel(L), next = xpForLevel(L + 1);
    const into = xp - start, need = next - start;
    const pct = Math.max(0, Math.min(100, Math.round((into / need) * 100)));
    fill.style.width = pct + '%';
    label.textContent = 'Lvl ' + L + ' · ' + into + '/' + need + ' XP';
  },

  openAuth(mode) {
    this.authMode = mode;
    const isReg = mode === 'register';
    document.getElementById('auth-title').textContent = isReg ? 'REGISTREREN' : 'INLOGGEN';
    document.getElementById('btn-auth-submit').textContent = isReg ? 'ACCOUNT AANMAKEN' : 'INLOGGEN';
    document.getElementById('btn-auth-toggle').textContent = isReg ? 'Al een account? Inloggen' : 'Nog geen account? Registreren';
    document.getElementById('auth-nick').classList.toggle('hidden', !isReg);
    document.getElementById('auth-pass').setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
    document.getElementById('auth-msg').textContent = '';
    document.getElementById('auth-screen').classList.remove('hidden');
  },

  async submitAuth() {
    const msg = document.getElementById('auth-msg');
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const nick = document.getElementById('auth-nick').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    if (!email || !pass) { msg.textContent = 'Vul e-mail en wachtwoord in.'; return; }
    if (this.authMode === 'register' && !nick) { msg.textContent = 'Kies een nickname.'; return; }
    if (pass.length < 6) { msg.textContent = 'Wachtwoord moet minstens 6 tekens zijn.'; return; }
    msg.style.color = ''; msg.textContent = 'Bezig…'; submitBtn.disabled = true;
    try {
      if (this.authMode === 'register') {
        const res = await Net.register(email, nick, pass);
        if (res.confirmed) {
          msg.style.color = '#7ad06a'; msg.textContent = '✅ Account aangemaakt!';
          setTimeout(() => { document.getElementById('auth-screen').classList.add('hidden'); this.syncCoins(); }, 800);
        } else {
          msg.style.color = '#7ad06a';
          msg.textContent = '✅ Bevestig je e-mail via de link die we stuurden, en log daarna in.';
        }
      } else {
        await Net.login(email, pass);
        msg.style.color = '#7ad06a'; msg.textContent = '✅ Ingelogd!';
        setTimeout(() => { document.getElementById('auth-screen').classList.add('hidden'); this.syncCoins(); }, 700);
      }
    } catch (e) {
      msg.style.color = '#ff6a6a';
      msg.textContent = '⚠ ' + (e && e.message ? e.message : 'Er ging iets mis.');
    } finally {
      submitBtn.disabled = false;
    }
  },

  // ---- LOBBY CHAT + PRESENCE ----
  // presence draait al op de menuschermen, zodat je op het hoofdmenu live ziet
  // hoeveel mensen er online zijn (groen puntje op de chat-knop).
  ensurePresence(tries) {
    tries = tries || 0;
    if (!window.Net) return;
    // wacht tot de server klaar is én de sessie/nickname geladen is (anders zou je als "Gast" verschijnen)
    if ((!Net.ready || !Net.authReady) && tries < 20) { setTimeout(() => this.ensurePresence(tries + 1), 400); return; }
    if (!Net.ready) return;
    if (Net.lobby || this._presenceJoining) { this.refreshChatBadge(); return; }
    this._presenceJoining = true;
    Net.lobbyJoin({
      onChat: (m) => { if (this._chatOpen) this.onChatMsg(m); },
      onPeers: (list) => { this._peers = list; this.refreshChatBadge(); if (this._chatOpen) this.renderOnline(list); },
      onInvite: (p) => this.onChatInvite(p),
    }).then(() => { this._presenceJoining = false; this.refreshChatBadge(); })
      .catch(() => { this._presenceJoining = false; });
  },

  leavePresence() { if (window.Net) Net.lobbyLeave(); this._peers = []; this.refreshChatBadge(); },

  // groen puntje + aantal anderen online op de chat-knop
  refreshChatBadge() {
    const btn = document.getElementById('btn-chat');
    if (!btn) return;
    let dot = document.getElementById('chat-badge');
    if (!dot) { dot = document.createElement('span'); dot.id = 'chat-badge'; dot.className = 'chat-badge'; btn.appendChild(dot); }
    const others = (this._peers || []).filter((p) => !p.me && !p.guest).length;   // gasten niet meetellen
    if (others > 0) { dot.textContent = others; dot.classList.add('on'); }
    else { dot.textContent = ''; dot.classList.remove('on'); }
  },

  openChat() {
    this._chatOpen = true;
    this.show('chat');
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-online-list').innerHTML = '';
    if (window.Net && Net.lobby) {
      document.getElementById('chat-msg').textContent = '';
      this.renderOnline(this._peers || []);
      this.addChatLine(null, 'Welkom in de lobby! Wees aardig 🙂', true);
    } else {
      document.getElementById('chat-msg').textContent = 'Verbinden…';
      this.ensurePresence();
      // even wachten en dan tonen zodra verbonden
      let n = 0;
      const wait = () => {
        if (window.Net && Net.lobby) {
          document.getElementById('chat-msg').textContent = '';
          this.renderOnline(this._peers || []);
          this.addChatLine(null, 'Welkom in de lobby! Wees aardig 🙂', true);
        } else if (n++ < 20 && this._chatOpen) { setTimeout(wait, 300); }
        else if (this._chatOpen) { document.getElementById('chat-msg').textContent = '⚠ Geen verbinding met de server.'; }
      };
      setTimeout(wait, 300);
    }
  },

  closeChat() { this._chatOpen = false; },   // presence blijft aan voor de teller

  sendChat() {
    const inp = document.getElementById('chat-input');
    const text = (inp.value || '').trim();
    if (!text) return;
    if (!window.Net || !Net.lobby) return;
    const now = (window.Date && Date.now) ? Date.now() : 0;
    if (now && this._lastChat && now - this._lastChat < 500) return;   // anti-spam
    this._lastChat = now;
    Net.lobbyChat(text);
    this.addChatLine(Net.lobbyMyNick(), text, false, true);            // eigen bericht meteen tonen
    inp.value = '';
  },

  onChatMsg(m) { if (m && m.text) this.addChatLine(m.nick, m.text, false, false); },

  addChatLine(nick, text, system, me) {
    const box = document.getElementById('chat-messages');
    if (!box) return;
    const row = document.createElement('div');
    row.className = 'chat-line' + (system ? ' sys' : '') + (me ? ' me' : '');
    if (system) row.innerHTML = '<span class="chat-sys">' + this._esc(text) + '</span>';
    else row.innerHTML = '<span class="chat-nick">' + this._esc(nick) + ':</span> ' + this._esc(text);
    box.appendChild(row);
    while (box.children.length > 60) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  },

  renderOnline(list) {
    const el = document.getElementById('chat-online-list');
    if (!el) return;
    el.innerHTML = '';
    list.forEach((p) => {
      if (p.guest && !p.me) return;            // gasten (niet-ingelogd) niet tonen in de lijst
      const chip = document.createElement('span');
      chip.className = 'chat-chip' + (p.me ? ' me' : '');
      chip.textContent = p.nick + (p.me ? ' (jij)' : '');
      if (!p.me) {
        const inv = document.createElement('button');
        inv.className = 'chat-invite-btn'; inv.textContent = '⚔';
        inv.title = 'Uitnodigen voor 1v1';
        inv.onclick = () => this.inviteFromChat(p.id, p.nick);
        chip.appendChild(inv);
      }
      el.appendChild(chip);
    });
  },

  // iemand uitnodigen vanuit de chat: maak een kamer + stuur de invite, ga naar de wachtruimte
  async inviteFromChat(toId, toNick) {
    if (!window.Net || !Net.ready) return;
    try {
      this._vsRole = 'host';
      const code = await Net.versusHost(this._versusCbs());
      Net.lobbyInvite(toId, code);            // broadcast op de nog-open chat-channel
      this.show('versus');                     // naar de versus-wachtruimte
      this._enterRoom(code);
      document.getElementById('vs-peer-status').textContent = 'Uitnodiging naar ' + toNick + ' gestuurd… wachten tot die meedoet.';
    } catch (e) { alert('Kon geen kamer maken: ' + (e.message || e)); }
  },

  onChatInvite(p) {
    this._chatInvite = p;
    document.getElementById('invite-text').textContent = (p.from || 'Iemand') + ' nodigt je uit voor een 1v1!';
    document.getElementById('invite-screen').classList.remove('hidden');
  },

  acceptChatInvite() {
    const p = this._chatInvite; this._chatInvite = null;
    document.getElementById('invite-screen').classList.add('hidden');
    if (!p) return;
    this.closeChat();                       // chat verlaten, naar de versus-lobby
    this._vsRole = 'guest';
    this.openVersusLobby();
    const inp = document.getElementById('vs-code-input'); if (inp) inp.value = p.code;
    this.versusJoin();
  },

  // ---- LEADERBOARD ----
  openLeaderboard() {
    document.querySelectorAll('#lb-tabs [data-lb]').forEach((b, i) => b.classList.toggle('active', i === 0));
    this.show('leaderboard');
    this.renderLeaderboard('xp');
  },

  async renderLeaderboard(sortBy) {
    const list = document.getElementById('lb-list');
    const msg = document.getElementById('lb-msg');
    list.innerHTML = ''; msg.textContent = 'Laden…';
    if (!window.Net || !Net.ready) { msg.textContent = 'Geen verbinding met de server.'; return; }
    let rows;
    try { rows = await Net.getLeaderboard(sortBy, 50); }
    catch (e) { msg.textContent = '⚠ ' + (e.message || e); return; }
    if (!rows.length) { msg.textContent = 'Nog geen spelers met een account. Log in en speel!'; return; }
    msg.textContent = '';
    const myNick = (window.Net && Net.isLoggedIn()) ? Net.nickname() : null;
    const statText = (r) => {
      if (sortBy === 'arena') return (r.arena_best || 0) + ' ronde';
      if (sortBy === 'wins') return (r.mp_wins || 0) + 'W ' + (r.mp_losses || 0) + 'L';
      return (r.xp || 0) + ' XP';
    };
    const makeRow = (r, rankText, me) => {
      const row = document.createElement('div');
      row.className = 'lb-row' + (me ? ' me' : '');
      row.innerHTML =
        '<span class="lb-rank">' + rankText + '</span>' +
        '<span class="lb-name">' + this._esc(r.nickname) + '</span>' +
        '<span class="lb-lvl">Lvl ' + playerLevel(r.xp || 0) + '</span>' +
        '<span class="lb-stat">' + statText(r) + '</span>';
      return row;
    };
    let meShown = false;
    rows.forEach((r, i) => {
      const me = myNick && r.nickname === myNick;
      if (me) meShown = true;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      list.appendChild(makeRow(r, medal, me));
    });
    // sta je niet in de getoonde top? toon je eigen rij apart onderaan
    if (myNick && !meShown && window.Net) {
      try {
        const mine = await Net.getMyRank(sortBy);
        if (mine) {
          const sep = document.createElement('div');
          sep.className = 'lb-sep'; sep.textContent = '• • •';
          list.appendChild(sep);
          list.appendChild(makeRow(mine, mine.rank + '.', true));
        }
      } catch (e) { /* stil */ }
    }
  },

  _esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; },

  // ---- 1 VS 1 LOBBY / SPEL ----
  // ---- MATCHMAKING: 8s zoeken naar een online tegenstander, anders een sterke bot ----
  startMatchmaking() {
    this.leaveLobby();
    this._botSetup = false; this._vsStarted = false; this._peer = null; this._myReady = false;
    this._vsRole = 'host';
    document.getElementById('versus-lobby').classList.add('hidden');
    document.getElementById('versus-wait').classList.add('hidden');
    document.getElementById('versus-result').classList.add('hidden');
    document.getElementById('versus-mm').classList.remove('hidden');
    this.show('versus');
    this._mmSearching = true;
    let left = 8; const cnt = document.getElementById('mm-count'); if (cnt) cnt.textContent = left;
    if (this._mmIv) clearInterval(this._mmIv);
    this._mmIv = setInterval(() => {
      left--; if (cnt) cnt.textContent = Math.max(0, left);
      if (left <= 0) { clearInterval(this._mmIv); this._mmIv = 0; this.matchmakingToBot(); }
    }, 1000);
    if (window.Net && Net.ready && Net.findMatch) Net.findMatch(this._versusCbs());   // online zoeken (onMatch -> lobby)
  },
  _stopMatchmaking() {
    this._mmSearching = false;
    if (this._mmIv) { clearInterval(this._mmIv); this._mmIv = 0; }
    if (window.Net && Net.cancelMatchmaking) Net.cancelMatchmaking();
  },
  cancelMatchmaking() { this._stopMatchmaking(); if (window.Net) Net.leaveVersus(); this.show('menu'); },
  // online tegenstander gevonden -> normale map-vote-lobby (zonder kamercode)
  _matchmakingConnected() {
    this._stopMatchmaking();
    document.getElementById('versus-mm').classList.add('hidden');
    this._vsStarted = false; this._myReady = false;
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'smash' };
    document.getElementById('versus-wait').classList.remove('hidden');
    document.querySelector('.vs-wait-label').classList.add('hidden');   // geen code bij matchmaking
    document.getElementById('vs-bot-diff').classList.add('hidden');
    const rb = document.getElementById('btn-vs-ready'); rb.textContent = 'READY'; rb.classList.remove('on');
  },
  // geen online tegenstander binnen 8s -> lobby met map-keuze tegen een sterke bot
  matchmakingToBot() {
    this._stopMatchmaking();
    if (window.Net) Net.leaveVersus();   // eventuele half-open verbinding opruimen
    document.getElementById('versus-mm').classList.add('hidden');
    this._botSetup = true;
    this._botDiff = 10;
    this._mmBotLevel = 10 + Math.floor(Math.random() * 11);   // Bot Lv 10..20
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'smash' };
    document.getElementById('versus-lobby').classList.add('hidden');
    document.getElementById('versus-result').classList.add('hidden');
    document.getElementById('versus-wait').classList.remove('hidden');
    document.querySelector('.vs-wait-label').classList.add('hidden');
    document.getElementById('vs-peer-status').textContent = '🤖 Geen online speler gevonden — Bot Lv ' + this._mmBotLevel;
    document.getElementById('vs-lobby-opts').classList.remove('hidden');
    this.renderMapVote();
    document.getElementById('vs-bot-diff').classList.add('hidden');
    const rb = document.getElementById('btn-vs-ready'); rb.textContent = '▶ START'; rb.classList.remove('on');
    document.getElementById('vs-ready-status').textContent = 'Kies je map — de bot speelt op jouw map.';
    this.show('versus');
  },

  openVersusLobby() {
    this.leaveLobby();
    document.getElementById('versus-lobby').classList.remove('hidden');
    document.getElementById('versus-wait').classList.add('hidden');
    document.getElementById('versus-result').classList.add('hidden');
    document.getElementById('versus-msg').textContent = '';
    document.getElementById('vs-code-input').value = '';
    this.show('versus');
  },

  _versusCbs() {
    return {
      onMatch: (role) => this._onVersusMatch(role),
      onLobby: (p) => this.onLobbyUpdate(p),
      onBegin: (p) => this.onLobbyBegin(p),
      onRematch: () => this.onRematch(),
      onState: (s) => Game.onVersusState(s),
      onHit: (p) => Game.onVersusHit(p),
      onFell: () => Game.onVersusFell(),
      onBurn: () => Game.onVersusBurn(),
      onShot: (p) => Game.onVersusShot(p),
      onOver: (p) => Game.onVersusOver(p),
      onPeerLeft: () => {
        if (Game.state === 'versus') { Game.endVersus(true, true); }   // tegenstander verliet = jij wint (forfeit)
        else if (Game.state === 'versusOver') {                   // op het uitslagscherm: rematch onmogelijk
          const rb = document.getElementById('btn-vs-rematch'); if (rb) { rb.disabled = true; rb.textContent = '🔁 REMATCH'; }
          const rs = document.getElementById('vs-rematch-status'); if (rs) rs.textContent = 'Tegenstander is weg — geen rematch mogelijk.';
          if (window.Net) Net.leaveVersus();
        } else { const ps = document.getElementById('vs-peer-status'); if (ps) ps.textContent = 'Tegenstander is weg…'; this._peer = null; document.getElementById('vs-lobby-opts').classList.add('hidden'); this.cancelCountdown(); }
      },
    };
  },

  async versusHost() {
    const msg = document.getElementById('versus-msg');
    if (!window.Net || !Net.ready) { msg.textContent = 'Geen verbinding met de server.'; return; }
    msg.style.color = ''; msg.textContent = 'Kamer aanmaken…';
    try {
      this._vsRole = 'host';
      const code = await Net.versusHost(this._versusCbs());
      this._enterRoom(code);
    } catch (e) { msg.style.color = '#ff6a6a'; msg.textContent = '⚠ ' + (e.message || e); }
  },

  async versusJoin() {
    const msg = document.getElementById('versus-msg');
    const code = document.getElementById('vs-code-input').value;
    if (!code) { msg.textContent = 'Vul de kamercode in.'; return; }
    if (!window.Net || !Net.ready) { msg.textContent = 'Geen verbinding met de server.'; return; }
    msg.style.color = ''; msg.textContent = 'Verbinden…';
    try {
      this._vsRole = 'guest';
      const c = await Net.versusJoin(code, this._versusCbs());
      this._enterRoom(c);
    } catch (e) { msg.style.color = '#ff6a6a'; msg.textContent = '⚠ ' + (e.message || e); }
  },

  // bot-setup: kies map + wapenmodus, dan START
  openBotSetup() {
    this.leaveLobby();
    this._botSetup = true;
    this._mmBotLevel = 0;                 // oefen-bot: geen echte inzet (geen XP/munten/kisten)
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'smash' };
    document.getElementById('versus-lobby').classList.add('hidden');
    document.getElementById('versus-result').classList.add('hidden');
    document.getElementById('versus-wait').classList.remove('hidden');
    document.querySelector('.vs-wait-label').classList.add('hidden');     // geen kamercode bij bot
    document.getElementById('vs-peer-status').textContent = 'Kies een map en speel tegen de bot:';
    document.getElementById('vs-lobby-opts').classList.remove('hidden');
    this.renderMapVote();
    document.querySelectorAll('.vs-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === 'melee'));
    document.getElementById('btn-vs-ready').textContent = '▶ START';
    document.getElementById('btn-vs-ready').classList.remove('on');
    document.getElementById('vs-ready-status').textContent = '🤖 Oefenpotje — geen XP';
    document.getElementById('vs-bot-diff').classList.remove('hidden');     // moeilijkheidsschuif tonen
    this.setBotDiff(this._botDiff || 5);
    this.show('versus');
  },

  // moeilijkheid + speelstijl-label bijwerken
  setBotDiff(n) {
    n = Math.max(1, Math.min(10, n || 5));
    this._botDiff = n;
    const prof = (typeof BOT_PROFILES !== 'undefined' && BOT_PROFILES[n - 1]) || null;
    const val = document.getElementById('vs-diff-val'); if (val) val.textContent = n;
    const nm = document.getElementById('vs-diff-name'); if (nm) nm.textContent = prof ? prof.name : '';
    const sl = document.getElementById('vs-diff-slider'); if (sl && +sl.value !== n) sl.value = n;
  },

  // tegen de bot spelen (lokaal, gekozen map, geen XP)
  startBotMatch() {
    this._botSetup = false;
    this._vsStarted = true;
    document.querySelector('.vs-wait-label').classList.remove('hidden');
    const v = this._myVote || { map: (Game.vsMap && Game.vsMap.id) || VERSUS_MAPS[0].id };
    Game.startVersus('host', { mapId: v.map, mode: 'smash', bot: true, diff: this._botDiff || 5, mmLevel: this._mmBotLevel || 0 });
  },

  // in een kamer: toon code, wacht op tegenstander
  _enterRoom(code) {
    this._vsStarted = false; this._peer = null; this._myReady = false;
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'smash' };
    document.getElementById('versus-msg').textContent = '';
    document.getElementById('versus-lobby').classList.add('hidden');
    document.getElementById('versus-wait').classList.remove('hidden');
    document.querySelector('.vs-wait-label').classList.remove('hidden');
    document.getElementById('vs-room-code').textContent = code;
    document.getElementById('vs-peer-status').textContent = 'Wachten op tegenstander…';
    document.getElementById('vs-lobby-opts').classList.add('hidden');
  },

  // tegenstander aanwezig -> open de vote-lobby (NIET meteen starten)
  _onVersusMatch(role) {
    if (role === 'host' || role === 'guest') this._vsRole = role;   // echte rol van Net (belangrijk bij matchmaking)
    if (this._mmSearching) this._matchmakingConnected();   // via matchmaking: mm-scherm weg, lobby tonen
    if (window.Net && Net.lobby) Net.lobbyLeave();   // chat niet meer nodig tijdens het potje
    document.getElementById('vs-peer-status').textContent = '✅ Tegenstander aanwezig!';
    const bd = document.getElementById('vs-bot-diff'); if (bd) bd.classList.add('hidden');   // alleen bij bot
    document.getElementById('vs-lobby-opts').classList.remove('hidden');
    this.renderMapVote();
    this.refreshLobby();
    this.broadcastLobby();        // deel mijn (standaard) keuze
  },

  renderMapVote() {
    ['vs-map-list', 'vs-result-map-list'].forEach((listId) => {
      const list = document.getElementById(listId);
      if (!list) return;
      list.innerHTML = '';
      VERSUS_MAPS.forEach((m) => {
        const b = document.createElement('button');
        b.className = 'vs-map-btn' + (this._myVote.map === m.id ? ' picked' : '');
        b.dataset.map = m.id;
        b.innerHTML = '<span class="vs-map-name">' + m.name + '</span><span class="vs-map-votes" data-mv="' + m.id + '"></span>';
        b.onclick = () => this.setVoteMap(m.id);
        list.appendChild(b);
      });
    });
  },

  setVoteMap(id) {
    if (!this._botSetup && this._myReady) return;       // tijdens ready niet wisselen
    this._myVote.map = id;
    this.renderMapVote();
    if (!this._botSetup) { this.refreshLobby(); this.broadcastLobby(); }
  },
  setVoteMode(mode) {
    if (!this._botSetup && this._myReady) return;
    this._myVote.mode = mode;
    document.querySelectorAll('.vs-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    if (!this._botSetup) { this.refreshLobby(); this.broadcastLobby(); }
  },
  toggleReady() {
    if (this._botSetup) { this.startBotMatch(); return; }   // in bot-setup = START
    this._myReady = !this._myReady;
    this.broadcastLobby(); this.refreshLobby(); this.checkBothReady();
  },

  broadcastLobby() {
    if (window.Net && Net.versus) Net.versusSend('lobby', { map: this._myVote.map, mode: this._myVote.mode, ready: !!this._myReady });
  },
  onLobbyUpdate(p) {
    this._peer = { map: p.map, mode: p.mode, ready: !!p.ready };
    // op het uitslagscherm: alleen de stemmen bijwerken, NIET terug naar de lobby springen
    if (!document.getElementById('versus-result').classList.contains('hidden')) { this.refreshLobby(); return; }
    // tegenstander aanwezig -> zorg dat de opts zichtbaar zijn
    if (document.getElementById('vs-lobby-opts').classList.contains('hidden')) this._onVersusMatch();
    this.refreshLobby(); this.checkBothReady();
  },

  refreshLobby() {
    // map-stemmen tonen (in beide lijsten: lobby + uitslag)
    VERSUS_MAPS.forEach((m) => {
      let n = 0; if (this._myVote.map === m.id) n++; if (this._peer && this._peer.map === m.id) n++;
      document.querySelectorAll('[data-mv="' + m.id + '"]').forEach((el) => { el.textContent = n ? '●'.repeat(n) : ''; });
    });
    document.querySelectorAll('.vs-map-btn').forEach((b) => b.classList.toggle('picked', b.dataset.map === this._myVote.map));
    document.querySelectorAll('.vs-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === this._myVote.mode));
    const ready = document.getElementById('btn-vs-ready');
    if (ready) { ready.textContent = this._myReady ? '✔ READY (klik om te annuleren)' : 'READY'; ready.classList.toggle('on', this._myReady); }
    const st = document.getElementById('vs-ready-status');
    const peerReady = this._peer && this._peer.ready;
    if (st) st.textContent = 'Jij: ' + (this._myReady ? 'klaar' : 'kiezen…') + '   •   Tegenstander: ' + (this._peer ? (peerReady ? 'klaar' : 'kiezen…') : '—');
  },

  checkBothReady() {
    if (this._myReady && this._peer && this._peer.ready) this.startCountdown();
    else this.cancelCountdown();
  },

  startCountdown() {
    if (this._cdTimer) return;          // al bezig
    this._cdLeft = 5000;
    const tick = () => {
      this._cdLeft -= 200;
      const st = document.getElementById('vs-ready-status');
      if (st) st.textContent = 'Start over ' + Math.ceil(this._cdLeft / 1000) + 's…';
      if (this._cdLeft <= 0) {
        clearInterval(this._cdTimer); this._cdTimer = null;
        if (this._vsRole === 'host') this.resolveAndBegin();   // host beslist de map/modus
        else { if (st) st.textContent = 'Starten…'; }          // gast wacht op 'begin'
      }
    };
    this._cdTimer = setInterval(tick, 200);
  },
  cancelCountdown() {
    if (this._cdTimer) { clearInterval(this._cdTimer); this._cdTimer = null; }
  },

  // host kiest de definitieve map + modus en stuurt 'begin'
  resolveAndBegin() {
    const mine = this._myVote, peer = this._peer || mine;
    const map = (mine.map === peer.map) ? mine.map : (Math.random() < 0.5 ? mine.map : peer.map);
    const mode = 'smash';                                   // online is altijd Power Smash
    if (window.Net) Net.versusSend('begin', { map, mode });
    this._beginMatch(map, mode);
  },
  onLobbyBegin(p) { this._beginMatch(p.map, p.mode); },
  _beginMatch(map, mode) {
    if (this._vsStarted) return;
    this._vsStarted = true;
    this.cancelCountdown();
    document.getElementById('versus-result').classList.add('hidden');   // uitslag weg bij (re)start
    Game.startVersus(this._vsRole || 'host', { mapId: map, mode: mode });
  },

  leaveLobby() {
    this.cancelCountdown();
    this._vsStarted = false; this._peer = null; this._myReady = false; this._botSetup = false;
    const lbl = document.querySelector('.vs-wait-label'); if (lbl) lbl.classList.remove('hidden');
    const rb = document.getElementById('btn-vs-ready'); if (rb) { rb.textContent = 'READY'; rb.classList.remove('on'); }
    if (window.Net) Net.leaveVersus();   // alleen het versus-kanaal; presence blijft (teller op menu)
  },

  showVersus() {
    ['menu', 'level', 'shop', 'journey', 'arena', 'win', 'lose', 'versus', 'leaderboard', 'chat', 'inventory'].forEach((s) =>
      this.el[s].classList.add('hidden'));
    document.body.classList.add('in-game');
    this.el.hud.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.banner.classList.add('hidden');
    this.el.touch.classList.toggle('hidden', !Input.isTouch());
    document.getElementById('versus-hud').classList.remove('hidden');
    document.getElementById('btn-vs-quit').classList.remove('hidden');   // ✕ tonen (online); Journey verbergt 'm
    this.renderLoadoutBar();                                             // power-up-loadout onderin
    if (window.MenuBg) MenuBg.stop();                                   // geen vulkaan-bg tijdens een match
  },

  // touch-knoppen tonen het pixel-icoon van het actieve wapen/powerup (i.p.v. emoji)
  updateTouchIcons() {
    const p = Game.player; if (!p) return;
    if (p.heli) { this._drawTbtnIcon('tbtn-melee-ic', 'rocket'); this._drawTbtnIcon('tbtn-fire-ic', 'ak47'); return; }   // heli: raket / minigun
    const meleeId = (p.swingWeapon && Game.time < (p.swingUntil || 0)) ? p.swingWeapon : (p.meleeId || 'bat');
    let fire;
    if (p.beachball > 0) fire = 'beachball';
    else if (p.coco > 0) fire = 'coco';
    else if (p.boomerang > 0) fire = 'boom';
    else if (p.dart > 0) fire = 'dart';
    else
    if (p.giant) fire = 'fist';                                     // reus kan niet vuren
    else if (p.fireballs > 0) fire = 'fireball';
    else if (p.smashRockets > 0) fire = 'rocket';
    else if (p.cannon > 0) fire = 'cannon';
    else if (p.gunAmmo > 0 && p.rangedId === 'ak47') fire = 'ak47';
    else if (p.rangedId) fire = p.rangedId;                         // campagne/arena vuurwapen
    else fire = meleeId;                                            // geen vuurwapen -> vuurknop slaat ook
    this._drawTbtnIcon('tbtn-melee-ic', meleeId);
    this._drawTbtnIcon('tbtn-fire-ic', fire);
  },
  _drawTbtnIcon(id, kind) {
    const cv = document.getElementById(id); if (!cv) return;
    if (cv._tok === kind) return; cv._tok = kind;                   // alleen hertekenen als 't verandert
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    const P = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    if (kind === 'fireball') { P('#ff7a2a', 9, 7, 14, 16); P('#ffd24a', 13, 12, 6, 9); return; }
    if (kind === 'cannon') { P('#0e0e0e', 8, 9, 16, 15); P('#3a3a3a', 8, 9, 16, 3); P('#777', 14, 14, 3, 3); P('#6a4a2a', 15, 4, 2, 3); P('#ff8a3a', 15, 1, 2, 3); return; }
    if (kind === 'fist') { P('#3a7a4a', 9, 9, 14, 13); P('#2f5e38', 9, 9, 14, 3); P('#7affa0', 12, 12, 3, 3); return; }
    if (kind === 'beachball') { P('#ffffff', 8, 8, 16, 16); P('#e8483b', 8, 8, 16, 5); P('#3aa0e0', 8, 19, 16, 5); P('#f2c94c', 14, 8, 4, 16); return; }
    if (kind === 'coco') { P('#5e3f22', 8, 8, 16, 16); P('#8a5e36', 8, 8, 16, 5); P('#3a2614', 12, 14, 3, 3); P('#3a2614', 18, 18, 3, 3); return; }
    if (kind === 'boom') { P('#a8824a', 7, 14, 12, 4); P('#a8824a', 14, 7, 4, 12); P('#7a5e30', 7, 14, 4, 4); P('#7a5e30', 14, 7, 4, 4); return; }
    if (kind === 'dart') { P('#2f7a3a', 6, 14, 14, 3); P('#cfd6df', 19, 14, 5, 3); P('#6b4a2a', 5, 14, 3, 3); return; }
    const wid = (typeof WEAPONS !== 'undefined' && WEAPONS[kind]) ? kind : 'bat';
    ctx.save(); const s = 0.6; ctx.translate(15 - 25 * s, 16 - 23.5 * s); Sprites.drawWeaponIcon(ctx, wid, s); ctx.restore();
  },

  updateVersusHUD(v) {
    this.updateTouchIcons();
    const me = document.getElementById('vs-score-me');
    const them = document.getElementById('vs-score-them');
    if (me) me.textContent = v.myScore;
    if (them) them.textContent = v.oppScore;
    // HP-balken
    const hpMe = document.getElementById('vs-hp-me');
    const hpThem = document.getElementById('vs-hp-them');
    if (hpMe && Game.player) hpMe.style.width = Math.max(0, Math.min(100, (Game.player.hp / Game.player.maxHp) * 100)) + '%';
    if (hpThem && v.remote) hpThem.style.width = Math.max(0, Math.min(100, (v.remote.hp / (v.remote.maxHp || 100)) * 100)) + '%';
    // shield-balkjes (blauw, boven de hp)
    const shMe = document.getElementById('vs-shield-me'), shThem = document.getElementById('vs-shield-them');
    const setShield = (el, amt) => { if (!el) return; const on = amt > 0; el.classList.toggle('hidden', !on); if (on) el.firstElementChild.style.width = Math.max(0, Math.min(100, (amt / (typeof SMASH_SHIELD !== 'undefined' ? SMASH_SHIELD : 50)) * 100)) + '%'; };
    if (Game.player) setShield(shMe, Game.player.shieldHp || 0);
    if (v.remote) setShield(shThem, v.remote.shieldHp || 0);
    // guard-meter (eigen speler): zichtbaar als 'ie niet vol is; rood als 'ie gebroken is
    const gMe = document.getElementById('vs-guard-me');
    if (gMe && Game.player) {
      const gmax = (typeof GUARD_MAX !== 'undefined') ? GUARD_MAX : 2200;
      const frac = Math.max(0, Math.min(1, (Game.player.guard || 0) / gmax));
      gMe.classList.toggle('hidden', frac >= 0.999);
      gMe.firstElementChild.style.width = (frac * 100) + '%';
      gMe.classList.toggle('broken', !!Game.player._guardBroken);
    }
    const cd = document.getElementById('vs-countdown');
    if (cd) {
      if (v.countdown > 0) { cd.classList.remove('hidden'); cd.textContent = Math.ceil(v.countdown / 1000); }
      else cd.classList.add('hidden');
    }
    // grote "wint de ronde"-banner tijdens de freeze
    const rb = document.getElementById('vs-round-banner');
    if (rb) {
      if (v.roundMsg && v.roundFreezeUntil > Game.time) {
        rb.classList.remove('hidden');
        rb.textContent = v.roundMsg;
        rb.className = 'vs-round-banner ' + (v.roundMsg.indexOf('JIJ') === 0 ? 'win' : 'lose');
      } else rb.classList.add('hidden');
    }
  },

  showWinCelebration(name, won) {
    const el = document.getElementById('vs-win'); if (!el) return;
    const nm = document.getElementById('vs-win-name'); if (nm) nm.textContent = name || 'Winnaar';
    el.classList.remove('hidden');
  },

  showVersusResult(won, myScore, oppScore, xpGained, isBot, coinsEarned, peerLeft, chestDrop, mmBot) {
    const vw = document.getElementById('vs-win'); if (vw) vw.classList.add('hidden');
    // knop-bindingen herstellen (Journey kan ze hebben overschreven)
    document.getElementById('btn-vs-rematch').onclick = () => this.doRematch();
    const ag = document.getElementById('btn-vs-again'); ag.textContent = '🏠 LOBBY'; ag.onclick = () => { document.getElementById('versus-result').classList.add('hidden'); this.openVersusLobby(); };
    document.getElementById('btn-vs-menu').onclick = () => { document.getElementById('versus-result').classList.add('hidden'); this.leaveLobby(); this.show('menu'); };
    const rb = document.getElementById('vs-round-banner'); if (rb) rb.classList.add('hidden');
    document.getElementById('versus-hud').classList.add('hidden');
    document.getElementById('loadout-bar').classList.add('hidden');
    document.body.classList.remove('in-game');
    this.el.touch.classList.add('hidden');
    const t = document.getElementById('vs-result-title');
    t.textContent = won ? 'GEWONNEN! 🏆' : 'VERLOREN';
    t.className = 'screen-title ' + (won ? 'win' : 'lose');
    document.getElementById('vs-result-score').textContent = myScore + ' – ' + oppScore;
    const xpEl = document.getElementById('vs-result-xp');
    xpEl.classList.remove('hidden');
    if (!isBot || mmBot) {                       // online OF matchmaking-bot -> echte beloning tonen
      xpEl.innerHTML = (mmBot ? '🤖 Bot verslagen!<br>' : '') + '+' + (xpGained || 0) + ' XP  ·  +' + (coinsEarned || 0) + ' ● munten<br>' +
        'Level ' + playerLevel(Storage.data.xp || 0) +
        (window.Net && Net.isLoggedIn() ? '' : '  (log in om mee te tellen)');
    } else if (xpGained > 0 || coinsEarned > 0) {
      xpEl.innerHTML = '🤖 Bot Lvl 10 verslagen!<br>+' + (xpGained || 0) + ' XP  ·  +' + (coinsEarned || 0) + ' ● munten';
    } else {
      xpEl.textContent = '🤖 Oefenpotje tegen de bot — geen XP';
    }
    // rematch-knop voorbereiden
    this._rematchMine = false; this._rematchPeer = false; this._vsStarted = false; this._isBotResult = !!isBot;
    const rbtn = document.getElementById('btn-vs-rematch');
    const rs = document.getElementById('vs-rematch-status');
    const voteBox = document.getElementById('vs-result-vote');
    if (peerLeft) {
      // tegenstander heeft de match verlaten -> geen rematch mogelijk
      rbtn.disabled = true; rbtn.classList.add('hidden');
      rs.textContent = '🏃 Tegenstander heeft de match verlaten.';
      if (voteBox) voteBox.classList.add('hidden');
    } else {
      rbtn.disabled = false; rbtn.textContent = '🔁 REMATCH'; rbtn.classList.remove('hidden');
      rs.textContent = isBot ? '' : 'Beiden moeten op rematch drukken.';
      // map-stemmen voor de volgende pot: standaard de huidige map
      const curMap = (Game.vsMap && Game.vsMap.id) || VERSUS_MAPS[0].id;
      this._myVote = { map: curMap, mode: 'smash' };
      this._myReady = false;
      this._peer = isBot ? null : { map: curMap, mode: 'smash', ready: false };
      this.renderMapVote();
      this.refreshLobby();
      if (voteBox) voteBox.classList.remove('hidden');
      if (!isBot) this.broadcastLobby();      // deel mijn (standaard) keuze met de tegenstander
    }

    document.getElementById('versus-result').classList.remove('hidden');
    this.refreshAuthUI();
    document.getElementById('versus-screen').classList.add('hidden');
    // gewonnen met beloning -> munten/xp-popup bovenop de uitslag
    const rlist = [];
    if (won && (xpGained > 0 || coinsEarned > 0)) rlist.push({ type: 'earn', coins: coinsEarned, xp: xpGained });
    if (chestDrop) { rlist.push({ type: 'chest', rarity: chestDrop }); this.renderChests(); }   // nieuwe kist in het menu
    if (rlist.length) this.showRewards(rlist);
  },

  // ---- REMATCH ----
  doRematch() {
    if (this._isBotResult) {                 // bot: meteen opnieuw, zelfde map/modus
      document.getElementById('versus-result').classList.add('hidden');
      this.startBotMatch();
      return;
    }
    // online: handshake (beiden ready)
    if (!window.Net || !Net.versus) {        // tegenstander al weg / geen kanaal
      document.getElementById('vs-rematch-status').textContent = 'Geen verbinding meer — terug naar lobby.';
      return;
    }
    this._rematchMine = true;
    this.broadcastLobby();                 // mijn map-stem zeker meesturen
    Net.versusSend('rematch', {});
    const rb = document.getElementById('btn-vs-rematch');
    rb.disabled = true; rb.textContent = '✔ Wacht op tegenstander…';
    this.checkRematch();
  },

  onRematch() {
    this._rematchPeer = true;
    const rs = document.getElementById('vs-rematch-status');
    if (rs && !this._rematchMine) rs.textContent = '🔁 Tegenstander wil een rematch! Druk ook op rematch.';
    this.checkRematch();
  },

  checkRematch() {
    if (!this._rematchMine || !this._rematchPeer) return;
    // de host bepaalt de map uit de stemmen en stuurt 'begin'; beiden starten
    if (this._vsRole === 'host') {
      const cur = (Game.vsMap && Game.vsMap.id) || VERSUS_MAPS[0].id;
      const mine = (this._myVote && this._myVote.map) || cur;
      const peer = (this._peer && this._peer.map) || mine;
      const map = (mine === peer) ? mine : (Math.random() < 0.5 ? mine : peer);   // oneens -> loting
      const mode = 'smash';
      if (window.Net) Net.versusSend('begin', { map, mode });
      this._beginMatch(map, mode);
    } else {
      const rs = document.getElementById('vs-rematch-status'); if (rs) rs.textContent = 'Starten…';
    }
  },

  show(name) {
    ['menu', 'level', 'shop', 'journey', 'arena', 'win', 'lose', 'versus', 'leaderboard', 'chat', 'inventory'].forEach((s) => {
      this.el[s].classList.toggle('hidden', s !== name);
    });
    const inGame = (name === 'game');
    document.body.classList.toggle('in-game', inGame);
    this.el.hud.classList.toggle('hidden', !inGame);
    this.el.pause.classList.toggle('hidden', !inGame);
    this.el.touch.classList.toggle('hidden', !inGame || !Input.isTouch());
    if (!inGame) { this.el.tutorialBox.classList.add('hidden'); this.el.banner.classList.add('hidden'); }
    // versus-HUD nooit laten hangen op een gewoon scherm (score/HP-balken/✕)
    const vh = document.getElementById('versus-hud'); if (vh) vh.classList.add('hidden');
    const vrb = document.getElementById('vs-round-banner'); if (vrb) vrb.classList.add('hidden');
    const vw = document.getElementById('vs-win'); if (vw) vw.classList.add('hidden');
    const lb = document.getElementById('loadout-bar'); if (lb) lb.classList.add('hidden');   // loadout niet op menu's
    // vulkaan-achtergrond alleen laten draaien op de menuschermen (niet in het spel)
    if (window.MenuBg) { if (!inGame) MenuBg.start(); else MenuBg.stop(); }
    // kisten + live timer alleen op het hoofdmenu
    if (name === 'menu') { this.renderChests(); this._startChestTimer(); } else this._stopChestTimer();
    if (name !== 'versus') this._stopMatchmaking();   // buiten het versus-scherm nooit blijven zoeken

    // muntentellers bijwerken
    this.el.menuCoins.textContent = Storage.data.coins;
    if (name === 'menu') { this.updateArenaButton(); this.refreshAuthUI(); this.ensurePresence(); if (window.Sfx) Sfx.music('menu'); }
    else if (name === 'game') { this.leavePresence(); }   // tijdens het spelen niet online in de lobby
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

  // ---------- SHOP (wapens / characters / hoeden in tabs) ----------
  openShop() { if (!this._shopTab || this._shopTab === 'weapons') this._shopTab = 'chars'; this.renderShop(); this.show('shop'); },

  renderShop() {
    const tab = this._shopTab || 'chars';
    document.querySelectorAll('.shop-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.el.shopCoins.textContent = Storage.data.coins;
    this.el.shopGrid.innerHTML = '';
    if (tab === 'chars') this.renderCharCards();
    else if (tab === 'hats') this.renderHatCards();
    else if (tab === 'powerups') this.renderPowerupCards(this.el.shopGrid, 'shop');
    else this.renderWeaponCards();
  },

  // power-up-kaartjes: KOOP (meermaals) in de shop; in de inventaris = loadout aan/uit + aantal
  renderPowerupCards(grid, mode) {
    POWERUP_ORDER.forEach((id) => {
      const pu = SHOP_POWERUPS[id]; if (!pu) return;
      if (mode === 'shop' && pu.chestOnly) return;              // kist-only power-ups niet te koop
      const count = Storage.powerupCount(id);
      if (mode === 'inventory' && pu.chestOnly && count <= 0) return;   // pas tonen als je 'm hebt
      const card = document.createElement('div');
      card.className = 'shop-card powerup-card' + (count > 0 ? ' owned' : '');
      const inLo = Storage.inLoadout(id);
      const cv = document.createElement('canvas'); cv.width = 44; cv.height = 44; cv.className = 'pu-ico';
      this._puIcon(cv, pu.kind);
      const info = document.createElement('div');
      info.innerHTML = '<div class="w-name">' + pu.name + (count > 0 ? ' <span class="pu-count">x' + count + '</span>' : '') + '</div><div class="w-stats">' + pu.desc + '</div>';
      card.appendChild(cv); card.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      if (mode === 'shop') {
        const afford = Storage.data.coins >= pu.cost;
        btn.classList.add(afford ? 'buy' : 'cant');
        btn.textContent = 'KOOP — ' + pu.cost + ' ●';
        btn.onclick = () => { if (Storage.buyPowerup(id)) this.renderShop(); };
      } else {                              // inventaris: loadout-toggle
        if (count <= 0) { card.classList.add('locked'); btn.classList.add('cant'); btn.textContent = 'Koop in shop'; }
        else if (inLo) { btn.classList.add('equipped'); btn.textContent = '✓ IN LOADOUT'; card.classList.add('in-loadout'); btn.onclick = () => { Storage.toggleLoadout(id); this.renderInventory(); }; }
        else { btn.classList.add('equip'); btn.textContent = 'KIES'; btn.onclick = () => { if (!Storage.toggleLoadout(id)) this.flashLoadoutFull(); this.renderInventory(); }; }
      }
      card.appendChild(btn);
      grid.appendChild(card);
    });
  },
  flashLoadoutFull() {
    const c = document.getElementById('inv-loadout-count'); if (c) { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 500); }
  },
  // het echte drop-plaatje van een power-up op een klein canvas tekenen (hergebruikt Game.drawDrop)
  _puIcon(canvas, kind) {
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sc = canvas.width / 20;
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2 + sc); ctx.scale(sc, sc);
    if (typeof Game !== 'undefined' && Game.drawDrop) Game.drawDrop(ctx, { kind, x: 0, y: 0, id: 0 });
    ctx.restore();
  },

  // ---------- INVENTARIS (3 tabs: power-ups / characters / hoeden) ----------
  openInventory() { if (!this._invTab) this._invTab = 'powerups'; this.renderInventory(); this.show('inventory'); },
  renderInventory() {
    const tab = this._invTab || 'powerups';
    document.querySelectorAll('#inv-tabs .shop-tab').forEach((b) => b.classList.toggle('active', b.dataset.invtab === tab));
    const grid = document.getElementById('inv-grid'); grid.innerHTML = '';
    const hint = document.getElementById('inv-hint');
    if (tab === 'powerups') {
      hint.classList.remove('hidden');
      hint.innerHTML = 'Kies max <b>3</b> power-ups voor je loadout (<span id="inv-loadout-count">' + Storage.loadout().length + '</span>/3). In een match activeer je ze; per gebruik gaat er 1 af.';
      this.renderPowerupCards(grid, 'inventory');
    } else if (tab === 'chars') { hint.classList.add('hidden'); this.renderOwnedChars(grid); }
    else { hint.classList.add('hidden'); this.renderOwnedHats(grid); }
  },
  _spriteCard(palette, opts, nameHtml, owned) {
    const card = document.createElement('div');
    card.className = 'shop-card' + (owned ? ' owned' : '');
    const canvas = document.createElement('canvas'); canvas.width = 110; canvas.height = 64;
    const cctx = canvas.getContext('2d'); cctx.imageSmoothingEnabled = false;
    cctx.save(); cctx.translate(55, 4); cctx.scale(1.4, 1.4);
    Sprites.drawCharacter(cctx, 0, 38, 1, palette, opts); cctx.restore();
    const info = document.createElement('div'); info.innerHTML = nameHtml;
    card.appendChild(canvas); card.appendChild(info);
    return card;
  },
  renderOwnedChars(grid) {
    grid.innerHTML = '';
    CHARACTER_ORDER.forEach((cid) => {
      if (!Storage.ownsCharacter(cid)) return;
      const c = CHARACTERS[cid]; const equipped = Storage.data.equippedCharacter === cid;
      const card = this._spriteCard(c.palette, { weapon: c.startMelee || c.forcedMelee || 'bat', build: c.build, hair: c.hair, hat: Storage.data.equippedHat }, '<div class="w-name">' + c.name + '</div>', true);
      const btn = document.createElement('button'); btn.className = 'shop-buy';
      if (equipped) { btn.classList.add('equipped'); btn.textContent = 'UITGERUST'; }
      else { btn.classList.add('equip'); btn.textContent = 'UITRUSTEN'; btn.onclick = () => { Storage.equipCharacter(cid); this.renderInventory(); }; }
      card.appendChild(btn); grid.appendChild(card);
    });
  },
  renderOwnedHats(grid) {
    grid.innerHTML = '';
    const cc = CHARACTERS[Storage.data.equippedCharacter] || CHARACTERS.ryan;
    HAT_ORDER.forEach((hid) => {
      if (!Storage.ownsHat(hid)) return;
      const h = HATS[hid]; const equipped = Storage.data.equippedHat === hid;
      const card = this._spriteCard(cc.palette, { weapon: cc.forcedMelee || 'bat', build: cc.build, hair: cc.hair, hat: hid }, '<div class="w-name">' + h.name + '</div>', true);
      const btn = document.createElement('button'); btn.className = 'shop-buy';
      if (equipped) { btn.classList.add('equipped'); btn.textContent = hid === 'none' ? 'OP' : 'OP'; }
      else { btn.classList.add('equip'); btn.textContent = hid === 'none' ? 'AF' : 'OPZETTEN'; btn.onclick = () => { Storage.equipHat(hid); this.renderInventory(); }; }
      card.appendChild(btn); grid.appendChild(card);
    });
  },

  // ---------- LOADOUT-BALK (in de match) ----------
  renderLoadoutBar() {
    const bar = document.getElementById('loadout-bar'); if (!bar) return;
    const lo = Storage.loadout();
    const slots = bar.querySelectorAll('.loadout-slot');
    slots.forEach((slot, i) => {
      const id = lo[i];
      if (!id) { slot.classList.add('empty'); slot.dataset.pu = ''; slot.innerHTML = ''; slot.disabled = true; return; }
      const pu = SHOP_POWERUPS[id]; const n = Storage.powerupCount(id);
      slot.classList.remove('empty'); slot.dataset.pu = id; slot.disabled = n <= 0;
      slot.classList.toggle('depleted', n <= 0);
      slot.innerHTML = '';
      const cv = document.createElement('canvas'); cv.width = 30; cv.height = 30; cv.className = 'lo-ico';
      this._puIcon(cv, pu.kind);
      const nEl = document.createElement('span'); nEl.className = 'lo-n'; nEl.textContent = n;
      slot.appendChild(cv); slot.appendChild(nEl);
    });
    bar.classList.toggle('hidden', lo.length === 0);
  },

  // ---------- KISTEN (op het hoofdmenu) ----------
  renderChests() {
    const bar = document.getElementById('chest-bar'); if (!bar) return;
    const chests = Storage.chests();
    bar.querySelectorAll('.chest-slot').forEach((slot, i) => {
      const c = chests[i];
      slot.innerHTML = '';
      if (!c) { slot.className = 'chest-slot empty'; slot.disabled = true; slot.style.borderColor = ''; slot.innerHTML = '<span class="chest-lbl">Leeg</span>'; return; }
      const t = CHEST_TYPES[c.r], ready = Storage.chestReady(i);
      slot.className = 'chest-slot' + (ready ? ' ready' : '') + (c.u <= 0 ? ' idle' : ''); slot.disabled = false;
      slot.style.borderColor = t.col;
      const cv = document.createElement('canvas'); cv.width = 48; cv.height = 40; cv.className = 'chest-ico';
      this._drawChestIcon(cv, c.r, ready);
      const lbl = document.createElement('span'); lbl.className = 'chest-lbl';
      lbl.textContent = ready ? 'OPHALEN!' : (c.u <= 0 ? t.name : this._fmtChestTime(Storage.chestSecondsLeft(i)));
      slot.appendChild(cv); slot.appendChild(lbl);
    });
  },
  _fmtChestTime(s) {
    if (s == null || s < 0) return 'Open';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'u' + (m < 10 ? '0' : '') + m + 'm';
    if (m > 0) return m + 'm' + (sec < 10 ? '0' : '') + sec + 's';
    return sec + 's';
  },
  _chestArt(ctx, rarity) {
    const t = CHEST_TYPES[rarity] || CHEST_TYPES.common;
    const px = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    px(t.col, -13, -2, 26, 12);                     // onderkant
    px('rgba(0,0,0,0.35)', -13, 7, 26, 3);
    px(t.col, -14, -10, 28, 8);                     // deksel
    px('rgba(255,255,255,0.25)', -14, -10, 28, 2);
    px(t.band, -14, -4, 28, 2);                     // gouden band horizontaal
    px(t.band, -2, -10, 4, 20);                     // gouden band verticaal
    px('#2a1c08', -3, -1, 6, 5); px('#ffd24a', -1, 1, 2, 2);   // slot
  },
  _drawChestIcon(canvas, rarity, ready) {
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ready) { const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 2, canvas.width / 2, canvas.height / 2, 22); g.addColorStop(0, (CHEST_TYPES[rarity] || {}).band || '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.globalAlpha = 0.65; ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2 + 3); this._chestArt(ctx, rarity); ctx.restore();
  },
  chestClick(i) {
    const c = Storage.chests()[i]; if (!c) return;
    if (window.Sfx) Sfx.play('click');
    if (Storage.chestReady(i)) { const rw = Storage.collectChest(i); this.renderChests(); if (rw) this.showChestRewards(rw); }
    else if (c.u <= 0) { Storage.startChest(i); this.renderChests(); }   // tik = openen (timer start)
    // bezig met openen: laat de timer gewoon lopen
  },
  showChestRewards(rw) {
    const list = [{ type: 'earn', coins: rw.gold, xp: rw.xp }];
    for (const id in rw.pus) list.push({ type: 'pu', id, n: rw.pus[id] });
    this.showRewards(list);
  },
  _startChestTimer() { if (this._chestIv) return; this._chestIv = setInterval(() => this.renderChests(), 1000); },
  _stopChestTimer() { if (this._chestIv) { clearInterval(this._chestIv); this._chestIv = 0; } },

  renderWeaponCards() {
    const grid = this.el.shopGrid;

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

  // ---------- CHARACTERS-tab ----------
  renderCharCards() {
    const grid = this.el.shopGrid;
    const myLvl = playerLevel(Storage.data.xp || 0);

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
        weapon: c.forcedMelee || 'bat', build: c.build, hair: c.hair, hat: Storage.data.equippedHat,
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
        btn.onclick = () => { Storage.equipCharacter(cid); this.renderShop(); };
      } else if (c.journeyOnly) {
        card.classList.add('locked'); btn.classList.add('cant'); btn.textContent = '🔒 Journey';
      } else if (myLvl < (c.lvl || 0)) {
        card.classList.add('locked'); btn.classList.add('cant'); btn.textContent = '🔒 Level ' + c.lvl;
      } else if (Storage.data.coins >= c.cost) {
        btn.classList.add('buy'); btn.textContent = `KOOP — ${c.cost} ●`;
        btn.onclick = () => { if (Storage.buyCharacter(cid)) { Storage.equipCharacter(cid); this.renderShop(); } };
      } else {
        btn.classList.add('cant'); btn.textContent = `${c.cost} ● (te weinig)`;
      }

      card.appendChild(canvas);
      card.appendChild(info);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  },

  // ---------- HOEDEN-tab ----------
  renderHatCards() {
    const grid = this.el.shopGrid;
    const cc = CHARACTERS[Storage.data.equippedCharacter] || CHARACTERS.ryan;
    const myLvl = playerLevel(Storage.data.xp || 0);

    HAT_ORDER.forEach((hid) => {
      const h = HATS[hid];
      const owned = Storage.ownsHat(hid);
      const equipped = Storage.data.equippedHat === hid;

      const card = document.createElement('div');
      card.className = 'shop-card' + (owned ? ' owned' : '');

      // preview: jouw character met deze hoed
      const canvas = document.createElement('canvas');
      canvas.width = 110; canvas.height = 64;
      const cctx = canvas.getContext('2d');
      cctx.imageSmoothingEnabled = false;
      cctx.save();
      cctx.translate(55, 4); cctx.scale(1.4, 1.4);
      Sprites.drawCharacter(cctx, 0, 38, 1, cc.palette, { weapon: cc.forcedMelee || 'bat', build: cc.build, hair: cc.hair, hat: hid });
      cctx.restore();

      const info = document.createElement('div');
      info.innerHTML = `<div class="w-name">${h.name}</div><div class="w-stats">${h.desc}</div>`;

      const btn = document.createElement('button');
      btn.className = 'shop-buy';
      if (equipped) {
        btn.classList.add('equipped'); btn.textContent = 'OP';
      } else if (owned) {
        btn.classList.add('equip'); btn.textContent = hid === 'none' ? 'AF' : 'OPZETTEN';
        btn.onclick = () => { Storage.equipHat(hid); this.renderShop(); };
      } else if (h.journeyOnly) {
        card.classList.add('locked'); btn.classList.add('cant'); btn.textContent = '🔒 Journey';
      } else if (myLvl < (h.lvl || 0)) {
        card.classList.add('locked'); btn.classList.add('cant'); btn.textContent = '🔒 Level ' + h.lvl;
      } else if (Storage.data.coins >= h.cost) {
        btn.classList.add('buy'); btn.textContent = `KOOP — ${h.cost} ●`;
        btn.onclick = () => { if (Storage.buyHat(hid)) { Storage.equipHat(hid); this.renderShop(); } };
      } else {
        btn.classList.add('cant'); btn.textContent = `${h.cost} ● (te weinig)`;
      }

      card.appendChild(canvas);
      card.appendChild(info);
      card.appendChild(btn);
      grid.appendChild(card);
    });
  },

  // ---------- HUD (elke frame) ----------
  updateHUD(game) {
    this.updateTouchIcons();
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
      main = lv.balloonBoss ? '🎈 BALLON ZOMBIE' : lv.apeBoss ? '🦍 MEGA ZOMBIE-AAP' : '☠ MEGA ZOMBIE';
      sub = lv.balloonBoss ? 'spring & schiet de ballon neer!'
        : lv.apeBoss ? (game.boss.enraged ? '🔥 RAZEND! spring weg van de schokgolf!' : 'ontwijk de sprong + spring bij de landing!')
        : 'raak alleen het HOOFD — spring!';
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
    this.el.winReplayNote.classList.toggle('hidden', !stats.replay);
    this.show('win');
  },
  showLose(stats) {
    this.el.loseKills.textContent = stats.kills;
    this.el.loseCoins.textContent = stats.coins;
    this.el.loseTitle.textContent = stats.reason === 'time' ? 'NIET BINNEN DE TIJD' : 'DOOD';
    this.show('lose');
  },
};
window.UI = UI;   // zodat window.UI-checks (o.a. in net.js) werken
