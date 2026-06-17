/* ============================================================
   CONFIG — wapens, levels, characters.
   Dit bestand pas je aan voor toekomstige updates:
   - nieuw wapen?  voeg toe aan WEAPONS
   - nieuwe wereld? voeg levels toe / maak WORLDS aan
   - nieuw character? voeg toe aan CHARACTERS
   ============================================================ */

const CONFIG = {
  // logische (interne) resolutie van de spelwereld; wordt opgeschaald -> pixel look
  // kleiner = meer ingezoomd (zombies komen sneller in beeld). 16:9.
  VIEW_W: 360,
  VIEW_H: 203,
  GROUND_Y: 173,        // y van de grond (voeten staan hier)
  GRAVITY: 0.6,
  JUMP_VELOCITY: -11,
};

/* ---------- WAPENS ----------
   type: 'melee' of 'ranged'
   damage: schade per hit
   cooldown: ms tussen aanvallen
   range: (melee) bereik in px
   bulletSpeed: (ranged) snelheid kogel
   pellets: aantal kogels per schot (uzi/shotgun gevoel)
   cost: prijs in munten (0 = gratis startwapen)
*/
const WEAPONS = {
  bat: {
    id: 'bat', name: 'Knuppel', type: 'melee',
    damage: 34, cooldown: 360, range: 30, cost: 0,
    desc: 'Je trouwe startwapen.'
  },
  machete: {
    id: 'machete', name: 'Machete', type: 'melee',
    damage: 58, cooldown: 300, range: 36, cost: 150,
    desc: 'Scherper en sneller dan de knuppel.'
  },
  pistol: {
    id: 'pistol', name: 'Pistol', type: 'ranged',
    damage: 42, cooldown: 380, range: 999, bulletSpeed: 7, pellets: 1, cost: 350,
    desc: 'Je eerste vuurwapen. Raak ze op afstand.'
  },
  uzi: {
    id: 'uzi', name: 'Uzi', type: 'ranged',
    damage: 22, cooldown: 110, range: 999, bulletSpeed: 8, pellets: 1, cost: 1400,
    desc: 'Bliksemsnel vuren. Maait hordes neer (slurpt kogels).'
  },
  ak47: {
    id: 'ak47', name: 'AK47', type: 'ranged',
    damage: 52, cooldown: 150, range: 999, bulletSpeed: 9, pellets: 1, cost: 3000,
    desc: 'Hoge schade én snel. De koning.'
  },
};

// volgorde in de shop
const WEAPON_ORDER = ['bat', 'machete', 'pistol', 'uzi', 'ak47'];

/* ---------- CHARACTERS ----------
   palette: kleuren voor de sprite-tekenaar
   maxHp: levens   speedMul: loopsnelheid (1 = normaal)   meleeMul: melee-schade
   build: 'normal' | 'bulky'   hair: 'natural' | 'curly'
*/
const CHARACTERS = {
  ryan: {
    id: 'ryan', name: 'Ryan', cost: 0,
    maxHp: 100, speedMul: 1.0, meleeMul: 1.0, build: 'normal', hair: 'natural',
    palette: {
      hair: '#5a3a22', hairDark: '#3f2817',
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#3a2414',                       // bruine ogen
      shirt: '#1c1c1c', shirtDark: '#0e0e0e',
      pants: '#161616', shoe: '#000000',
    },
    desc: 'Gebalanceerd. Snelste loper.'
  },
  jenze: {
    id: 'jenze', name: 'Jenze', cost: 450,
    maxHp: 140, speedMul: 0.9, meleeMul: 1.3, build: 'bulky', hair: 'curly',
    palette: {
      hair: '#6b4426', hairDark: '#4a2e18',  // bruine krullen
      skin: '#dcab7e', skinDark: '#bb8a5e',
      eye: '#2f6fb0',                         // blauwe ogen
      shirt: '#2a3340', shirtDark: '#1a2028', // stevige donkerblauwe outfit
      pants: '#20262e', shoe: '#101418',
    },
    desc: 'Fors & taai: +40 HP, +30% melee, iets trager.'
  },
};
const CHARACTER_ORDER = ['ryan', 'jenze'];

/* ---------- LEVELS (Wereld 1: Verlaten Stad) ----------
   length: lengte van het level in px (hoe ver lopen)
   zombieCount: totaal aantal zombies dat spawnt
   spawnEvery: ms tussen spawns
   zombieHp: basis-HP per zombie
   zombieSpeed: loopsnelheid zombies
   runnerChance: kans (0-1) op een snelle "runner" zombie
*/
/* ---------- ZOMBIE TYPES ----------
   hpMul/speedMul: vermenigvuldigers t.o.v. het level-basis
   dmg: schade per beet
   biteCd: ms tussen aanvallen
   reach: afstand waarop hij kan bijten
   lunge: 'true' = haalt uit en schiet vooruit om te bijten (bestraft stilstaan)
   scale: grootte (1 = normaal)
   coin: munten bij kill
*/
/* knockChance: kans dat een beet de speler terugslaat
   knockPlayer: hoeveel px de speler terugvliegt
   (brute: knockback:true = altijd terugslaan) */
