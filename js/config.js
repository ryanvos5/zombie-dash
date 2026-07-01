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
    id: 'bat', name: 'Bat', type: 'melee',
    damage: 34, cooldown: 360, range: 30, cost: 0,
    desc: 'Je trouwe startwapen.'
  },
  club: {
    id: 'club', name: 'Club', type: 'melee',
    damage: 40, cooldown: 400, range: 28, knock: 14, cost: 120,
    desc: 'Goedkoop en hard: flinke terugslag.'
  },
  machete: {
    id: 'machete', name: 'Machete', type: 'melee',
    damage: 58, cooldown: 300, range: 36, cost: 150,
    desc: 'Scherper en sneller dan de bat.'
  },
  sword: {
    id: 'sword', name: 'Sword', type: 'melee',
    damage: 46, cooldown: 330, range: 34, knock: 9, cost: 250,
    desc: 'Gebalanceerd: degelijke schade én snelheid.'
  },
  dagger: {
    id: 'dagger', name: 'Dagger', type: 'melee',
    damage: 24, cooldown: 150, range: 24, knock: 4, cost: 350,
    desc: 'Razendsnel, maar kort bereik en weinig schade.'
  },
  axe: {
    id: 'axe', name: 'Axe', type: 'melee',
    damage: 74, cooldown: 520, range: 32, knock: 16, cost: 700,
    desc: 'Zware klap met grote terugslag — maar traag.'
  },
  spear: {
    id: 'spear', name: 'Spear', type: 'melee',
    damage: 48, cooldown: 420, range: 56, knock: 8, cost: 900,
    desc: 'Lang bereik — raak vijanden van veraf.'
  },
  mace: {
    id: 'mace', name: 'Mace', type: 'melee',
    damage: 66, cooldown: 480, range: 30, knock: 20, cost: 1100,
    desc: 'Beukt vijanden ver weg (enorme knockback).'
  },
  flail: {
    id: 'flail', name: 'Flail', type: 'melee',
    damage: 58, cooldown: 430, range: 36, knock: 12, arc: true, cost: 1500,
    desc: 'Zwiept in een boog — raakt vijanden aan béide kanten.'
  },
  bostaff: {
    id: 'bostaff', name: 'Bo Staff', type: 'melee',
    damage: 34, cooldown: 200, range: 44, knock: 13, arc: true, cost: 1800,
    desc: 'Snelle, brede vegen die hordes om je heen wegduwen.'
  },
  katana: {
    id: 'katana', name: 'Katana', type: 'melee',
    damage: 70, cooldown: 300, range: 36, knock: 9, cost: 2200,
    desc: 'Vlijmscherp: hoge schade én snel.'
  },
  halberd: {
    id: 'halberd', name: 'Halberd', type: 'melee',
    damage: 82, cooldown: 560, range: 54, knock: 14, cost: 3200,
    desc: 'Lang bereik én zware schade, maar traag.'
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
    id: 'shield', name: 'Shield', type: 'melee',
    damage: 34, cooldown: 360, range: 30, cost: 0,
    desc: 'Shield bash + block.'
  },
};

