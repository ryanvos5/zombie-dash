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
  ownedHats: ['none'],
  equippedHat: 'none',
  // hoogst voltooide level per wereld: { "1": 0 } -> nog niets, level 1 speelbaar
  progress: { '1': 0 },
  arenaBest: 0,                 // hoogste ronde in Zombie Knock-out (oude mode)
  arenaPlays: { date: '', count: 0 }, // dagelijkse speel-limiet
  journey1: 0,                  // hoogst gehaalde Journey-level in wereld 1 (0 = nog niets)
  powerups: {},                 // gekochte power-ups in de inventaris: { id: aantal }
  loadout: [],                  // max 3 power-up-ids die je meeneemt in een match
  chests: [],                   // kist-slots (max 3): { r: rarity, u: unlockAt(ms) 0=nog niet begonnen }
  xp: 0,                        // ervaring uit multiplayer-duels (level = playerLevel(xp))
  level: 1,                     // laatst-uitgekeerde level (voor de level-up-popup + beloning)
  mpWins: 0,                    // gewonnen 1v1-duels
  mpLosses: 0,                  // verloren 1v1-duels
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
      this.data.ownedHats = this.data.ownedHats || ['none'];
      if (!this.data.ownedHats.includes('none')) this.data.ownedHats.unshift('none');
      if (!this.data.equippedHat) this.data.equippedHat = 'none';
      this.data.progress = this.data.progress || { '1': 0 };
      if (typeof this.data.ammo !== 'number') this.data.ammo = STARTING_AMMO;
      if (typeof this.data.rockets !== 'number') this.data.rockets = 0;
      if (typeof this.data.arenaBest !== 'number') this.data.arenaBest = 0;
      if (typeof this.data.journey1 !== 'number') this.data.journey1 = 0;
      if (!this.data.powerups || typeof this.data.powerups !== 'object') this.data.powerups = {};
      if (!Array.isArray(this.data.loadout)) this.data.loadout = [];
      if (!Array.isArray(this.data.chests)) this.data.chests = [];
      if (typeof this.data.xp !== 'number') this.data.xp = 0;
      if (typeof this.data.level !== 'number') this.data.level = (typeof playerLevel === 'function') ? playerLevel(this.data.xp || 0) : 1;
      if (typeof this.data.mpWins !== 'number') this.data.mpWins = 0;
      if (typeof this.data.mpLosses !== 'number') this.data.mpLosses = 0;
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
    try { if (window.Net && Net.queueCloudSave) Net.queueCloudSave(); } catch (e) {}
  },

  // cloud-save samenvoegen met de lokale stand: neem overal het BESTE,
  // zodat je op geen enkel toestel voortgang verliest bij het inloggen.
  mergeCloud(cloud) {
    if (!cloud) return;
    const d = this.data;
    d.coins = Math.max(d.coins || 0, cloud.coins || 0);
    d.ammo = Math.max(d.ammo || 0, cloud.ammo || 0);
    d.rockets = Math.max(d.rockets || 0, cloud.rockets || 0);
    d.arenaBest = Math.max(d.arenaBest || 0, cloud.arenaBest || 0);
    d.journey1 = Math.max(d.journey1 || 0, cloud.journey1 || 0);
    d.xp = Math.max(d.xp || 0, cloud.xp || 0);
    d.level = Math.max(d.level || 0, cloud.level || 0);   // al-uitgekeerde levels niet dubbel belonen
    // power-ups: neem per soort het hoogste aantal (anti-verlies); loadout: houd de lokale keuze
    d.powerups = d.powerups || {};
    const cpu = cloud.powerups || {};
    for (const k of Object.keys(cpu)) d.powerups[k] = Math.max(d.powerups[k] || 0, cpu[k] || 0);
    if ((!d.loadout || !d.loadout.length) && Array.isArray(cloud.loadout)) d.loadout = cloud.loadout.slice(0, 3);
    // kisten: neem de rij met de meeste kisten (anti-verlies)
    if (Array.isArray(cloud.chests) && cloud.chests.length > (d.chests || []).length) d.chests = cloud.chests;
    d.mpWins = Math.max(d.mpWins || 0, cloud.mpWins || 0);
    d.mpLosses = Math.max(d.mpLosses || 0, cloud.mpLosses || 0);
    for (const w of (cloud.ownedWeapons || [])) if (!d.ownedWeapons.includes(w)) d.ownedWeapons.push(w);
    for (const c of (cloud.ownedCharacters || [])) if (!d.ownedCharacters.includes(c)) d.ownedCharacters.push(c);
    for (const h of (cloud.ownedHats || [])) if (!(d.ownedHats || (d.ownedHats = ['none'])).includes(h)) d.ownedHats.push(h);
    if (cloud.equippedHat && (!d.equippedHat || d.equippedHat === 'none')) d.equippedHat = cloud.equippedHat;
    const cp = cloud.progress || {};
    for (const k of Object.keys(cp)) d.progress[k] = Math.max(d.progress[k] || 0, cp[k] || 0);
    this.save();
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
      else if (key === 'hats') { const ids = val === 'all' ? HAT_ORDER.slice() : val.split('|'); this.data.ownedHats = this.data.ownedHats || ['none']; for (const id of ids) if (HATS[id] && !this.data.ownedHats.includes(id)) this.data.ownedHats.push(id); changed = true; }
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
    if (c.journeyOnly) return false;                                   // alleen via Journey vrij te spelen
    if (playerLevel(this.data.xp || 0) < (c.lvl || 0)) return false;   // nog niet vrijgespeeld
    if (!this.spendCoins(c.cost)) return false;
    this.data.ownedCharacters.push(id);
    this.save();
    return true;
  },
  equipCharacter(id) {
    if (!this.ownsCharacter(id)) return false;
    this.data.equippedCharacter = id; this.save(); return true;
  },

  // ---- hoeden (cosmetisch) ----
  ownsHat(id) { return id === 'none' || (this.data.ownedHats || []).includes(id); },
  buyHat(id) {
    const h = HATS[id];
    if (!h || this.ownsHat(id)) return false;
    if (h.journeyOnly) return false;                                   // alleen via Journey vrij te spelen
    if (playerLevel(this.data.xp || 0) < (h.lvl || 0)) return false;   // nog niet vrijgespeeld
    if (!this.spendCoins(h.cost)) return false;
    this.data.ownedHats.push(id);
    this.save();
    return true;
  },
  equipHat(id) {
    if (!this.ownsHat(id)) return false;
    this.data.equippedHat = id; this.save(); return true;
  },

  // ---- level-up: keert 300 munten per nieuw level uit; geeft info terug voor de popup ----
  claimLevelUps() {
    const cur = (typeof playerLevel === 'function') ? playerLevel(this.data.xp || 0) : 1;
    if (typeof this.data.level !== 'number') { this.data.level = cur; this.save(); return null; }
    if (cur > this.data.level) {
      const levels = cur - this.data.level, coins = levels * 300;
      this.data.coins = (this.data.coins || 0) + coins;
      this.data.level = cur;
      this.save();
      return { level: cur, levels, coins };
    }
    return null;
  },

  // ---- power-ups (inventaris + loadout) ----
  powerupCount(id) { return (this.data.powerups && this.data.powerups[id]) || 0; },
  buyPowerup(id) {
    const pu = SHOP_POWERUPS[id]; if (!pu) return false;
    if (!this.spendCoins(pu.cost)) return false;
    this.data.powerups = this.data.powerups || {};
    this.data.powerups[id] = (this.data.powerups[id] || 0) + 1;
    this.save(); return true;
  },
  // 1 exemplaar verbruiken (bij activeren in een match); geeft true als het lukte
  usePowerup(id) {
    if (this.powerupCount(id) <= 0) return false;
    this.data.powerups[id]--;
    if (this.data.powerups[id] <= 0) delete this.data.powerups[id];
    this.save(); return true;
  },
  // loadout (max 3): een power-up aan/uit zetten voor de volgende match
  loadout() { return (this.data.loadout || []).filter((id) => SHOP_POWERUPS[id]); },
  inLoadout(id) { return (this.data.loadout || []).includes(id); },
  toggleLoadout(id) {
    if (!SHOP_POWERUPS[id]) return false;
    this.data.loadout = this.data.loadout || [];
    const i = this.data.loadout.indexOf(id);
    if (i >= 0) this.data.loadout.splice(i, 1);
    else { if (this.data.loadout.length >= 3) return false; this.data.loadout.push(id); }
    this.save(); return true;
  },

  // ---- kisten (loot uit online matches) ----
  now() { try { return Date.now(); } catch (e) { return 0; } },
  chests() { return this.data.chests || (this.data.chests = []); },
  canReceiveChest() { return this.chests().length < CHEST_SLOTS; },
  addChest(rarity) {
    if (!CHEST_TYPES[rarity] || !this.canReceiveChest()) return false;
    this.chests().push({ r: rarity, u: 0 }); this.save(); return true;
  },
  startChest(i) {
    const c = this.chests()[i]; if (!c || c.u > 0) return false;
    c.u = this.now() + CHEST_TYPES[c.r].dur; this.save(); return true;
  },
  chestSecondsLeft(i) {
    const c = this.chests()[i]; if (!c || c.u <= 0) return -1;      // -1 = nog niet gestart
    return Math.max(0, Math.ceil((c.u - this.now()) / 1000));
  },
  chestReady(i) { const c = this.chests()[i]; return !!(c && c.u > 0 && this.now() >= c.u); },
  // kans op een kist na een online match (win = grotere kans); geeft de rarity terug of null
  rollChestDrop(won) {
    if (!this.canReceiveChest()) return null;
    if (Math.random() >= (won ? CHEST_WIN_CHANCE : CHEST_LOSS_CHANCE)) return null;
    let tot = 0; for (const k of CHEST_ORDER) tot += CHEST_RARITY_WEIGHTS[k];
    let r = Math.random() * tot, rarity = 'common';
    for (const k of CHEST_ORDER) { r -= CHEST_RARITY_WEIGHTS[k]; if (r <= 0) { rarity = k; break; } }
    this.addChest(rarity);
    return rarity;
  },
  // beloningen bepalen voor een kist-rarity
  rollChestRewards(rarity) {
    const t = CHEST_TYPES[rarity] || CHEST_TYPES.common;
    const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const wpick = (pairs) => { let tot = 0; for (const p of pairs) tot += p[1]; let r = Math.random() * tot; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[0][0]; };
    const gold = ri(t.gold[0], t.gold[1]), xp = ri(t.xp[0], t.xp[1]);
    const pus = {}; const add = (id) => { pus[id] = (pus[id] || 0) + 1; };
    const simple = ['heal', 'shield', 'speed', 'rage'];
    if (rarity === 'common') { if (Math.random() < 0.45) add(pick(simple)); }
    else if (rarity === 'rare') { if (Math.random() < 0.75) add(pick(simple)); if (Math.random() < 0.30) add(pick(simple)); }
    else if (rarity === 'epic') {
      const pool = [['heal', 5], ['shield', 5], ['speed', 5], ['rage', 5],
        ['fireball', 3], ['beachball', 3], ['coco', 3], ['boom', 3], ['dart', 3], ['cannon', 2.5],
        ['ak47', 2], ['rocket', 1.3]];
      const n = ri(2, 4); for (let i = 0; i < n; i++) add(wpick(pool));
    } else {   // legendary: ALLE power-ups uit het spel, de goede zeldzamer
      const pool = [['heal', 6], ['shield', 6], ['speed', 6], ['rage', 6],
        ['fireball', 3], ['beachball', 3], ['coco', 3], ['boom', 3], ['dart', 3], ['cannon', 2.6],
        ['ak47', 2.2], ['rocket', 1.6], ['giant', 1.4], ['dragon', 1], ['rock', 1.4], ['lightning', 1.2]];
      const n = ri(5, 8); for (let i = 0; i < n; i++) add(wpick(pool));
    }
    return { rarity, gold, xp, pus };
  },
  // een klaar-staande kist ophalen -> beloning toepassen + slot vrijmaken
  collectChest(i) {
    if (!this.chestReady(i)) return null;
    const c = this.chests()[i];
    const rw = this.rollChestRewards(c.r);
    this.data.coins = (this.data.coins || 0) + rw.gold;
    this.data.xp = (this.data.xp || 0) + rw.xp;
    this.data.powerups = this.data.powerups || {};
    for (const id in rw.pus) this.data.powerups[id] = (this.data.powerups[id] || 0) + rw.pus[id];
    this.chests().splice(i, 1);
    this.save();
    return rw;
  },

  // ---- Journey (singleplayer) ----
  journeyCleared(level) { return (this.data.journey1 || 0) >= level; },                  // wereld 1
  journeyUnlocked(level) { return level <= (this.data.journey1 || 0) + 1; },             // volgende is speelbaar
  // markeer een level als gehaald + ken de unlocks toe; geeft een lijst met nieuwe items terug
  clearJourneyLevel(level) {
    const got = [];
    if (level > (this.data.journey1 || 0)) this.data.journey1 = level;
    const unl = (JOURNEY[1] && JOURNEY[1].unlocks && JOURNEY[1].unlocks[level]) || null;
    if (unl) {
      if (unl.char && !this.ownsCharacter(unl.char)) { this.data.ownedCharacters.push(unl.char); got.push({ type: 'char', id: unl.char, name: (CHARACTERS[unl.char] || {}).name }); }
      if (unl.hat && !this.ownsHat(unl.hat)) { (this.data.ownedHats = this.data.ownedHats || ['none']).push(unl.hat); got.push({ type: 'hat', id: unl.hat, name: (HATS[unl.hat] || {}).name }); }
    }
    this.save();
    return got;
  },

  // ---- arena (Zombie Knock-out, oude mode) ----
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