/* healChance: kans dat deze zombie een EHBO-doosje dropt
   ammoDrop: aantal kogels in een doosje
   ammoDropChance: kans dat er überhaupt een doosje valt (lager = schaarser) */
const ZOMBIE_TYPES = {
  walker: {
    id: 'walker', hpMul: 1.0, speedMul: 1.0, dmg: 10, biteCd: 700,
    reach: 22, lunge: true, lungeSpeed: 3.2, scale: 1.0, coin: 6,
    ammoDrop: 5, ammoDropChance: 0.26, color: '#6a9c4a',
    knockChance: 0.28, knockPlayer: 8, healChance: 0.07,
  },
  runner: {
    id: 'runner', hpMul: 0.55, speedMul: 1.55, dmg: 8, biteCd: 520,
    reach: 20, lunge: true, lungeSpeed: 4.0, scale: 0.92, coin: 11,
    ammoDrop: 4, ammoDropChance: 0.20, color: '#8ab85a',
    knockChance: 0.18, knockPlayer: 6, healChance: 0.05,
  },
  crawler: {
    id: 'crawler', hpMul: 0.7, speedMul: 1.7, dmg: 9, biteCd: 560,
    reach: 22, lunge: true, lungeSpeed: 3.4, scale: 1.0, coin: 14,
    ammoDrop: 5, ammoDropChance: 0.24, jumps: true, low: true, color: '#7c8c3a',
    knockChance: 0.22, knockPlayer: 7, healChance: 0.07,
  },
  brute: {
    id: 'brute', hpMul: 3.0, speedMul: 0.5, dmg: 22, biteCd: 950,
    reach: 32, lunge: true, lungeSpeed: 2.6, scale: 1.55, coin: 28,
    ammoDrop: 14, ammoDropChance: 0.80, knockback: true, knockResist: 0.35, color: '#4e7c3a',
    knockPlayer: 14, healChance: 0.35,
  },
  // mega-zombie eindbaas (level 10). Roept kleine zombies op + spuugt projectielen.
  boss: {
    id: 'boss', hpMul: 1.0, speedMul: 0.32, dmg: 28, biteCd: 1200,
    reach: 16, lunge: true, lungeSpeed: 2.4, scale: 3.0, coin: 250,
    ammoDrop: 0, ammoDropChance: 0, knockback: true, knockResist: 0, // immuun voor knockback
    knockPlayer: 22, healChance: 0, spawner: true, color: '#3a6a2a',
    shootEvery: 1600, shotSpeed: 3.4, shotDmg: 14, // zuur-projectielen: spring eroverheen
  },
};

// munitie: beginvoorraad bij een nieuw spel (blijft daarna behouden tussen levels)
const STARTING_AMMO = 100;
// kogels bijkopen in de shop
const AMMO_PACK = { amount: 60, cost: 50 }; // 60 kogels voor 50 munten
const AMMO_MAX = 600;                        // maximale voorraad
// geen zombie wordt sneller dan dit — speler loopt 2.2, dus doorrennen blijft mogelijk
const MAX_ZOMBIE_SPEED = 2.0;
// EHBO-doosje geneest zo veel HP
const HEALTH_PACK_HEAL = 28;
// HP van de mega-zombie eindbaas
const BOSS_HP = 1000;

/* ---------- THEMA'S (omgeving per wereldstuk) ----------
   sky: [boven, midden, onder]  far/near: gebouwkleuren  ground/groundTop: straat
   lamp: lichtkleur  prop: accent  weer: 'rain' | 'fog' | null */
const THEMES = {
  city: {
    name: 'Verlaten Stad',
    sky: ['#1a2438', '#243049', '#3a3142'], far: ['#1e2636', '#222a3a', '#192030'],
    near: ['#2e3a4e', '#34405a', '#283448', '#3a4358'], ground: '#2c2620', groundTop: '#3a342c',
    lamp: '#ffe9a0', weather: null,
  },
  park: {
    name: 'Verwilderd Park',
    sky: ['#16302a', '#1f4038', '#34433a'], far: ['#1c2e22', '#21321f', '#19281a'],
    near: ['#26402c', '#2f4a30', '#28482a', '#244226'], ground: '#283318', groundTop: '#3a4a26',
    lamp: '#d6f0a0', weather: 'fog', tree: true,
  },
  graveyard: {
    name: 'Kerkhof',
    sky: ['#201828', '#2a1f38', '#3a2a42'], far: ['#241a2e', '#2a1f38', '#1f1828'],
    near: ['#332840', '#3a2f4a', '#2a2440', '#3e3358'], ground: '#241f2a', groundTop: '#322a38',
    lamp: '#c0a8ff', weather: 'fog', graves: true,
  },
  sewer: {
    name: 'Riool',
    sky: ['#0e1416', '#13201f', '#182826'], far: ['#142022', '#172a2c', '#101e20'],
    near: ['#1f3034', '#244044', '#1a2e30', '#284044'], ground: '#1a201f', groundTop: '#243030',
    lamp: '#7affd0', weather: 'rain',
  },
};