// volgorde in de shop: eerst alle melee (oplopend in prijs), dan de vuurwapens
const WEAPON_ORDER = [
  'bat', 'club', 'machete', 'sword', 'dagger', 'axe', 'spear', 'mace', 'flail', 'bostaff', 'katana', 'halberd',
  'pistol', 'uzi', 'ak47', 'rocket',
];
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
    id: 'tygo', name: 'Tygo', cost: 2100, lvl: 10,
    maxHp: 110, speedMul: 1.0, meleeMul: 1.0, build: 'tall', hair: 'natural',
    dblJumpMul: 1.22,                          // iets hogere/langere dubbel-jump
    palette: {
      hair: '#a8824a', hairDark: '#7a5e30',  // blond-bruin
      skin: '#dcb088', skinDark: '#b88f64',
      eye: '#3a2414',                          // bruine ogen
      shirt: '#3a5048', shirtDark: '#26352f',  // groen-grijze tuniek
      pants: '#2a2622', shoe: '#161210',
    },
    desc: 'Lang & taai (+10 HP). Hogere dubbel-jump. Gebruikt elk melee-wapen.'
  },
  just: {
    id: 'just', name: 'Just', cost: 2400, lvl: 12,
    maxHp: 130, speedMul: 0.8, meleeMul: 1.2, build: 'stocky', hair: 'bald',
    groundPound: true,
    palette: {
      hair: '#c8a85a', hairDark: '#9a7e3a',     // klein beetje blond haar
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#2f6fb0',                            // blauwe ogen
      shirt: '#5a4030', shirtDark: '#3a2820',
      pants: '#2a2622', shoe: '#161210',
    },
    desc: 'Dik & klein, traag maar sterk (+30 HP, +20% melee). Stamp bij de landing schade in de buurt.'
  },
  timo: {
    id: 'timo', name: 'Timo', cost: 2700, lvl: 4,
    maxHp: 90, speedMul: 1.05, meleeMul: 1.0, build: 'small', hair: 'natural',
    extraJump: true,
    palette: {
      hair: '#a8824a', hairDark: '#7a5e30',     // blond-bruin, natural
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#3a2414',                            // bruine ogen
      shirt: '#2e6f8a', shirtDark: '#1d4a5e',
      pants: '#26303a', shoe: '#10161c',
    },
    desc: 'Klein & wendbaar (kleine hitbox). Heeft een extra (kleinere) dubbel-jump.'
  },
  vince: {
    id: 'vince', name: 'Vince', cost: 2550, lvl: 8,
    maxHp: 100, speedMul: 1.0, meleeMul: 1.0, build: 'normal', hair: 'spiky',
    fireAura: true,
    palette: {
      hair: '#1a1a1a', hairDark: '#000000',     // zwarte stekels
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#3a2414',                            // bruine ogen
      shirt: '#7a2e1e', shirtDark: '#4a1c12',    // vurig roodbruin
      pants: '#22201e', shoe: '#0e0e0e',
    },
    desc: 'Gebalanceerd. Elke 30s een vuuraura (5s): wie je dan aanraakt brandt 3s.'
  },
  jenze: {
    id: 'jenze', name: 'Jenze', cost: 1350, lvl: 2,
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
  ricky: {
    id: 'ricky', name: 'Ricky', cost: 2100, lvl: 6,
    maxHp: 85, speedMul: 1.0, meleeMul: 1.0, build: 'normal', hair: 'natural',
    autoRage: true, rageEvery: 15000,
    palette: {
      hair: '#6b4426', hairDark: '#4a2e18',   // bruin haar naar voren
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#2f6fb0',                          // blauwe ogen
      shirt: '#3a7a4a', shirtDark: '#245030',
      pants: '#24303a', shoe: '#101418',
    },
    desc: 'Elke 15s 3s RAGE (2× schade). 85 HP.'
  },
  yarno: {
    id: 'yarno', name: 'Yarno', cost: 1800, lvl: 13,
    maxHp: 100, speedMul: 1.08, meleeMul: 1.0, build: 'normal', hair: 'back', startMelee: 'dagger',
    palette: {
      hair: '#161616', hairDark: '#000000',     // zwart, naar achteren
      skin: '#d8a878', skinDark: '#b8895e',
      eye: '#3a2414',                            // bruine ogen
      shirt: '#2f6f6a', shirtDark: '#1c4a46',    // teal outfit
      pants: '#24303a', shoe: '#101418',
    },
    desc: 'Gebalanceerd, iets sneller. Start met een dagger.'
  },
  // ---- Journey-only mensapen (alleen vrij te spelen in Journey, niet te koop) ----
  bonzo: {
    id: 'bonzo', name: 'Bonzo', cost: 0, journeyOnly: true,
    maxHp: 80, speedMul: 1.15, meleeMul: 0.95, build: 'small', hair: 'natural', extraJump: true,
    palette: {
      hair: '#3a2a1c', hairDark: '#241810',
      skin: '#8a5e38', skinDark: '#5e3f22',     // chimp-vacht
      eye: '#2a1a0e',
      shirt: '#5a4030', shirtDark: '#3a281c', pants: '#2a1c12', shoe: '#140d08',
    },
    desc: 'Chimp: snel & wendbaar, extra sprong. Alleen via Journey.'
  },
  koba: {
    id: 'koba', name: 'Koba', cost: 0, journeyOnly: true,
    maxHp: 135, speedMul: 0.94, meleeMul: 1.25, build: 'bulky', hair: 'bald',
    palette: {
      hair: '#7a3a1e', hairDark: '#54260f',
      skin: '#a85e34', skinDark: '#7a421f',     // orang-oetan-rood
      eye: '#3a1a0a',
      shirt: '#6b3a1e', shirtDark: '#451f0e', pants: '#33200f', shoe: '#160d06',
    },
    desc: 'Bruut: fors & sterk (+25% melee). Alleen via Journey.'
  },
  kong: {
    id: 'kong', name: 'Gorilla King', cost: 0, journeyOnly: true,
    maxHp: 150, speedMul: 0.95, meleeMul: 1.3, build: 'bulky', hair: 'bald', autoRage: true, rageEvery: 14000,
    palette: {
      hair: '#2a2622', hairDark: '#15120f',
      skin: '#3a342f', skinDark: '#262220',     // gorilla-zwart
      eye: '#ffcf33',
      shirt: '#3a342f', shirtDark: '#201d1a', pants: '#1a1816', shoe: '#0c0b0a',
    },
    desc: 'Gorillakoning: enorme kracht + rage. Versla hem in Journey om te unlocken.'
  },
  // ---- vijand-mensapen (alleen als bot in Journey, niet in de shop / niet in CHARACTER_ORDER) ----
  aapje: {
    id: 'aapje', name: 'Aapje', maxHp: 70, speedMul: 1.1, meleeMul: 0.9, build: 'small', hair: 'natural',
    palette: { hair: '#4a3320', hairDark: '#2e2012', skin: '#8a5e38', skinDark: '#5e3f22', eye: '#2a1a0e', shirt: '#6b5030', shirtDark: '#43321c', pants: '#2a1c12', shoe: '#140d08' },
  },
  baviaan: {
    id: 'baviaan', name: 'Baviaan', maxHp: 105, speedMul: 1.0, meleeMul: 1.1, build: 'normal', hair: 'natural',
    palette: { hair: '#5a4030', hairDark: '#3a281c', skin: '#9a6a3a', skinDark: '#6e4824', eye: '#c83838', shirt: '#7a3a2a', shirtDark: '#4a1f14', pants: '#33240f', shoe: '#160d06' },
  },
};
const CHARACTER_ORDER = ['ryan', 'jenze', 'tygo', 'vince', 'timo', 'just', 'ricky', 'yarno', 'bonzo', 'koba', 'kong'];
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
  // kleine luchtballon (wereld 3): zweeft hoog en dropt af en toe een zombie van bovenaf
  dropper: {
    id: 'dropper', hpMul: 1.3, speedMul: 0.5, dmg: 12, biteCd: 1000,
    reach: 16, lunge: false, scale: 1.0, coin: 22, ammoDrop: 6, ammoDropChance: 0.5,
    flying: true, dropper: true, dropEvery: 3200,
    knockChance: 0, knockPlayer: 0, healChance: 0, color: '#8a9c54',
  },
  // eindbaas wereld 3: mega zombie-aap die in één sprong naar de speler toe duikt
  ape: {
    id: 'ape', hpMul: 1.0, speedMul: 0.7, dmg: 36, biteCd: 700,
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
const APE_HP = 1800;
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
  fireball:{ id: 'fireball', name: 'FIREBALL', dur: 0, color: '#ff7a2a', icon: '🔥' }, // 3 schoten
};
const POWERUP_LIST = ['rage', 'speed', 'shield'];
const POWERUP_DROP_CHANCE = 0.025; // kans per kill

