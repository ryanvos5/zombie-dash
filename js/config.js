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
  rocket: {
    id: 'rocket', name: 'Rocket Launcher', type: 'ranged', ammoType: 'rocket',
    damage: 130, cooldown: 950, range: 999, bulletSpeed: 6, pellets: 1, cost: 15000,
    desc: 'Explosieve raketten (AoE). Heeft losse raketten nodig — schaars!'
  },
  // intern melee-wapen van Tygo (niet in de shop)
  shield: {
    id: 'shield', name: 'Schild', type: 'melee',
    damage: 34, cooldown: 360, range: 30, cost: 0,
    desc: 'Schildbash + blok.'
  },
};

// volgorde in de shop
const WEAPON_ORDER = ['bat', 'machete', 'pistol', 'uzi', 'ak47', 'rocket'];
// raketten: prijs per stuk in de shop + zeldzame drop-kans (alleen als je de RPG hebt)
const ROCKET_COST = 250;
const ROCKET_DROP_CHANCE = 0.02;   // ~2% per kill -> soms 0 in een heel level
const ROCKET_AOE = 56;             // straal van de explosie

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
  tygo: {
    id: 'tygo', name: 'Tygo', cost: 700,
    maxHp: 110, speedMul: 1.0, meleeMul: 1.0, build: 'tall', hair: 'natural',
    forcedMelee: 'shield', shieldBlock: true,
    palette: {
      hair: '#a8824a', hairDark: '#7a5e30',  // blond-bruin
      skin: '#dcb088', skinDark: '#b88f64',
      eye: '#3a2414',                          // bruine ogen
      shirt: '#3a5048', shirtDark: '#26352f',  // groen-grijze tuniek
      pants: '#2a2622', shoe: '#161210',
    },
    desc: 'Lang & taai (+10 HP). Meleeknop = schildbash + blok (3s cooldown). Alleen het schild als melee.'
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
const CHARACTER_ORDER = ['ryan', 'jenze', 'tygo'];
const SHIELD_BLOCK_CD = 3000;   // ms cooldown nadat Tygo's schild een treffer blokt

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
  // gemuteerde zombie-vogel (wereld 2): vliegt, dook naar de speler
  flyer: {
    id: 'flyer', hpMul: 0.5, speedMul: 1.25, dmg: 9, biteCd: 800,
    reach: 18, lunge: false, scale: 1.0, coin: 13, ammoDrop: 5, ammoDropChance: 0.45,
    flying: true, color: '#6a8c4a', knockChance: 0.12, knockPlayer: 5, healChance: 0.06,
  },
  // eindbaas wereld 2: zombie in een luchtballon (zweeft, gooit bommen, roept vogels op)
  balloon: {
    id: 'balloon', hpMul: 1.0, speedMul: 0.45, dmg: 22, biteCd: 1400,
    reach: 22, lunge: false, scale: 1.0, coin: 350, ammoDrop: 0, ammoDropChance: 0,
    flying: true, boss: true, knockback: true, knockResist: 0,
    spawner: true, shootEvery: 1700, shotSpeed: 3.2, shotDmg: 16, color: '#3a6a2a',
  },
  // eindbaas wereld 3: mega zombie-aap die in één sprong naar de speler toe duikt
  ape: {
    id: 'ape', hpMul: 1.0, speedMul: 0.5, dmg: 30, biteCd: 900,
    reach: 30, lunge: false, apeLeap: true, scale: 2.8, coin: 450,
    ammoDrop: 0, ammoDropChance: 0, knockback: true, knockResist: 0,
    healChance: 0, color: '#3a5a2a',
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
// HP van de ballon-eindbaas (wereld 2)
const BALLOON_HP = 900;
// HP van de mega zombie-aap (wereld 3)
const APE_HP = 1200;
// vanaf deze wereld kun je dubbel springen
const DOUBLE_JUMP_FROM_WORLD = 2;
// onder deze y val je in het ravijn (instant dood) — alleen in parkour-levels
const FALL_DEATH_Y = CONFIG.VIEW_H - 2;

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
  mountain: {
    name: 'De Bergen',
    sky: ['#2a3e5e', '#456589', '#7fa0bd'],            // berglucht (ochtendgloren)
    far: ['#3c5070', '#34465f', '#46607f'],            // verre toppen
    near: ['#4a627e', '#3e5169', '#56708c', '#48607a'],// dichtere bergen
    ground: '#2a3850', groundTop: '#3a4e68',
    lamp: '#ffe6a0', weather: null, mountains: true,
  },
  arena: {
    name: 'Arena',
    sky: ['#10121a', '#181b26', '#222636'],
    far: ['#1c1f2a'], near: ['#2a2e3c'],
    ground: '#241f18', groundTop: '#3a3022',
    lamp: '#ffd24a', weather: null, isArena: true,
  },
  jungle: {
    name: 'Jungle',
    sky: ['#16331f', '#1f472a', '#315a39'],             // dampig groen oerwoud
    far: ['#173a22', '#1e482a', '#143420'],             // verre boomsilhouetten
    near: ['#21512c', '#2a6234', '#255a2e', '#1d4a26'], // dichte begroeiing
    ground: '#21341a', groundTop: '#3a5223',
    lamp: '#c6ec9a', weather: 'fog', jungle: true,
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
      killAll: (mode === 'reach' || mode === 'melee'), // eerst alle zombies doden, dan de finish
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
      maxAlive: Math.round(4 + i * 0.7),                // max zombies tegelijk levend (4 -> 10) — waves, niet overspoeld
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
    // checkpoint halverwege: haal 'm binnen de tijd, anders game over (dwingt doorlopen)
    if (lvl.killAll) lvl.midTime = Math.round(lvl.length * 9 + 3000);
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

/* ---------- WERELD 2: DE BERGEN (parkour) ----------
   parkour: true  -> platforms in de lucht, val = dood (ravijn), dubbel-jump aan
   flyerOnly: true -> alleen vliegende zombie-vogels (af en toe)
   gap/platW/yRange sturen de platform-generator in game.buildPlatforms() */
function buildWorld2() {
  const levels = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    levels.push({
      id: i + 1, name: 'Berg ' + (i + 1), theme: 'mountain', mode: 'reach',
      parkour: true, flyerOnly: true,
      length: Math.round(1500 + i * 220),               // 1500 -> 3260
      zombieCount: 999,                                  // doorlopend (vogels)
      spawnEvery: Math.round(3000 - t * 1100),          // 3000ms -> 1900ms (af en toe)
      zombieHp: Math.round(28 + i * 6),                 // 28 -> 76 (vogels zijn broos)
      zombieSpeed: +(0.8 + t * 0.5).toFixed(2),
      maxAlive: 2 + Math.floor(i / 3),                  // 2 -> 4 vogels tegelijk (niet te veel)
      // gaten: 66 -> 114. Enkele sprong haalt ~81, dus de grotere gaten VEREISEN dubbel-jump
      gapMin: 44 + i * 3, gapMax: 66 + i * 6,
      platMin: 48 - i, platMax: 74 - i,                 // smallere platforms (preciezer landen)
      yJump: 18 + i * 3,                                // groter hoogteverschil (18 -> 42)
      reward: 60 + i * 16,                              // munten bij het halen (60 -> 188)
    });
  }
  // level 10: BALLON-BOSS (parkour-arena, baas zweeft in een luchtballon)
  levels.push({
    id: 10, name: 'BALLON BOSS', theme: 'mountain', mode: 'boss', isBoss: true,
    parkour: true, balloonBoss: true,
    length: 1300, zombieCount: 0, spawnEvery: 999999,
    zombieHp: 34, zombieSpeed: 1.1, maxAlive: 4,
    gapMin: 40, gapMax: 60, platMin: 70, platMax: 100, yJump: 18,
    reward: 400,
  });
  return levels;
}

/* ---------- WERELD 3: JUNGLE ----------
   Normale gevechtslevels (vaste grond, veel zombies, af en toe een vogel) afgewisseld
   met een paar ECHTE parkour-levels (ravijn + platforms, zoals wereld 2) in jungle-stijl.
   Boss = mega zombie-aap (springt in één keer naar je toe). */
function buildWorld3() {
  const levels = [];
  const PARKOUR_LEVELS = [3, 6, 9];   // deze levels zijn pure parkour (jungle, zoals wereld 2)
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const id = i + 1;
    if (PARKOUR_LEVELS.includes(id)) {
      // ---- pure parkour-level (jungle-stijl): ravijn + zwevende platforms + vogels ----
      levels.push({
        id, name: 'Jungle ' + id, theme: 'jungle', mode: 'reach',
        parkour: true, flyerOnly: true,
        length: Math.round(1700 + i * 220),               // 1700 -> 3460
        zombieCount: 999,                                  // doorlopend (vogels)
        spawnEvery: Math.round(2700 - t * 1000),
        zombieHp: Math.round(30 + i * 6),
        zombieSpeed: +(0.85 + t * 0.5).toFixed(2),
        maxAlive: 2 + Math.floor(i / 3),
        gapMin: 46 + i * 3, gapMax: 72 + i * 6,            // gaten in het ravijn
        platMin: 50 - i, platMax: 76 - i,
        yJump: 18 + i * 3,
        reward: 130 + i * 18,
      });
    } else {
      // ---- normaal jungle-gevechtslevel: vaste grond, veel zombies ----
      const length = Math.round(2600 + i * 300);          // 2600 -> 5000
      levels.push({
        id, name: 'Jungle ' + id, theme: 'jungle', mode: 'reach',
        killAll: true, noObstacles: true,                 // geen straat-obstakels in de jungle
        flyerChance: +(0.12 + t * 0.10).toFixed(2),        // af en toe een vogel (gewone schade)
        length,
        zombieCount: Math.round(26 + i * 6),               // 26 -> 74 (veel zombies)
        spawnEvery: Math.round(1300 - t * 600),            // 1300 -> 700 (sneller)
        zombieHp: Math.round(48 + i * 9),                  // 48 -> 120
        zombieSpeed: +(0.7 + t * 0.5).toFixed(2),
        runnerChance: +(0.10 + t * 0.22).toFixed(2),
        crawlerChance: +(0.06 + t * 0.18).toFixed(2),
        bruteChance: i >= 3 ? +(0.05 + t * 0.12).toFixed(2) : 0,
        doorChance: 0,
        maxAlive: Math.round(7 + i * 1.1),                 // 7 -> 16 tegelijk (drukker)
        reward: 90 + i * 18,
        midTime: Math.round(length * 11 + 5000),           // royale checkpoint-tijd
      });
    }
  }
  // level 10: MEGA ZOMBIE-AAP (springt in één keer naar je toe)
  levels.push({
    id: 10, name: 'AAP BOSS', theme: 'jungle', mode: 'boss', isBoss: true, apeBoss: true,
    length: 1600, zombieCount: 0, spawnEvery: 999999,
    zombieHp: 60, zombieSpeed: 1.1, maxAlive: 4,
    doorChance: 0, noObstacles: true, reward: 600,
  });
  return levels;
}

const WORLDS = [
  { id: 1, name: 'Verlaten Stad', levels: buildWorld1() },
  { id: 2, name: 'De Bergen', levels: buildWorld2() },
  { id: 3, name: 'Jungle', levels: buildWorld3() },
];

/* ---------- ZOMBIE KNOCK-OUT (arena wave-survival) ---------- */
const ARENA_PLAYS_PER_DAY = 3;   // max keer per dag
const ARENA_START_AMMO = 150;    // startmunitie per potje (los van je voorraad)
const ARENA_COIN_MULT = 0.3;     // munten per kill in de arena (lager dan verhaalmodus)
// het "level"-object voor de arena (bounded, geen finish/checkpoint)
const ARENA_LEVEL = {
  id: 0, name: 'Arena', theme: 'arena', mode: 'arena', arena: true,
  length: 600, doorChance: 0, obstacleDensity: 0,
};
// per-ronde-instellingen (elke ronde zwaarder)
function arenaRound(round) {
  const t = round - 1;
  return {
    target: 4 + Math.round(t * 1.5),                          // te doden zombies deze ronde
    zombieHp: 28 + t * 9,
    zombieSpeed: +Math.min(MAX_ZOMBIE_SPEED, 0.7 + t * 0.05).toFixed(2),
    runnerChance: round >= 2 ? Math.min(0.4, 0.08 + t * 0.04) : 0,
    crawlerChance: round >= 4 ? Math.min(0.35, 0.05 + t * 0.03) : 0,
    bruteChance: round >= 6 ? Math.min(0.28, 0.03 + t * 0.025) : 0,
    maxAlive: Math.min(11, 3 + Math.floor(t * 0.7)),
    spawnEvery: Math.max(450, 1300 - t * 70),
    bonus: 5 + round * 3,                                     // munten per voltooide ronde (bescheiden)
  };
}