/* ---------- POWER-UPS ---------- */
const POWERUPS = {
  rage:  { id: 'rage',  name: 'RAGE',   dur: 8000, color: '#ff5a3a', icon: '⚔' },
  speed: { id: 'speed', name: 'SPEED',  dur: 8000, color: '#3ad0ff', icon: '⚡' },
  shield:{ id: 'shield',name: 'SCHILD', dur: 6000, color: '#f2c94c', icon: '🛡' },
};
const POWERUP_LIST = ['rage', 'speed', 'shield'];
const POWERUP_DROP_CHANCE = 0.025; // kans per kill

function buildWorld1() {
  const levels = [];
  const themeFor = (id) => id <= 3 ? 'city' : id <= 6 ? 'park' : id <= 9 ? 'graveyard' : 'sewer';
  // levels 1 t/m 9: oplopende moeilijkheid
  for (let i = 0; i < 9; i++) {
    const t = i / 8; // 0..1 moeilijkheid
    const id = i + 1;
    // afwisselende missietypes voor variatie
    let mode = 'reach';
    if (id === 3) mode = 'horde';        // overleef de horde
    else if (id === 7) mode = 'melee';   // wapens geblokkeerd, alleen melee
    const lvl = {
      id, name: 'Level ' + id, theme: themeFor(id), mode,
      hordeTime: 32000,                                  // alleen voor horde-modus
      length: Math.round(1400 + i * 230),               // 1400 -> 3240
      zombieCount: Math.round(6 + i * 2),               // 6 -> 22
      spawnEvery: Math.round(1850 - t * 720),           // 1850ms -> 1130ms
      zombieHp: Math.round(36 + i * 8),                 // 36 -> 100
      zombieSpeed: +(0.55 + t * 0.55).toFixed(2),       // 0.55 -> 1.10 (gecapt op MAX)
      runnerChance: i >= 2 ? +(0.05 + t * 0.22).toFixed(2) : 0,
      crawlerChance: i >= 3 ? +(0.05 + t * 0.18).toFixed(2) : 0,
      bruteChance: i >= 5 ? +(0.04 + t * 0.12).toFixed(2) : 0,
      doorChance: 0.40,
      obstacleDensity: 0.5 + t * 0.6,                   // hoe vol met obstakels (0.5 -> 1.1)
      healMult: 1,
      maxAlive: Math.round(7 + i * 1.1),                // max zombies tegelijk levend (7 -> 16)
      reward: 30 + i * 12,
    };
    // melee-only levels apart en eerlijker afstemmen (geen vuurwapen-vangnet)
    if (mode === 'melee') {
      lvl.length = 2100;          // korter
      lvl.zombieCount = 14;       // wat minder dan normaal
      lvl.zombieHp = 34;          // knuppel (34) velt walkers in 1 klap
      lvl.spawnEvery = 1800;      // ruimte tussen spawns
      lvl.zombieSpeed = 0.82;     // iets trager
      lvl.runnerChance = 0.12;
      lvl.crawlerChance = 0.05;   // crawlers zijn lastig te meleeën
      lvl.bruteChance = 0;        // GEEN brutes (oneerlijk zonder gun)
      lvl.obstacleDensity = 0.4;  // minder obstakels in de weg
      lvl.healMult = 2.6;         // veel meer EHBO-doosjes
      lvl.maxAlive = 5;           // weinig tegelijk (geen vuurwapen)
      lvl.reward = 120;           // mooie beloning voor de uitdaging
    }
    levels.push(lvl);
  }
  // level 10: BOSS-arena (geen normale spawns; baas roept zelf adds op)
  levels.push({
    id: 10, name: 'BOSS', theme: 'sewer', mode: 'boss', isBoss: true,
    length: 1500, zombieCount: 0, spawnEvery: 999999,
    zombieHp: 55, zombieSpeed: 1.0,
    runnerChance: 0.45, crawlerChance: 0, bruteChance: 0,
    doorChance: 0, obstacleDensity: 0.4, maxAlive: 8, reward: 300,
  });
  return levels;
}

const WORLDS = [
  { id: 1, name: 'Verlaten Stad', levels: buildWorld1() },
];