/* ---------- POWER SMASH (multiplayer-gamemode) ----------
   8 rondes, melee-only start met de knuppel; er vallen wapens/power-ups/health in de arena. */
const SMASH_ROUNDS = 8;
const SMASH_DROP_EVERY = 5000;       // ms tussen drops (host bepaalt)
const SMASH_WEAPON_TIME = 13000;     // opgepakt melee-wapen ben je na ~13s weer kwijt
const SMASH_FIREBALL_SHOTS = 3;      // aantal vuurballen
const SMASH_ROCKETS = 3;             // raketten bij een RPG-drop
const SMASH_PORTAL_EVERY = 22000;    // ms tussen portalen (host bepaalt) — minder vaak
const SMASH_PORTAL_LIFE = 11000;     // hoe lang een portaalpaar blijft staan
// drakenei: zeldzaam, verdwijnt snel -> snel pakken; roept een draak op die de tegenstander beschiet
const SMASH_DRAGON_LIFE = 4500;      // het ei blijft maar kort liggen
const DRAGON_DUR = 10000;            // de draak blijft 10s
const DRAGON_SPIT_MS = 1600;         // spuugt elke ~1,6s een vuurstraal
const DRAGON_DMG = 10;               // schade per vuurstraal
const SMASH_LIGHTNING_STUN = 1500;   // bliksem (alleen Cave): stunt de tegenstander 1,5s
// Cave: midden-knop -> straal die over de map sweept; raakt 'ie je -> schade + harde knockback
const CAVE_ARM_MS = 7000;            // hoe vaak de knop scherp wordt (rood knippert)
const CAVE_WALL_SPEED = 7;           // px/frame dat de straal over de map sweept
const CAVE_BEAM_DMG = 18;            // schade van de straal
const CAVE_BEAM_KNOCK = 24;          // harde knockback
// steen (alleen Cave, Smash): 3 grote stenen vallen; geraakt = 2s platgedrukt
const SMASH_ROCK_COUNT = 3;
const SMASH_ROCK_FLAT = 2000;        // 2s plat (niet bewegen)
const SMASH_SHIELD = 50;             // shield-powerup: +50 hp als blauw balkje (Pirate + Sky)
const SMASH_ROCK_SPREAD = 55;        // spreiding rond de tegenstander
const HELI_MINIGUN = 100;            // gevechtsheli: minigun-kogels (vuurknop)
const HELI_ROCKETS = 3;              // gevechtsheli: raketten (meleeknop)
const HELI_SPEED = 2.8;              // vlieg-snelheid (links/rechts/omhoog/omlaag)
// Beach: getij (vloed) + strandbal
const BEACH_TIDE_EVERY = 9000;       // ms tussen vloeden
const BEACH_RISE = 1600;             // opkomen
const BEACH_FLOOD = 3200;            // hoog water (golven nemen je mee)
const BEACH_RECEDE = 1800;           // terugtrekken
const BEACH_CARRY = 1.5;             // hoe hard de golf je meeneemt
const BEACH_SLOSH = 850;             // ms per golf-richting
const BALL_LIFE = 15000;             // strandbal leeft 15s, dan ontploft
const BALL_KNOCK = 34;               // harde knockback bij een treffer
// Journey-eiland-powerups (NIEUW, niet in gewone smash)
const COCO_AMMO = 2;                 // kokosbom: lobt in een boog, ontploft (AoE)
const COCO_KNOCK = 28;
const BOOM_AMMO = 2;                 // boemerang: vliegt uit en keert terug, raakt beide kanten
const BOOM_KNOCK = 16;
const DART_AMMO = 5;                 // gifdart: snel + recht, korte verdoving bij treffer
const DART_KNOCK = 8;
const DART_STUN = 700;

// bukken/blokken: parry (perfecte timing) + sterker maar breekbaar blok
const PARRY_WINDOW = 220;            // ms na blok-start = perfecte parry (100% blok + counter)
const GUARD_MAX = 2200;             // blok-uithoudingsvermogen (ms aan blokken)
const GUARD_HIT_COST = 520;        // extra verbruik per geblokte treffer
const GUARD_BREAK_STUN = 950;       // verdoving als je guard breekt
const GUARD_REGEN = 1.3;           // herstel-snelheid als je niet blokt

// combo's: opeenvolgende treffers binnen het tijdvenster -> hoger (x1..x5), meer schade + XP
const COMBO_MAX = 5;
const COMBO_WINDOW = 1500;           // ms om de combo door te zetten
function comboMul(n) { return 1 + (Math.min(n, COMBO_MAX) - 1) * 0.15; }                 // x1=1.0 .. x5=1.6
function comboXp(n) { return Math.round(15 + (Math.min(n, COMBO_MAX) - 1) * (60 - 15) / (COMBO_MAX - 1)); }  // 15,26,37,49,60

