/* ============================================================
   STORAGE — bewaart voortgang in de browser (localStorage).
   ============================================================ */

const SAVE_KEY = 'zombiedash_save_v1';

const DEFAULT_SAVE = {
  coins: 0,
  ammo: 100,                // blijvende kogelvoorraad (carry-over tussen levels)
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
