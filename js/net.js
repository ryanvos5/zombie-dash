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
      this._refreshUI();
    });
    this.sb.auth.onAuthStateChange((_evt, session) => {
      this.user = session ? session.user : null;
      this._refreshUI();
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
  },

  async ensureProfile() {
    if (!this.user) return;
    const nick = (this.user.user_metadata && this.user.user_metadata.nickname) || null;
    try {
      await this.sb.from('game_profiles').upsert(
        { id: this.user.id, nickname: nick, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    } catch (e) { console.warn('[Net] ensureProfile', e); }
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
        .update({ save_data: Storage.data, updated_at: new Date().toISOString() })
        .eq('id', this.user.id);
    } catch (e) { console.warn('[Net] pushCloudSave', e); }
  },

  _refreshUI() { if (window.UI && UI.refreshAuthUI) UI.refreshAuthUI(); },
};
window.Net = Net;   // zodat de window.Net-checks in storage.js/ui.js werken