/* ---------- HOEDEN (cosmetisch, voor je character) ---------- */
const HATS = {
  none:      { name: 'Geen hoed', cost: 0,   lvl: 0,  desc: 'Geen hoofddeksel.' },
  cap:       { name: 'Pet', cost: 450,        lvl: 2,  desc: 'Klassieke rode pet.' },
  beanie:    { name: 'Muts', cost: 600,       lvl: 2,  desc: 'Warme muts met pom.' },
  party:     { name: 'Feesthoedje', cost: 360,lvl: 3,  desc: 'Feestje!' },
  fedora:    { name: 'Gleufhoed', cost: 900,  lvl: 4,  desc: 'Stijlvolle gleufhoed.' },
  cowboy:    { name: 'Cowboyhoed', cost: 1050, lvl: 4,  desc: 'Yeehaw.' },
  chef:      { name: 'Koksmuts', cost: 900,   lvl: 6,  desc: 'Voor de chef.' },
  grad:      { name: 'Diploma-hoed', cost: 1050, lvl: 7, desc: 'Geslaagd!' },
  tophat:    { name: 'Hoge hoed', cost: 1350,  lvl: 7,  desc: 'Deftig.' },
  propeller: { name: 'Propellerpet', cost: 1500, lvl: 7, desc: 'Met draaiende propeller.' },
  wizard:    { name: 'Tovenaarshoed', cost: 1650, lvl: 8, desc: 'Magisch.' },
  viking:    { name: 'Vikinghelm', cost: 1950, lvl: 9,  desc: 'Met horens.' },
  crown:     { name: 'Kroon', cost: 2700,      lvl: 10, desc: 'Voor de koning.' },
  halo:      { name: 'Halo', cost: 2400,       lvl: 15, desc: 'Engelachtig.' },
  // ---- Journey-unlock hoeden (eiland-thema, niet te koop) ----
  leafcrown: { name: 'Bladerkroon', cost: 0, journeyOnly: true, desc: 'Eiland-kroon van bladeren. Via Journey.' },
  tikimask:  { name: 'Tiki-masker', cost: 0, journeyOnly: true, desc: 'Houten stammenmasker. Via Journey.' },
  bananahat: { name: 'Banaan', cost: 0, journeyOnly: true, desc: 'Een banaan op je hoofd. Via Journey.' },
};
const HAT_ORDER = ['none', 'cap', 'beanie', 'party', 'fedora', 'cowboy', 'chef', 'grad', 'tophat', 'propeller', 'wizard', 'viking', 'crown', 'halo', 'leafcrown', 'tikimask', 'bananahat'];

