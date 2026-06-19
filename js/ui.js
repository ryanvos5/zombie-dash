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
      character: $('character-screen'), arena: $('arena-screen'), versus: $('versus-screen'),
      leaderboard: $('leaderboard-screen'), chat: $('chat-screen'),
      arenaRound: $('arena-round'), arenaCoins: $('arena-coins'), arenaBest: $('arena-best'),
      arenaLeft: $('arena-left'), arenaRecord: $('arena-record'),
      winKills: $('win-kills'), winCoins: $('win-coins'), winReplayNote: $('win-replay-note'),
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
    $('btn-versus').onclick = () => this.openVersusLobby();
    $('btn-vs-host').onclick = () => this.versusHost();
    $('btn-vs-join').onclick = () => this.versusJoin();
    $('btn-vs-bot').onclick = () => this.openBotSetup();
    $('btn-vs-quit').onclick = () => Game.quitVersus();
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

  // tekst van de Knock-out-menuknop bijwerken (resterende pogingen)
  updateArenaButton() {
    const ab = document.getElementById('btn-arena');
    if (!ab) return;
    if (window.Net && Net.ready && Net.isLoggedIn()) {
      ab.textContent = 'ZOMBIE KNOCK-OUT';
      Net.arenaPlaysLeft().then((n) => { if (n != null) ab.textContent = 'ZOMBIE KNOCK-OUT (' + n + '×)'; }).catch(() => {});
    } else if (window.Net && Net.ready) {
      ab.textContent = 'ZOMBIE KNOCK-OUT 🔒';
    } else {
      ab.textContent = 'ZOMBIE KNOCK-OUT (' + Storage.arenaPlaysLeft() + '×)';
    }
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
    if (this.el.charCoins) this.el.charCoins.textContent = Storage.data.coins;
  },

  refreshAuthUI() {
    const status = document.getElementById('account-status');
    const btnAcc = document.getElementById('btn-account');
    const btnOut = document.getElementById('btn-logout');
    if (!status || !btnAcc || !btnOut) return;
    const inLogged = window.Net && Net.isLoggedIn && Net.isLoggedIn();
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
    const others = (this._peers || []).filter((p) => !p.me).length;
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
        if (Game.state === 'versus') { Game.endVersus(true); }   // tegenstander quit mid-game = jij wint
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
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'melee' };
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
    this.show('versus');
  },

  // tegen de bot spelen (lokaal, gekozen map, geen XP)
  startBotMatch() {
    this._botSetup = false;
    this._vsStarted = true;
    document.querySelector('.vs-wait-label').classList.remove('hidden');
    const v = this._myVote || { map: (Game.vsMap && Game.vsMap.id) || VERSUS_MAPS[0].id, mode: Game.vsMode || 'melee' };
    Game.startVersus('host', { mapId: v.map, mode: v.mode, bot: true });
  },

  // in een kamer: toon code, wacht op tegenstander
  _enterRoom(code) {
    this._vsStarted = false; this._peer = null; this._myReady = false;
    this._myVote = { map: VERSUS_MAPS[0].id, mode: 'melee' };
    document.getElementById('versus-msg').textContent = '';
    document.getElementById('versus-lobby').classList.add('hidden');
    document.getElementById('versus-wait').classList.remove('hidden');
    document.getElementById('vs-room-code').textContent = code;
    document.getElementById('vs-peer-status').textContent = 'Wachten op tegenstander…';
    document.getElementById('vs-lobby-opts').classList.add('hidden');
  },

  // tegenstander aanwezig -> open de vote-lobby (NIET meteen starten)
  _onVersusMatch() {
    if (window.Net && Net.lobby) Net.lobbyLeave();   // chat niet meer nodig tijdens het potje
    document.getElementById('vs-peer-status').textContent = '✅ Tegenstander aanwezig!';
    document.getElementById('vs-lobby-opts').classList.remove('hidden');
    this.renderMapVote();
    this.refreshLobby();
    this.broadcastLobby();        // deel mijn (standaard) keuze
  },

  renderMapVote() {
    const list = document.getElementById('vs-map-list');
    list.innerHTML = '';
    VERSUS_MAPS.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'vs-map-btn' + (this._myVote.map === m.id ? ' picked' : '');
      b.dataset.map = m.id;
      b.innerHTML = '<span class="vs-map-name">' + m.name + '</span><span class="vs-map-votes" data-mv="' + m.id + '"></span>';
      b.onclick = () => this.setVoteMap(m.id);
      list.appendChild(b);
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
    if (window.Net) Net.versusSend('lobby', { map: this._myVote.map, mode: this._myVote.mode, ready: !!this._myReady });
  },
  onLobbyUpdate(p) {
    this._peer = { map: p.map, mode: p.mode, ready: !!p.ready };
    // tegenstander aanwezig -> zorg dat de opts zichtbaar zijn
    if (document.getElementById('vs-lobby-opts').classList.contains('hidden')) this._onVersusMatch();
    this.refreshLobby(); this.checkBothReady();
  },

  refreshLobby() {
    // map-stemmen tonen
    VERSUS_MAPS.forEach((m) => {
      const el = document.querySelector('[data-mv="' + m.id + '"]');
      if (!el) return;
      let n = 0; if (this._myVote.map === m.id) n++; if (this._peer && this._peer.map === m.id) n++;
      el.textContent = n ? '●'.repeat(n) : '';
    });
    document.querySelectorAll('.vs-map-btn').forEach((b) => b.classList.toggle('picked', b.dataset.map === this._myVote.map));
    document.querySelectorAll('.vs-mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === this._myVote.mode));
    const ready = document.getElementById('btn-vs-ready');
    ready.textContent = this._myReady ? '✔ READY (klik om te annuleren)' : 'READY';
    ready.classList.toggle('on', this._myReady);
    const st = document.getElementById('vs-ready-status');
    const peerReady = this._peer && this._peer.ready;
    st.textContent = 'Jij: ' + (this._myReady ? 'klaar' : 'kiezen…') + '   •   Tegenstander: ' + (this._peer ? (peerReady ? 'klaar' : 'kiezen…') : '—');
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
    const mode = (mine.mode === peer.mode) ? mine.mode : (Math.random() < 0.5 ? mine.mode : peer.mode);
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
    ['menu', 'level', 'shop', 'character', 'arena', 'win', 'lose', 'versus', 'leaderboard', 'chat'].forEach((s) =>
      this.el[s].classList.add('hidden'));
    document.body.classList.add('in-game');
    this.el.hud.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.banner.classList.add('hidden');
    this.el.touch.classList.toggle('hidden', !Input.isTouch());
    document.getElementById('versus-hud').classList.remove('hidden');
  },

  updateVersusHUD(v) {
    const me = document.getElementById('vs-score-me');
    const them = document.getElementById('vs-score-them');
    if (me) me.textContent = v.myScore;
    if (them) them.textContent = v.oppScore;
    // HP-balken
    const hpMe = document.getElementById('vs-hp-me');
    const hpThem = document.getElementById('vs-hp-them');
    if (hpMe && Game.player) hpMe.style.width = Math.max(0, Math.min(100, (Game.player.hp / Game.player.maxHp) * 100)) + '%';
    if (hpThem && v.remote) hpThem.style.width = Math.max(0, Math.min(100, (v.remote.hp / (v.remote.maxHp || 100)) * 100)) + '%';
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

  showVersusResult(won, myScore, oppScore, xpGained, isBot) {
    const rb = document.getElementById('vs-round-banner'); if (rb) rb.classList.add('hidden');
    document.getElementById('versus-hud').classList.add('hidden');
    document.body.classList.remove('in-game');
    this.el.touch.classList.add('hidden');
    const t = document.getElementById('vs-result-title');
    t.textContent = won ? 'GEWONNEN! 🏆' : 'VERLOREN';
    t.className = 'screen-title ' + (won ? 'win' : 'lose');
    document.getElementById('vs-result-score').textContent = myScore + ' – ' + oppScore;
    const xpEl = document.getElementById('vs-result-xp');
    if (isBot) {
      xpEl.classList.remove('hidden');
      xpEl.textContent = '🤖 Oefenpotje tegen de bot — geen XP';
    } else if (xpGained) {
      xpEl.classList.remove('hidden');
      xpEl.textContent = '+' + xpGained + ' XP  ·  Level ' + playerLevel(Storage.data.xp || 0) +
        (window.Net && Net.isLoggedIn() ? '' : '  (log in om mee te tellen)');
    } else { xpEl.classList.add('hidden'); }
    // rematch-knop voorbereiden
    this._rematchMine = false; this._rematchPeer = false; this._vsStarted = false; this._isBotResult = !!isBot;
    const rbtn = document.getElementById('btn-vs-rematch');
    const rs = document.getElementById('vs-rematch-status');
    rbtn.disabled = false; rbtn.textContent = '🔁 REMATCH'; rbtn.classList.remove('hidden');
    rs.textContent = isBot ? '' : 'Beiden moeten op rematch drukken.';

    document.getElementById('versus-result').classList.remove('hidden');
    this.refreshAuthUI();
    document.getElementById('versus-screen').classList.add('hidden');
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
    // de host bepaalt en stuurt 'begin' (zelfde map + modus); beiden starten
    if (this._vsRole === 'host') {
      const map = (Game.vsMap && Game.vsMap.id) || VERSUS_MAPS[0].id;
      const mode = Game.vsMode || 'melee';
      if (window.Net) Net.versusSend('begin', { map, mode });
      this._beginMatch(map, mode);
    } else {
      const rs = document.getElementById('vs-rematch-status'); if (rs) rs.textContent = 'Starten…';
    }
  },

  show(name) {
    ['menu', 'level', 'shop', 'character', 'arena', 'win', 'lose', 'versus', 'leaderboard', 'chat'].forEach((s) => {
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

    // muntentellers bijwerken
    this.el.menuCoins.textContent = Storage.data.coins;
    const upBtn = document.getElementById('btn-update');
    if (upBtn) upBtn.classList.toggle('hidden', name !== 'menu');
    if (name === 'menu') { this.updateArenaButton(); this.ensurePresence(); }
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
        weapon: c.forcedMelee || 'bat', build: c.build, hair: c.hair,
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
