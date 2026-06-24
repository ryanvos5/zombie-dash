/* ============================================================
   NET — accounts (Supabase Auth) + cloud-opslag van voortgang.
   Inloggen is OPTIONEEL: zonder account speel je gewoon lokaal door.
   De publieke 'anon'-sleutel hieronder is veilig om in de client te zetten;
   echte beveiliging gebeurt server-side via Row Level Security.
   ============================================================ */
const SUPA_URL = 'https://ldzdfgfaqiwwdogpltsu.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkemRmZ2ZhcWl3d2RvZ3BsdHN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzgwNzQsImV4cCI6MjA5NjA1NDA3NH0.bzoEhgQB727gjS0JfEqxjLlqyam0fuy0J7UovCeg6oY';

const Net = {
  sb: null,
  user: null,
  ready: false,
  authReady: false,     // true zodra de sessie (wel/niet ingelogd) is opgehaald
  pushTimer: null,

  init() {
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[Net] supabase-js niet geladen — alleen lokaal spelen.');
      return;
    }
    try {
      this.sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
    } catch (e) { console.warn('[Net] init faalde', e); return; }
    this.ready = true;

    // bestaande sessie herstellen
    this.sb.auth.getSession().then(({ data }) => {
      if (data && data.session) {
        this.user = data.session.user;
        this.afterLogin();
      }
      this.authReady = true;
      this._refreshUI();
      if (this.lobby) this.lobbyRefreshNick();   // presence-naam bijwerken zodra sessie bekend is
    }).catch(() => { this.authReady = true; });
    this.sb.auth.onAuthStateChange((_evt, session) => {
      this.user = session ? session.user : null;
      this.authReady = true;
      this._refreshUI();
      if (this.lobby) this.lobbyRefreshNick();   // bij inloggen/uitloggen de naam updaten
    });
  },

  isLoggedIn() { return !!this.user; },
  nickname() {
    if (!this.user) return null;
    return (this.user.user_metadata && this.user.user_metadata.nickname) || this.user.email || 'Speler';
  },

  // ---- auth ----
  async register(email, nickname, password) {
    if (!this.ready) throw new Error('Geen verbinding met de server.');
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nickname: (nickname || '').trim() },
        emailRedirectTo: location.origin + location.pathname,
      },
    });
    if (error) throw error;
    if (data.session) {            // bevestiging staat uit -> meteen ingelogd
      this.user = data.user;
      await this.ensureProfile();
      await this.pushCloudSave();
      this._refreshUI();
      return { confirmed: true };
    }
    return { confirmed: false };   // moet eerst e-mail bevestigen
  },

  async login(email, password) {
    if (!this.ready) throw new Error('Geen verbinding met de server.');
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    this.user = data.user;
    await this.afterLogin();
    this._refreshUI();
    return data;
  },

  async logout() {
    if (!this.ready) return;
    try { await this.sb.auth.signOut(); } catch (e) {}
    this.user = null;
    this._refreshUI();
  },

  // na (her)inloggen: profiel borgen + cloud-save mergen
  async afterLogin() {
    await this.ensureProfile();
    await this.loadCloudSave();
    if (window.UI && UI.afterNetLogin) UI.afterNetLogin();
  },

  async ensureProfile() {
    if (!this.user) return;
    const nick = (this.user.user_metadata && this.user.user_metadata.nickname) || null;
    const row = { id: this.user.id, updated_at: new Date().toISOString() };
    if (nick) row.nickname = nick;   // alleen zetten als we een naam hebben (bestaande naam niet wissen)
    try {
      await this.sb.from('game_profiles').upsert(row, { onConflict: 'id' });
    } catch (e) { console.warn('[Net] ensureProfile', e); }
  },

  // nickname instellen/wijzigen (auth-metadata + leaderboard-rij)
  async setNickname(nick) {
    nick = (nick || '').trim();
    if (!nick) throw new Error('Vul een naam in.');
    if (nick.length > 20) nick = nick.slice(0, 20);
    if (!this.user) throw new Error('Je bent niet ingelogd.');
    const { error: e1 } = await this.sb.auth.updateUser({ data: { nickname: nick } });
    if (e1) throw e1;
    const { error: e2 } = await this.sb.from('game_profiles')
      .update({ nickname: nick, updated_at: new Date().toISOString() }).eq('id', this.user.id);
    if (e2) throw e2;
    if (this.user.user_metadata) this.user.user_metadata.nickname = nick;
    this._refreshUI();
    return nick;
  },

  // ---- cloud-opslag ----
  async loadCloudSave() {
    if (!this.user) return;
    try {
      const { data, error } = await this.sb.from('game_profiles')
        .select('save_data').eq('id', this.user.id).maybeSingle();
      if (error) { console.warn('[Net] loadCloudSave', error); return; }
      if (data && data.save_data) {
        Storage.mergeCloud(data.save_data);      // neem het beste van cloud + lokaal
        await this.pushCloudSave();              // schrijf de samengevoegde stand terug
      } else {
        await this.pushCloudSave();              // nog geen cloud-save: zet de lokale erin
      }
    } catch (e) { console.warn('[Net] loadCloudSave', e); }
    if (window.UI && UI.syncCoins) UI.syncCoins();
  },

  // gedebouncede push (wordt vanuit Storage.save aangeroepen)
  queueCloudSave() {
    if (!this.user) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.pushCloudSave(), 1500);
  },
  async pushCloudSave() {
    if (!this.user) return;
    try {
      await this.sb.from('game_profiles')
        .update({
          save_data: Storage.data,
          mp_wins: Storage.data.mpWins || 0,
          mp_losses: Storage.data.mpLosses || 0,
          xp: Storage.data.xp || 0,
          arena_best: Storage.data.arenaBest || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.user.id);
    } catch (e) { console.warn('[Net] pushCloudSave', e); }
  },

  // leaderboard ophalen (sort_by: 'xp' | 'arena' | 'wins')
  async getLeaderboard(sortBy, limit) {
    if (!this.ready) throw new Error('Geen verbinding met de server.');
    const { data, error } = await this.sb.rpc('get_leaderboard', {
      sort_by: sortBy || 'xp', limit_n: limit || 50,
    });
    if (error) throw error;
    return data || [];
  },

  // eigen positie op de ranglijst (of null als niet ingelogd / geen rij)
  async getMyRank(sortBy) {
    if (!this.ready || !this.user) return null;
    const { data, error } = await this.sb.rpc('get_my_rank', { sort_by: sortBy || 'xp' });
    if (error) { console.warn('[Net] getMyRank', error); return null; }
    return (data && data[0]) || null;
  },

  // ---- Knock-out dag-limiet via account (reset 06:00 Amsterdam) ----
  async arenaPlaysLeft() {
    if (!this.ready || !this.user) return null;          // niet ingelogd
    const { data, error } = await this.sb.rpc('arena_plays_left');
    if (error) { console.warn('[Net] arenaPlaysLeft', error); return null; }
    return data;
  },
  async arenaUsePlay() {
    if (!this.ready || !this.user) return null;
    const { data, error } = await this.sb.rpc('arena_use_play');
    if (error) throw error;
    return data;                                          // resterend, of -1 als op
  },

  _refreshUI() { if (window.UI && UI.refreshAuthUI) UI.refreshAuthUI(); },

  // ============ 1 vs 1 MULTIPLAYER (Supabase Realtime) ============
  versus: null,

  makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // zonder verwarrende tekens
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  },

  // host maakt een kamer, guest doet mee. cbs = { onPresence, onState, onHit, onFell }
  async versusHost(cbs) { return this._versusJoin(this.makeRoomCode(), 'host', cbs); },
  async versusJoin(code, cbs) {
    if (!code || code.length < 3) throw new Error('Vul een geldige kamercode in.');
    return this._versusJoin(code.toUpperCase().trim(), 'guest', cbs);
  },

  async _versusJoin(code, role, cbs) {
    if (!this.ready) throw new Error('Geen verbinding met de server.');
    this.leaveVersus();
    const myId = (this.user && this.user.id) || ('gast-' + Math.floor(Math.random() * 1e7));
    const ch = this.sb.channel('versus-' + code, { config: { broadcast: { self: false } } });
    const v = { channel: ch, code, role, myId, cbs: cbs || {}, matched: false, joinTimer: null };
    this.versus = v;
    // start-handshake via broadcast (betrouwbaarder dan presence)
    ch.on('broadcast', { event: 'join' }, () => {
      if (role === 'host') { this.versusSend('start', {}); this._versusMatch(v, 'host'); }
    });
    ch.on('broadcast', { event: 'start' }, () => {
      if (role === 'guest') this._versusMatch(v, 'guest');
    });
    ch.on('broadcast', { event: 'state' }, (m) => { if (v.cbs.onState) v.cbs.onState(m.payload); });
    ch.on('broadcast', { event: 'hit' }, (m) => { if (v.cbs.onHit) v.cbs.onHit(m.payload); });
    ch.on('broadcast', { event: 'fell' }, (m) => { if (v.cbs.onFell) v.cbs.onFell(m.payload); });
    ch.on('broadcast', { event: 'burn' }, (m) => { if (v.cbs.onBurn) v.cbs.onBurn(m.payload); });
    ch.on('broadcast', { event: 'shot' }, (m) => { if (v.cbs.onShot) v.cbs.onShot(m.payload); });
    ch.on('broadcast', { event: 'lobby' }, (m) => { if (v.cbs.onLobby) v.cbs.onLobby(m.payload); });
    ch.on('broadcast', { event: 'begin' }, (m) => { if (v.cbs.onBegin) v.cbs.onBegin(m.payload); });
    ch.on('broadcast', { event: 'rematch' }, (m) => { if (v.cbs.onRematch) v.cbs.onRematch(m.payload); });
    ch.on('broadcast', { event: 'over' }, (m) => { if (v.cbs.onOver) v.cbs.onOver(m.payload); });
    ch.on('broadcast', { event: 'drop' }, (m) => { if (v.cbs.onDrop) v.cbs.onDrop(m.payload); });
    ch.on('broadcast', { event: 'pickup' }, (m) => { if (v.cbs.onPickup) v.cbs.onPickup(m.payload); });
    ch.on('broadcast', { event: 'portal' }, (m) => { if (v.cbs.onPortal) v.cbs.onPortal(m.payload); });
    ch.on('broadcast', { event: 'dragon' }, (m) => { if (v.cbs.onDragon) v.cbs.onDragon(m.payload); });
    ch.on('broadcast', { event: 'stun' }, (m) => { if (v.cbs.onStun) v.cbs.onStun(m.payload); });
    ch.on('broadcast', { event: 'cavearm' }, (m) => { if (v.cbs.onCaveArm) v.cbs.onCaveArm(m.payload); });
    ch.on('broadcast', { event: 'cavewall' }, (m) => { if (v.cbs.onCaveWall) v.cbs.onCaveWall(m.payload); });
    ch.on('broadcast', { event: 'rocks' }, (m) => { if (v.cbs.onRocks) v.cbs.onRocks(m.payload); });
    ch.on('broadcast', { event: 'lava' }, (m) => { if (v.cbs.onLava) v.cbs.onLava(m.payload); });
    ch.on('broadcast', { event: 'tentacle' }, (m) => { if (v.cbs.onTentacle) v.cbs.onTentacle(m.payload); });
    ch.on('broadcast', { event: 'bye' }, () => { if (v.cbs.onPeerLeft) v.cbs.onPeerLeft(); });
    await new Promise((resolve, reject) => {
      let done = false;
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && !done) { done = true; resolve(); }
        else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !done) {
          done = true; reject(new Error('Kon niet verbinden met de kamer.'));
        }
      });
      setTimeout(() => { if (!done) { done = true; reject(new Error('Time-out bij verbinden.')); } }, 8000);
    });
    // guest klopt herhaaldelijk aan tot de host 'start' terugstuurt
    if (role === 'guest') {
      let tries = 0;
      const ping = () => {
        if (v.matched || tries++ > 20) { if (v.joinTimer) clearInterval(v.joinTimer); v.joinTimer = null; return; }
        this.versusSend('join', { id: myId });
      };
      ping();
      v.joinTimer = setInterval(ping, 600);
    }
    return code;
  },

  _versusMatch(v, role) {
    if (!v || v.matched) return;
    v.matched = true;
    if (v.joinTimer) { clearInterval(v.joinTimer); v.joinTimer = null; }
    if (v.cbs.onMatch) v.cbs.onMatch(role);
  },

  setVersusCallbacks(cbs) { if (this.versus) this.versus.cbs = Object.assign(this.versus.cbs || {}, cbs); },

  versusSend(event, payload) {
    if (this.versus && this.versus.channel) {
      this.versus.channel.send({ type: 'broadcast', event, payload });
    }
  },

  // ============ LOBBY-CHAT (globaal: chat + wie-is-online + invites) ============
  lobby: null,
  lobbyPeers: {},
  _guestId: null,

  lobbyMyId() { return (this.user && this.user.id) || (this._guestId || (this._guestId = 'gast-' + Math.floor(Math.random() * 1e7))); },
  lobbyMyNick() { return this.nickname() || ('Gast' + this.lobbyMyId().slice(-4)); },

  async lobbyJoin(cbs) {
    if (!this.ready) throw new Error('Geen verbinding met de server.');
    this.lobbyLeave();
    const id = this.lobbyMyId(), nick = this.lobbyMyNick();
    const ch = this.sb.channel('lobby-chat', { config: { broadcast: { self: false } } });
    const L = { channel: ch, cbs: cbs || {}, id, nick, hbTimer: null, pruneTimer: null };
    this.lobbyPeers = {};
    ch.on('broadcast', { event: 'chat' }, (m) => { if (L.cbs.onChat) L.cbs.onChat(m.payload); });
    ch.on('broadcast', { event: 'here' }, (m) => { const p = m.payload; if (p && p.id) { this.lobbyPeers[p.id] = { nick: p.nick, t: Date.now(), guest: p.g === 1 }; this._emitPeers(L); } });
    ch.on('broadcast', { event: 'lbye' }, (m) => { if (m.payload && m.payload.id) { delete this.lobbyPeers[m.payload.id]; this._emitPeers(L); } });
    ch.on('broadcast', { event: 'invite' }, (m) => { if (m.payload && m.payload.to === id && L.cbs.onInvite) L.cbs.onInvite(m.payload); });
    await new Promise((resolve, reject) => {
      let done = false;
      ch.subscribe((st) => {
        if (st === 'SUBSCRIBED' && !done) { done = true; resolve(); }
        else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !done) { done = true; reject(new Error('Kon de chat niet verbinden.')); }
      });
      setTimeout(() => { if (!done) { done = true; reject(new Error('Time-out bij de chat.')); } }, 8000);
    });
    this.lobby = L;
    const beat = () => this.lobbySend('here', { id: L.id, nick: L.nick, g: this.isLoggedIn() ? 0 : 1 });   // leest live id/nick + gast-vlag
    beat();
    L.hbTimer = setInterval(beat, 4000);                 // heartbeat: ik ben online
    L.pruneTimer = setInterval(() => this._prunePeers(L), 3000);
    this._emitPeers(L);
    return true;
  },

  _emitPeers(L) {
    const list = [{ id: L.id, nick: L.nick, me: true, guest: !this.isLoggedIn() }];
    for (const pid in this.lobbyPeers) list.push({ id: pid, nick: this.lobbyPeers[pid].nick, me: false, guest: !!this.lobbyPeers[pid].guest });
    if (L.cbs.onPeers) L.cbs.onPeers(list);
  },
  _prunePeers(L) {
    const now = Date.now(); let changed = false;
    for (const pid in this.lobbyPeers) if (now - this.lobbyPeers[pid].t > 12000) { delete this.lobbyPeers[pid]; changed = true; }
    if (changed) this._emitPeers(L);
  },

  // naam/id van de presence bijwerken (bv. na inloggen) en meteen een heartbeat sturen
  lobbyRefreshNick() {
    const L = this.lobby; if (!L) return;
    const newId = this.lobbyMyId(), newNick = this.lobbyMyNick();
    if (L.id === newId && L.nick === newNick) return;
    if (L.id !== newId) { try { L.channel.send({ type: 'broadcast', event: 'lbye', payload: { id: L.id } }); } catch (e) {} }
    L.id = newId; L.nick = newNick;
    this.lobbySend('here', { id: L.id, nick: L.nick, g: this.isLoggedIn() ? 0 : 1 });
    this._emitPeers(L);   // eigen chip meteen bijwerken
  },

  lobbySend(event, payload) { if (this.lobby && this.lobby.channel) this.lobby.channel.send({ type: 'broadcast', event, payload }); },
  lobbyChat(text) { if (this.lobby) this.lobbySend('chat', { id: this.lobby.id, nick: this.lobby.nick, text: text }); },
  lobbyInvite(toId, code) { if (this.lobby) this.lobbySend('invite', { to: toId, from: this.lobby.nick, fromId: this.lobby.id, code: code }); },

  lobbyLeave() {
    if (this.lobby) {
      if (this.lobby.hbTimer) clearInterval(this.lobby.hbTimer);
      if (this.lobby.pruneTimer) clearInterval(this.lobby.pruneTimer);
      try { this.lobby.channel.send({ type: 'broadcast', event: 'lbye', payload: { id: this.lobby.id } }); } catch (e) {}
      try { this.sb.removeChannel(this.lobby.channel); } catch (e) {}
    }
    this.lobby = null; this.lobbyPeers = {};
  },

  leaveVersus() {
    if (this.versus) {
      if (this.versus.joinTimer) { clearInterval(this.versus.joinTimer); }
      if (this.versus.channel) {
        try { this.versus.channel.send({ type: 'broadcast', event: 'bye', payload: {} }); } catch (e) {}
        try { this.sb.removeChannel(this.versus.channel); } catch (e) {}
      }
    }
    this.versus = null;
  },
};
window.Net = Net;   // zodat de window.Net-checks in storage.js/ui.js werken