// ============================================================
// JOURNEY — singleplayer tegen bots. Elk level = 1v1 Power Smash.
// Wereld 1: Onbewoond Eiland (mensapen). 15 levels, oplopend, eindbaas = Gorilla King.
// ============================================================
// 15 unieke beach-geïnspireerde layouts (allemaal strand+zee+getij), met val-randen
const BEACH_LAYOUTS = [
  [{ x: 180, y: 150, w: 240 }, { x: 80, y: 112, w: 50 }, { x: 280, y: 112, w: 50 }],
  [{ x: 180, y: 150, w: 200 }, { x: 180, y: 104, w: 72 }],
  [{ x: 110, y: 150, w: 120 }, { x: 250, y: 150, w: 120 }, { x: 180, y: 108, w: 60 }],
  [{ x: 180, y: 150, w: 220 }, { x: 74, y: 116, w: 48 }, { x: 286, y: 116, w: 48 }, { x: 180, y: 78, w: 70 }],
  [{ x: 180, y: 150, w: 180 }, { x: 70, y: 120, w: 46 }, { x: 290, y: 120, w: 46 }, { x: 130, y: 88, w: 44 }, { x: 230, y: 88, w: 44 }],
  [{ x: 180, y: 150, w: 240 }, { x: 96, y: 110, w: 50 }, { x: 264, y: 110, w: 50 }],
  [{ x: 90, y: 150, w: 120 }, { x: 270, y: 150, w: 120 }, { x: 180, y: 118, w: 80 }, { x: 180, y: 78, w: 48 }],
  [{ x: 180, y: 150, w: 200 }, { x: 74, y: 114, w: 44 }, { x: 286, y: 114, w: 44 }, { x: 180, y: 84, w: 64 }],
  [{ x: 180, y: 150, w: 160 }, { x: 80, y: 124, w: 44 }, { x: 280, y: 124, w: 44 }, { x: 180, y: 96, w: 60 }, { x: 180, y: 58, w: 40 }],
  [{ x: 120, y: 150, w: 120 }, { x: 240, y: 150, w: 120 }, { x: 60, y: 112, w: 44 }, { x: 300, y: 112, w: 44 }, { x: 180, y: 96, w: 70 }],
  [{ x: 180, y: 150, w: 230 }, { x: 110, y: 110, w: 50 }, { x: 250, y: 110, w: 50 }, { x: 180, y: 74, w: 60 }],
  [{ x: 180, y: 150, w: 180 }, { x: 80, y: 118, w: 48 }, { x: 280, y: 118, w: 48 }, { x: 130, y: 86, w: 44 }, { x: 230, y: 86, w: 44 }],
  [{ x: 96, y: 150, w: 110 }, { x: 264, y: 150, w: 110 }, { x: 180, y: 124, w: 70 }, { x: 180, y: 88, w: 50 }, { x: 180, y: 52, w: 36 }],
  [{ x: 180, y: 150, w: 210 }, { x: 70, y: 116, w: 46 }, { x: 290, y: 116, w: 46 }, { x: 120, y: 84, w: 44 }, { x: 240, y: 84, w: 44 }],
  [{ x: 180, y: 150, w: 300 }, { x: 78, y: 112, w: 64 }, { x: 282, y: 112, w: 64 }, { x: 180, y: 80, w: 92 }],   // baas-arena
];
// jungle-varianten (vanaf level 10, dieper het oerwoud in); laatste = troonzaal-eindbaas
const JUNGLE_LAYOUTS = [
  [{ x: 180, y: 150, w: 210 }, { x: 80, y: 112, w: 52 }, { x: 280, y: 112, w: 52 }],
  [{ x: 110, y: 150, w: 120 }, { x: 250, y: 150, w: 120 }, { x: 180, y: 110, w: 64 }],
  [{ x: 180, y: 150, w: 190 }, { x: 70, y: 118, w: 46 }, { x: 290, y: 118, w: 46 }, { x: 180, y: 84, w: 66 }],
  [{ x: 90, y: 150, w: 120 }, { x: 270, y: 150, w: 120 }, { x: 180, y: 120, w: 78 }, { x: 180, y: 82, w: 50 }],
  [{ x: 180, y: 150, w: 170 }, { x: 78, y: 122, w: 46 }, { x: 282, y: 122, w: 46 }, { x: 130, y: 88, w: 44 }, { x: 230, y: 88, w: 44 }],
  [{ x: 180, y: 150, w: 300 }, { x: 80, y: 114, w: 60 }, { x: 280, y: 114, w: 60 }, { x: 180, y: 82, w: 84 }],   // troonzaal-eindbaas
];
const JOURNEY = {
  1: {
    name: 'Onbewoond Eiland',
    // elk level: eigen beach-variant (layout-index), mensaap-bot, oplopende diff, NIEUWE eiland-powerups
    levels: [
      { name: 'Aangespoeld',    diff: 1,  bot: 'aapje',   drops: ['dart'] },
      { name: 'Brekers',        diff: 2,  bot: 'aapje',   drops: ['dart'] },
      { name: 'Palmenrif',      diff: 2,  bot: 'aapje',   drops: ['dart', 'coco'] },
      { name: 'Apenstreken',    diff: 3,  bot: 'aapje',   drops: ['dart', 'coco'] },
      { name: 'Vloedlijn',      diff: 4,  bot: 'baviaan', drops: ['dart', 'coco'] },
      { name: 'Lagune',         diff: 4,  bot: 'baviaan', drops: ['dart', 'coco', 'boom'] },
      { name: 'Kliftoppen',     diff: 5,  bot: 'baviaan', drops: ['coco', 'boom'] },
      { name: 'Zandbank',       diff: 6,  bot: 'baviaan', drops: ['dart', 'coco', 'boom'] },
      { name: 'Verboden strand',diff: 6,  bot: 'baviaan', drops: ['coco', 'boom'] },
      { name: 'Krabbenbaai',    diff: 7,  bot: 'koba',    drops: ['dart', 'coco', 'boom'] },
      { name: 'Kokospaleis',    diff: 7,  bot: 'koba',    drops: ['coco', 'boom'] },
      { name: 'Stormkaap',      diff: 8,  bot: 'koba',    drops: ['dart', 'coco', 'boom'] },
      { name: 'Springvloed',    diff: 9,  bot: 'koba',    drops: ['coco', 'boom', 'dart'] },
      { name: 'Aapheuvel',      diff: 9,  bot: 'koba',    drops: ['coco', 'boom', 'dart'] },
      { name: 'GORILLA KING',   diff: 10, bot: 'kong',    drops: ['coco', 'boom', 'dart'], boss: true },
    ],
    unlocks: { 3: { hat: 'leafcrown' }, 5: { char: 'bonzo' }, 8: { hat: 'tikimask' }, 10: { char: 'koba' }, 12: { hat: 'bananahat' }, 15: { char: 'kong' } },
  },
};

/* ---------- SHOP-POWERUPS (koop met munten -> inventaris; activeer 1 per keer in een match) ----------
   'kind' = welk drop-effect wordt toegepast (hergebruikt applyDrop). Meermaals te kopen (stapelt). */
const SHOP_POWERUPS = {
  heal:     { name: 'Medipack', cost: 60,  kind: 'health',   icon: '➕', desc: 'Herstelt meteen 40 HP.' },
  shield:   { name: 'Schild',   cost: 90,  kind: 'shield',   icon: '🛡', desc: 'Schild dat een flinke klap opvangt.' },
  speed:    { name: 'Speed',    cost: 70,  kind: 'speed',    icon: '⚡', desc: 'Even een stuk sneller.' },
  rage:     { name: 'Rage',     cost: 100, kind: 'rage',     icon: '⚔', desc: 'Even veel meer klap-schade.' },
  fireball: { name: 'Vuurbal',  cost: 120, kind: 'fireball', icon: '🔥', desc: '3 vuurballen die ook laten branden.' },
  giant:    { name: 'Reus',     cost: 350, kind: 'giant',    icon: '👊', desc: 'Word even een enorme reus.' },
  dragon:   { name: 'Draak',    cost: 350, kind: 'dragon',   icon: '🐉', desc: 'Roep een draak op die vuur spuwt naar je tegenstander.' },
  ak47:     { name: 'AK47',     cost: 0,   kind: 'ak47',     icon: '🔫', desc: 'Machinegeweer met 50 kogels. Alleen uit kisten.', chestOnly: true },
  rocket:   { name: 'Raket',    cost: 0,   kind: 'rocket',   icon: '🚀', desc: 'Raketwerper. Alleen uit kisten.', chestOnly: true },
};
const POWERUP_ORDER = ['heal', 'shield', 'speed', 'rage', 'fireball', 'giant', 'dragon', 'ak47', 'rocket'];

