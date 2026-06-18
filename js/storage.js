/* ============================================================
   STORAGE — bewaart voortgang in de browser (localStorage).
   ============================================================ */

const SAVE_KEY = 'zombiedash_save_v1';

const DEFAULT_SAVE = {
  coins: 0,
  ammo: 100,                // blijvende kogelvoorraad (carry-over tussen levels)
  rockets: 0,               // blijvende raket-voorraad (Rocket Launcher)
  ownedWeapons: ['bat'],
  equippedMelee: 'bat',     // apart slot voor melee
  equippedRanged: null,     // apart slot voor vuurwapen (null = geen)
  ownedCharacters: ['ryan'],
  equippedCharacter: 'ryan',
  // hoogst voltooide level per wereld: { "1": 0 } -> nog niets, level 1 speelbaar
  progress: { '1': 0 },
  arenaBest: 0,                 // hoogste ronde in Zombie Knock-out
  arenaPlays: { date: '', count: 0 }, // dagelijkse speel-limiet
};

const Storage = {
  data: null,

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      this.data = raw ? Object.assign({}, DEFAULT_SAVE, JSON.parse(raw)) : Object.assign({}, DEFAULT_SAVE);
      // zorg dat geneste objecten/arrays bestaan
      this.data.ownedWeapons = this.data.ownedWeapons || ['bat'];
      this.data.ownedCharacters = this.data.ownedCharacters || ['ryan'];
      this.data.progress = this.data.progress || { '1': 0 };
      if (typeof this.data.ammo !== 'number') this.data.ammo = STARTING_AMMO;
      if (typeof this.data.rockets !== 'number') this.data.rockets = 0;
      if (typeof this.data.arenaBest !== 'number') this.data.arenaBest = 0;
      if (!this.data.arenaPlays) this.data.arenaPlays = { date: '', count: 0 };
      // migratie van oude opslag (één slot -> twee slots)
      if (this.data.equippedMelee === undefined) this.data.equippedMelee = 'bat';
      if (this.data.equippedRanged === undefined) this.data.equippedRanged = null;
      if (this.data.equippedWeapon) {
        const w = WEAPONS[this.data.equippedWeapon];
        if (w && w.type === 'ranged') this.data.equippedRanged = this.data.equippedWeapon;
        else if (w) this.data.equippedMelee = this.data.equippedWeapon;
        delete this.data.equippedWeapon;
      }
    } catch (e) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
    return this.data;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {}
  },

  // voortgang herstellen via een URL-link, bv:
  //   ?restore=coins:5000,w1:10,w2:10,w3:0,weapons:all,chars:all,ammo:300
  // (werkt ook op iOS zonder console; neemt steeds de hoogste/meeste waarde)
  applyRestoreFromURL() {
    let q = '';
    try { q = (location.search || '').replace(/^\?/, ''); } catch (e) { return false; }
    if (!q) return false;
    let restore = '';
    q.split('&').forEach((kv) => {
      const i = kv.indexOf('=');
      const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      const v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1));
      if (k === 'restore') restore = v;
    });
    if (!restore) return false;
    // eenmalig per unieke link: voorkomt dat munten bij elke (koude) start "terugkomen"
    let already = '';
    try { already = localStorage.getItem('zombiedash_restored') || ''; } catch (e) {}
    if (already === restore) return false;
    let changed = false;
    restore.split(',').forEach((pair) => {
      const [key, valRaw] = pair.split(':');
      const val = valRaw || '';
      if (key === 'coins') { this.data.coins = Math.max(this.data.coins || 0, parseInt(val, 10) || 0); changed = true; }
      else if (key === 'ammo') { this.data.ammo = Math.max(this.data.ammo || 0, parseInt(val, 10) || 0); changed = true; }
      else if (key === 'rockets') { this.data.rockets = Math.max(this.data.rockets || 0, parseInt(val, 10) || 0); changed = true; }
      else if (/^w\d+$/.test(key)) { const w = key.slice(1); this.data.progress[w] = Math.max(this.data.progress[w] || 0, parseInt(val, 10) || 0); changed = true; }
      else if (key === 'weapons') { const ids = val === 'all' ? WEAPON_ORDER.slice() : val.split('|'); for (const id of ids) if (WEAPONS[id] && !this.data.ownedWeapons.includes(id)) this.data.ownedWeapons.push(id); changed = true; }
      else if (key === 'chars') { const ids = val === 'all' ? CHARACTER_ORDER.slice() : val.split('|'); for (const id of ids) if (CHARACTERS[id] && !this.data.ownedCharacters.includes(id)) this.data.ownedCharacters.push(id); changed = true; }
    });
    if (changed) {
      this.save();
      try { localStorage.setItem('zombiedash_restored', restore); } catch (e) {}
    }
    return changed;
  },

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.save();
  },

  // ---- munten ----
  addCoins(n) { this.data.coins += n; this.save(); },
  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n; this.save(); return true;
  },

  // ---- munitie (blijvende voorraad) ----
  setAmmo(n) { this.data.ammo = Math.max(0, Math.min(AMMO_MAX, Math.round(n))); this.save(); },
  buyAmmo() {
    if (this.data.ammo >= AMMO_MAX) return false;
    if (!this.spendCoins(AMMO_PACK.cost)) return false;
    this.data.ammo = Math.min(AMMO_MAX, this.data.ammo + AMMO_PACK.amount);
    this.save();
    return true;
  },
  // ---- raketten ----
  setRockets(n) { this.data.rockets = Math.max(0, Math.round(n)); this.save(); },
  buyRocket() {
    if (!this.spendCoins(ROCKET_COST)) return false;
    this.data.rockets++;
    this.save();
    return true;
  },

  // ---- wapens ----
  ownsWeapon(id) { return this.data.ownedWeapons.includes(id); },
  buyWeapon(id) {
    const w = WEAPONS[id];
    if (!w || this.ownsWeapon(id)) return false;
    if (!this.spendCoins(w.cost)) return false;
    this.data.ownedWeapons.push(id);
    this.save();
    return true;
  },
  // rust uit in het juiste slot (melee of ranged) op basis van het wapentype
  equipWeapon(id) {
    if (!this.ownsWeapon(id)) return false;
    const w = WEAPONS[id];
    if (w.type === 'ranged') this.data.equippedRanged = id;
    else this.data.equippedMelee = id;
    this.save();
    return true;
  },
  isEquipped(id) {
    const w = WEAPONS[id];
    return w && (w.type === 'ranged' ? this.data.equippedRanged === id : this.data.equippedMelee === id);
  },

  // ---- characters ----
  ownsCharacter(id) { return this.data.ownedCharacters.includes(id); },
  buyCharacter(id) {
    const c = CHARACTERS[id];
    if (!c || this.ownsCharacter(id)) return false;
    if (!this.spendCoins(c.cost)) return false;
    this.data.ownedCharacters.push(id);
    this.save();
    return true;
  },
  equipCharacter(id) {
    if (!this.ownsCharacter(id)) return false;
    this.data.equippedCharacter = id; this.save(); return true;
  },

  // ---- arena (Zombie Knock-out) ----
  todayStr() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return 'x'; } },
  arenaPlaysLeft() {
    const d = this.todayStr();
    if (this.data.arenaPlays.date !== d) return ARENA_PLAYS_PER_DAY;
    return Math.max(0, ARENA_PLAYS_PER_DAY - this.data.arenaPlays.count);
  },
  useArenaPlay() {
    const d = this.todayStr();
    if (this.data.arenaPlays.date !== d) this.data.arenaPlays = { date: d, count: 0 };
    this.data.arenaPlays.count++;
    this.save();
  },
  setArenaBest(round) {
    if (round > this.data.arenaBest) { this.data.arenaBest = round; this.save(); return true; }
    return false;
  },

  // ---- levels ----
  highestCleared(worldId) { return this.data.progress[String(worldId)] || 0; },
  isLevelUnlocked(worldId, levelId) { return levelId <= this.highestCleared(worldId) + 1; },
  clearLevel(worldId, levelId) {
    const key = String(worldId);
    if (levelId > (this.data.progress[key] || 0)) {
      this.data.progress[key] = levelId;
      this.save();
    }
  },
};