/* ---------- KISTEN (loot uit online matches, Clash-stijl met unlock-timers) ---------- */
const CHEST_TYPES = {
  common:    { name: 'Common',    col: '#b0763a', band: '#e6b070', dur: 2 * 3600e3,   gold: [50, 100],   xp: [25, 150] },
  rare:      { name: 'Rare',      col: '#3a7ad0', band: '#9fceff', dur: 3.5 * 3600e3, gold: [100, 220],  xp: [75, 250] },
  epic:      { name: 'Epic',      col: '#8a3ad0', band: '#cf9dff', dur: 8 * 3600e3,   gold: [350, 550],  xp: [150, 400] },
  legendary: { name: 'Legendary', col: '#e8a81c', band: '#fff0a0', dur: 14 * 3600e3,  gold: [500, 1000], xp: [250, 700] },
};
const CHEST_ORDER = ['common', 'rare', 'epic', 'legendary'];
const CHEST_WIN_CHANCE = 0.5, CHEST_LOSS_CHANCE = 0.15;               // kans op een kist na een online match
const CHEST_RARITY_WEIGHTS = { common: 62, rare: 26, epic: 9, legendary: 3 };   // betere kisten veel zeldzamer
const CHEST_SLOTS = 3;                                                // je kunt er max 3 hebben

/* ---------- BOT-MOEILIJKHEID (level 1..10) ----------
   Elk level heeft een eigen speelstijl. Velden:
   meleeCd = ms tussen meppen, block = blokkans, aggro = hoe vaak 'ie de aanval zoekt,
   react = reactietijd vóór 'ie mept (ms), shootCd = ms tussen schoten (beide-wapens),
   jumpy = kans dat 'ie naar platforms springt, standoff = gewenste afstand tot de speler */
const BOT_PROFILES = [
  { name: 'Luiaard',      meleeCd: 1300, block: 0.00, aggro: 0.45, react: 700, shootCd: 2600, jumpy: 0.45, standoff: 70, mistake: 0.45 },
  { name: 'Schuchter',    meleeCd: 1100, block: 0.05, aggro: 0.55, react: 600, shootCd: 2200, jumpy: 0.50, standoff: 56, mistake: 0.40 },
  { name: 'Straatvechter',meleeCd: 950,  block: 0.10, aggro: 0.70, react: 520, shootCd: 1900, jumpy: 0.60, standoff: 30, mistake: 0.34 },
  { name: 'Verdediger',   meleeCd: 850,  block: 0.45, aggro: 0.65, react: 460, shootCd: 1700, jumpy: 0.60, standoff: 34, mistake: 0.28 },
  { name: 'Jager',        meleeCd: 750,  block: 0.20, aggro: 0.95, react: 400, shootCd: 1500, jumpy: 0.70, standoff: 24, mistake: 0.22 },
  { name: 'Springer',     meleeCd: 760,  block: 0.20, aggro: 0.85, react: 380, shootCd: 1500, jumpy: 0.95, standoff: 28, mistake: 0.18 },
  { name: 'Schutter',     meleeCd: 560,  block: 0.25, aggro: 0.80, react: 320, shootCd: 560,  jumpy: 0.65, standoff: 64, mistake: 0.16 },
  { name: 'Razend',       meleeCd: 520,  block: 0.15, aggro: 1.00, react: 300, shootCd: 1300, jumpy: 0.80, standoff: 22, mistake: 0.10 },
  { name: 'Tacticus',     meleeCd: 600,  block: 0.55, aggro: 0.85, react: 300, shootCd: 1100, jumpy: 0.85, standoff: 32, mistake: 0.06 },
  { name: 'Meester',      meleeCd: 400,  block: 0.62, aggro: 1.00, react: 220, shootCd: 750,  jumpy: 0.95, standoff: 24, mistake: 0.03 },
];
// dropsoorten + relatieve kans
const SMASH_DROPS = [
  { kind: 'weapon', w: 34 },         // willekeurig melee-wapen
  { kind: 'fireball', w: 16 },
  { kind: 'rocket', w: 10 },
  { kind: 'health', w: 20 },
  { kind: 'rage', w: 10 },
  { kind: 'speed', w: 10 },
  { kind: 'dragon', w: 5 },           // drakenei: zeldzaam
];
// melee-wapens die kunnen vallen (alle echte melee, geen knuppel/schild)
const SMASH_WEAPON_POOL = ['club', 'machete', 'sword', 'dagger', 'axe', 'spear', 'mace', 'flail', 'bostaff', 'katana', 'halberd'];

/* ---------- XP / LEVELS (multiplayer-duels) ----------
   XP per duel: winst geeft meer dan verlies. Langzame, oplopende curve:
   level L vereist 75*L*(L-1) totale XP -> L2=150, L3=450, L4=900, L5=1500, L10=6750.
   Met +50/win en +15/loss duurt levelen flink (niet te snel). */
const XP_WIN = 50;
const XP_LOSS = 15;
function playerLevel(xp) {
  return Math.floor((1 + Math.sqrt(1 + (4 * (xp || 0)) / 75)) / 2);
}
function xpForLevel(L) { return 75 * L * (L - 1); }   // totale XP nodig voor level L

/* ---------- Jungle: gorilla in de kooi ---------- */
const GORILLA_HP = 280;            // sterk, maar te verslaan
const GORILLA_RESPAWN = 16000;     // komt na ~16s terug
const GORILLA_SWIPE_CD = 1100;     // ms tussen klappen
const GORILLA_REACH = 44;          // bereik van de klap

/* ---------- Pirate Ship: zeemonster-tentakel ---------- */
const PIRATE_TENT_EVERY = 7000;    // ms tussen tentakels
const PIRATE_TENT_WARN = 1100;     // waarschuwing (water borrelt) vóór de slag
const PIRATE_TENT_STRIKE = 700;    // duur van de slag

/* ---------- Vulcan-map: lavastraal + schuine platforms ---------- */
const VULCAN_EVERY = 6500;     // ms tussen uitbarstingen
const VULCAN_BUBBLE = 1300;    // borrel-waarschuwing vóór de uitbarsting
const VULCAN_ERUPT = 950;      // duur van de lavastraal
const VULCAN_SLIDE = 0.85;     // afglijsnelheid op schuine platforms (px/frame)

/* ---------- 1 vs 1 MAPS ----------
   Elke map past op één scherm (geen camera-scroll, beide spelers altijd in beeld).
   platform: { x, y, w, mv? } — mv = { axis:'x'|'y', amp, speed, phase } beweegt het platform.
   sky = [boven, onder] kleuren, void = afgrond-kleur onderin. */
const VERSUS_MAPS = [
  {
    // Jungle: grootste map. Oerwoud-achtergrond + papegaaien, lianen om mee te slingeren,
    // en in het midden een kooi met een sterke (maar te verslaan) gorilla — val je erin, dan vecht je.
    id: 'jungle', name: 'Jungle', sky: ['#163a24', '#08160e'], void: '#06120a', plat: 'leaf', jungle2: true,
    w: 960, fallY: 240, camTop: -50, camBottom: 30,
    spawnL: { x: 120, y: 176 }, spawnR: { x: 840, y: 176 },
    platforms: [
      { x: 120, y: 176, w: 170 }, { x: 840, y: 176, w: 170 },   // grond links/rechts
      { x: 280, y: 118, w: 70 }, { x: 680, y: 118, w: 70 },     // midden
      { x: 160, y: 66, w: 52 }, { x: 800, y: 66, w: 52 },       // hoog
      { x: 480, y: 206, w: 150 },                                // kooi-vloer (in het midden, lager)
    ],
    vines: [{ x: 360, ay: -38, len: 150 }, { x: 600, ay: -38, len: 150 }],   // lianen om mee te slingeren
    cage: { x: 480, floorY: 206, w: 150, top: 118 },             // kooi met gorilla
  },
  {
    // Dohyo: kleine Japanse sumo-ring. Eén klein rond platform -> je wordt er makkelijk afgeslagen.
    // Alle power-ups vallen hier.
    id: 'dohyo', name: 'Dohyo', sky: ['#caa066', '#7a5a36'], void: '#140a06', plat: 'dohyo', dohyo: true, w: 360,
    spawnL: { x: 145, y: 150 }, spawnR: { x: 215, y: 150 },
    platforms: [
      { x: 180, y: 150, w: 138 },   // de ring (midden, onder)
      { x: 64, y: 104, w: 58 },     // zwevend platform links
      { x: 296, y: 104, w: 58 },    // zwevend platform rechts
    ],
  },
  {
    // Piratenschip: heel het dek is begaanbaar, 4 platforms, 2 masten (kraaiennest) om bovenin te staan.
    // Af en toe komt er een zeemonster-tentakel uit het water die je platslaat of van de boot af mept.
    id: 'pirate', name: 'Pirate Ship', sky: ['#1f4e7a', '#0c1d33'], void: '#06121f', plat: 'wood', wood: true, pirate: true,
    w: 720, fallY: 232, camTop: -20, camBottom: 30,
    spawnL: { x: 200, y: 178 }, spawnR: { x: 520, y: 178 },
    platforms: [
      { x: 360, y: 178, w: 520 },                              // het dek (heel de ondergrond)
      { x: 175, y: 132, w: 64 }, { x: 545, y: 132, w: 64 },    // 2 lage platforms
      { x: 300, y: 96, w: 56 }, { x: 420, y: 96, w: 56 },      // 2 hogere platforms
      { x: 230, y: 40, w: 34, mast: true }, { x: 490, y: 40, w: 34, mast: true },  // 2 masten (kraaiennest)
    ],
  },
  {
    // Vulcan: net zo groot als Cave. Stenen platforms, lavastraal in het midden,
    // schuine platforms naast de opening waar je vanaf glijdt; achtergrond met uitbarstingen + rook.
    id: 'lava', name: 'Volcano', sky: ['#3a1410', '#1a0805'], void: '#5a1408', plat: 'stone', stone: true, vulcan: true,
    w: 720, fallY: 232, camTop: -30, camBottom: 30, vulcanX: 360,
    spawnL: { x: 90, y: 176 }, spawnR: { x: 630, y: 176 },
    platforms: [
      { x: 110, y: 176, w: 130 }, { x: 610, y: 176, w: 130 },   // grond links/rechts (midden = opening)
      { x: 230, y: 138, w: 56 }, { x: 490, y: 138, w: 56 },     // mid steen
      { x: 296, y: 96, w: 54, slide: -1 }, { x: 424, y: 96, w: 54, slide: 1 },  // schuine slide-platforms naast de opening
      { x: 175, y: 70, w: 40 }, { x: 545, y: 70, w: 40 },       // hoog steen
    ],
  },
  {
    // grootste map: hoog in de lucht, camera beweegt mee (omhoog + horizontaal), spring op wolken
    id: 'sky', name: 'Sky', sky: ['#6fb6e8', '#bfe3f5'], void: '#9fcce8', plat: 'cloud',
    w: 720, fallY: 232, camTop: -120, camBottom: 30,
    spawnL: { x: 110, y: 176 }, spawnR: { x: 610, y: 176 },
    platforms: [
      { x: 110, y: 176, w: 74 }, { x: 610, y: 176, w: 74 },
      { x: 240, y: 130, w: 120 }, { x: 480, y: 130, w: 120 }, // middenrij: 2x zo groot
      { x: 215, y: 82, w: 56, soft: true }, { x: 505, y: 82, w: 56, soft: true },   // zachte wolken
      { x: 295, y: 34, w: 52, soft: true }, { x: 425, y: 34, w: 52, soft: true },   // zachte wolken
      { x: 360, y: -16, w: 128 },                             // top (midden): 2x zo groot
    ],
  },
  {
    // grot: net zo groot als Sky. Diepe grotten op de achtergrond, vleermuizen, waterdruppels.
    // Knoppen onder/boven die af en toe rood knipperen -> een muur gooit de tegenstander aan de andere kant eraf.
    id: 'cave', name: 'Cave', sky: ['#241f33', '#0b0810'], void: '#050308', plat: 'rock', cave: true,
    w: 720, fallY: 232, camTop: -30, camBottom: 30,
    spawnL: { x: 90, y: 176 }, spawnR: { x: 630, y: 176 },
    platforms: [
      { x: 110, y: 176, w: 120 }, { x: 610, y: 176, w: 120 },   // grond (groot)
      { x: 360, y: 150, w: 150 },                                // grote middenplaat
      { x: 215, y: 120, w: 30 }, { x: 505, y: 120, w: 30 },      // kleine
      { x: 360, y: 98, w: 96 },                                  // grote
      { x: 150, y: 80, w: 28 }, { x: 570, y: 80, w: 28 },        // kleine hoog
      { x: 300, y: 60, w: 30 }, { x: 420, y: 60, w: 30 },        // kleine top
      { x: 360, y: 60, w: 40 },                                  // center-top (bovenste knop)
    ],
    buttons: [
      { at: 'mid', x: 360, y: 98 },                              // 1 knop in het midden -> straal sweept de map
    ],
  },
  {
    // Beach: strand met zee + golven op de achtergrond. Af en toe vloed: water stijgt over de map
    // en de golven nemen je mee. Powerup: strandbal (stuitert, harde knockback, ontploft na 15s).
    id: 'beach', name: 'Beach', sky: ['#8ad0f0', '#cde7f7'], void: '#1c4a5e', plat: 'sand', sand: true, beach: true, w: 360, fallY: 214,
    spawnL: { x: 120, y: 150 }, spawnR: { x: 240, y: 150 },
    platforms: [
      { x: 180, y: 150, w: 232 },                  // het strand (smaller -> je kunt er aan de zijkanten afvallen)
      { x: 74, y: 112, w: 56 }, { x: 286, y: 112, w: 56 },   // houten vlonders links/rechts (boven het water)
      { x: 180, y: 76, w: 78 },                    // hoog plankier
    ],
  },
];

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
      // ---- normaal jungle-gevechtslevel: vaste grond, VEEL en taaie zombies ----
      const length = Math.round(2600 + i * 300);          // 2600 -> 5000
      levels.push({
        id, name: 'Jungle ' + id, theme: 'jungle', mode: 'reach',
        killAll: true, noObstacles: true,                 // geen straat-obstakels in de jungle
        flyerChance: +(0.12 + t * 0.10).toFixed(2),        // af en toe een vogel (gewone schade)
        dropperChance: +(0.12 + t * 0.10).toFixed(2),      // kleine luchtballon die zombies dropt
        endWave: true,                                      // extra golf bij de finish
        length,
        zombieCount: Math.round(34 + i * 8),               // 34 -> 98 (veel meer zombies)
        spawnEvery: Math.round(1150 - t * 550),            // 1150 -> 600 (sneller)
        zombieHp: Math.round(60 + i * 11),                 // 60 -> 148 (taaier — AK47 loopt er niet meer doorheen)
        zombieSpeed: +(0.8 + t * 0.5).toFixed(2),          // 0.8 -> 1.3
        runnerChance: +(0.16 + t * 0.26).toFixed(2),       // meer snelle zombies
        crawlerChance: +(0.10 + t * 0.20).toFixed(2),
        bruteChance: i >= 2 ? +(0.06 + t * 0.16).toFixed(2) : 0,  // brutes eerder en vaker
        doorChance: 0,
        maxAlive: Math.round(9 + i * 1.4),                 // 9 -> 20 tegelijk (drukker)
        reward: 110 + i * 22,
        midTime: Math.round(length * 11 + 5000),           // royale checkpoint-tijd
      });
    }
  }
  // level 10: MEGA ZOMBIE-AAP (springt in één keer naar je toe) — KLEINE arena: ontwijken!
  levels.push({
    id: 10, name: 'AAP BOSS', theme: 'jungle', mode: 'boss', isBoss: true, apeBoss: true,
    length: 380, zombieCount: 0, spawnEvery: 999999,
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
