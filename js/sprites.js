/* ============================================================
   SPRITES — alle pixel-art wordt hier in code getekend.
   Geen externe afbeeldingen nodig.
   ============================================================ */

const Sprites = {
  // klein hulpmiddel: teken een "pixel"-blok (afgerond op hele pixels)
  px(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  },

  /* ---------- CHARACTER (Ryan & later anderen) ----------
     cx = horizontale midden, footY = grond (voeten),
     dir = 1 (rechts) of -1 (links),
     pose = { walkPhase, airborne, ducking, attacking, weapon } */
  drawCharacter(ctx, cx, footY, dir, pal, pose) {
    pose = pose || {};
    const duck = pose.ducking;
    const weapon = pose.weapon;
    const bulky = pose.build === 'bulky';
    const curly = pose.hair === 'curly';

    // breedtes (fors = breder lijf)
    const bh = bulky ? 6 : 5;   // halve romp-breedte
    const hh = bulky ? 5 : 4;   // halve hoofd-breedte
    const legW = bulky ? 4 : 3;

    // hoogtematen
    const legH = duck ? 4 : 9;
    const torsoH = duck ? 8 : 11;
    const headH = duck ? 8 : 9;

    const legTop = footY - legH;
    const torsoTop = legTop - torsoH;
    const headTop = torsoTop - headH;

    // --- benen (loop-animatie) ---
    let swing = 0;
    if (!pose.airborne && !duck) {
      const ph = pose.walkPhase || 0;
      swing = (ph === 1) ? 2 : (ph === 3) ? -2 : 0;
    }
    this.px(ctx, pal.pants, cx - (legW + 1), legTop, legW, legH);          // achterbeen
    this.px(ctx, pal.shoe, cx - (legW + 1) - swing, footY - 2, legW + 1, 2);
    this.px(ctx, pal.pants, cx + 1, legTop, legW, legH);                   // voorbeen
    this.px(ctx, pal.shoe, cx + 1 + swing, footY - 2, legW + 1, 2);

    // --- torso (shirt) ---
    this.px(ctx, pal.shirt, cx - bh, torsoTop, bh * 2, torsoH);
    this.px(ctx, pal.shirtDark, cx - bh, torsoTop, 2, torsoH);             // schaduw
    if (bulky) this.px(ctx, pal.shirtDark, cx - bh, torsoTop, bh * 2, 2);  // brede schouders

    // --- hoofd ---
    this.px(ctx, pal.skin, cx - hh, headTop, hh * 2, headH);
    this.px(ctx, pal.skinDark, cx - hh, headTop, 2, headH);

    // --- haar ---
    if (curly) {
      // bobbelige krullen bovenop + aan de zijkanten
      for (let i = -hh - 1; i <= hh - 1; i += 2) {
        this.px(ctx, pal.hair, cx + i, headTop - 3, 3, 4);
        this.px(ctx, pal.hairDark, cx + i, headTop - 3, 3, 1);
      }
      this.px(ctx, pal.hair, cx - hh - 1, headTop, 2, 5);                  // linkerkrul
      this.px(ctx, pal.hair, cx + hh - 1, headTop, 2, 5);                  // rechterkrul
      this.px(ctx, pal.hair, cx - hh, headTop, hh * 2, 2);                 // pony
    } else {
      this.px(ctx, pal.hair, cx - hh - 1, headTop - 2, hh * 2 + 2, 4);
      this.px(ctx, pal.hair, cx - hh - 1, headTop, 2, 4);                  // links bakkebaard
      this.px(ctx, pal.hair, cx + hh - 1, headTop, 2, 4);                  // rechts
      this.px(ctx, pal.hairDark, cx - hh - 1, headTop - 2, hh * 2 + 2, 1);
      this.px(ctx, pal.hair, cx + (dir > 0 ? 2 : -3), headTop - 3, 2, 2);  // losse pluk
    }
    // oog (kijkrichting)
    this.px(ctx, pal.eye, cx + (dir > 0 ? 1 : -2), headTop + 3, 2, 2);

    // --- arm + wapen ---
    this.drawArmAndWeapon(ctx, cx, torsoTop, dir, pal, weapon, pose.attacking, bh);
  },

  drawArmAndWeapon(ctx, cx, torsoTop, dir, pal, weaponId, attacking, bh) {
    const armY = torsoTop + 3;
    const reach = attacking ? 9 : 5;
    const sh = (bh || 5) - 2;   // schouder-offset (breder bij fors lijf)
    const w = WEAPONS[weaponId] || WEAPONS.bat;

    // arm (huidskleur)
    this.px(ctx, pal.skin, cx + (dir > 0 ? sh : -sh - reach), armY, reach + 3, 3);

    const handX = cx + (dir > 0 ? sh + reach + 2 : -(sh + reach + 2));
    const flip = dir;

    // wapen aan de hand
    if (w.type === 'melee') {
      if (w.id === 'machete') {
        this.px(ctx, '#cfd6df', handX, armY - (attacking ? 8 : 2), 3 * flip, attacking ? 11 : 9);
        this.px(ctx, '#5a3a22', handX, armY + 1, 2 * flip, 3);
      } else { // knuppel
        this.px(ctx, '#7a5230', handX, armY - (attacking ? 7 : 1), 3 * flip, attacking ? 10 : 8);
        this.px(ctx, '#5a3a22', handX, armY + 2, 2 * flip, 3);
      }
    } else {
      // vuurwapens
      const gunBody = '#3a3f46', gunDark = '#23262b', gunWood = '#6b4a2a';
      if (w.id === 'pistol') {
        this.px(ctx, gunBody, handX, armY - 1, 6 * flip, 3);
        this.px(ctx, gunDark, handX, armY + 2, 2 * flip, 3);
      } else if (w.id === 'uzi') {
        this.px(ctx, gunBody, handX, armY - 1, 8 * flip, 3);
        this.px(ctx, gunDark, handX + 1 * flip, armY + 2, 2 * flip, 4); // magazijn
      } else if (w.id === 'ak47') {
        this.px(ctx, gunBody, handX, armY - 1, 12 * flip, 3);
        this.px(ctx, gunWood, handX - 1 * flip, armY, 3 * flip, 2);
        this.px(ctx, gunDark, handX + 4 * flip, armY + 2, 3 * flip, 4); // gebogen magazijn
      }
    }
  },

  /* ---------- ZOMBIE (dispatch op type) ---------- */
  drawZombie(ctx, cx, footY, dir, z) {
    const id = (z && z.type) ? z.type.id : 'walker';
    if (id === 'boss') return this.drawBoss(ctx, cx, footY, dir, z);
    if (id === 'balloon') return this.drawBalloon(ctx, cx, footY, dir, z);
    if (id === 'flyer') return this.drawFlyer(ctx, cx, footY, dir, z);
    if (id === 'brute') return this.drawBrute(ctx, cx, footY, dir, z);
    if (id === 'crawler') return this.drawCrawler(ctx, cx, footY, dir, z);
    return this.drawWalker(ctx, cx, footY, dir, z);
  },

  // gemuteerde zombie-vogel (cy = midden, want flyers hebben cyOff 0)
  drawFlyer(ctx, cx, cy, dir, z) {
    const flap = ((z && z.walkPhase) % 2 === 0) ? -3 : 1;
    this.px(ctx, '#5a7a3a', cx - 7, cy - 1 + flap, 6, 2);   // vleugel achter
    this.px(ctx, '#5a7a3a', cx + 1, cy - 1 + flap, 6, 2);   // vleugel voor
    this.px(ctx, '#6a8c4a', cx - 4, cy - 3, 8, 6);          // lijf
    this.px(ctx, '#4e6a32', cx - 4, cy + 2, 8, 1);          // buik-schaduw
    this.px(ctx, '#2e3a22', cx - dir * 6, cy, 3, 2);        // staart
    const hx = cx + dir * 4;                                 // kop richting speler
    this.px(ctx, '#6a8c4a', hx - 1, cy - 4, 4, 4);
    this.px(ctx, '#caa84a', hx + dir * 2, cy - 2, 2, 2);     // snavel
    this.px(ctx, '#ff3838', hx + (dir > 0 ? 0 : 1), cy - 3, 1, 1); // rood oog
    this.px(ctx, '#8a2222', cx - 1, cy, 2, 1);              // bloedvlek
  },

  // eindbaas: zombie in een luchtballon
  drawBalloon(ctx, cx, cy, dir, z) {
    // ballon-bol met strepen
    const top = cy - 20;
    ctx.fillStyle = '#b33a3a'; ctx.beginPath(); ctx.ellipse(cx, top, 19, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a2626';
    for (let i = -2; i <= 2; i++) this.px(ctx, '#8a2626', cx + i * 7 - 1, top - 20, 2, 40);
    ctx.fillStyle = '#d9d0b0'; this.px(ctx, '#d9d0b0', cx - 4, top - 22, 8, 3); // bovenkapje
    // touwen
    this.px(ctx, '#2a2018', cx - 8, cy - 2, 1, 9);
    this.px(ctx, '#2a2018', cx + 7, cy - 2, 1, 9);
    // mand
    this.px(ctx, '#6b4a2a', cx - 10, cy + 7, 20, 9);
    this.px(ctx, '#54381f', cx - 10, cy + 13, 20, 3);
    // zombie in de mand
    this.px(ctx, '#4a7a2e', cx - 5, cy - 2, 10, 10);        // torso
    this.px(ctx, '#5a8a3a', cx - 4, cy - 9, 8, 8);          // kop
    this.px(ctx, '#3a5a22', cx - 4, cy - 10, 8, 2);         // haar
    this.px(ctx, '#ff3030', cx + (dir > 0 ? 1 : -2), cy - 6, 2, 2); // rood oog
    this.px(ctx, '#5a8a3a', cx + (dir > 0 ? 5 : -9), cy - 1, 4, 3); // gestrekte arm
  },

  // zwevend parkour-platform (rotsrichel)
  drawPlatform(ctx, cx, y, w) {
    const x = Math.round(cx - w / 2);
    w = Math.round(w);
    this.px(ctx, '#5c7e5a', x, y - 1, w, 2);     // mossige/grasrand bovenop
    this.px(ctx, '#4a5e72', x, y + 1, w, 3);     // steen-topvlak
    this.px(ctx, '#384a5c', x, y + 4, w, 9);     // steen-body
    this.px(ctx, '#28323e', x, y + 11, w, 4);    // schaduw onderkant
    this.px(ctx, '#2a3540', x + 3, y + 5, 2, 5); // textuur
    this.px(ctx, '#2a3540', x + w - 6, y + 6, 2, 4);
  },

  // kleurvariatie per zombie
  zPal(z) {
    const base = (z && z.type && z.type.color) || '#6a9c4a';
    const tint = z ? z.tint : 0;
    const skins = ['#5e8a40', '#6a9c4a', '#7caa54'];
    const skin = tint === 0 ? base : skins[tint + 1] || base;
    return {
      skin, skinDark: '#42662a',
      shirt: ['#5a4a3a', '#4a4a55', '#5a3a3a'][(z && z.tint + 1) || 1],
      shirtDark: '#332a22', pants: '#34384a', blood: '#8a2222', eye: '#ff4040',
    };
  },

  // arm-pose op basis van aanval-state
  zArms(ctx, pal, cx, torsoTop, dir, z) {
    const st = z ? z.atk : 'walk';
    if (st === 'windup') {
      // armen omhoog/achteruit (haalt uit)
      this.px(ctx, pal.skin, cx + (dir > 0 ? 2 : -6), torsoTop - 4, 4, 3);
      this.px(ctx, pal.skin, cx + (dir > 0 ? 4 : -8), torsoTop - 6, 4, 3);
    } else if (st === 'strike') {
      // armen ver naar voren (uitval)
      this.px(ctx, pal.skin, cx + (dir > 0 ? 4 : -13), torsoTop + 1, 9, 3);
      this.px(ctx, pal.skinDark, cx + (dir > 0 ? 11 : -13), torsoTop + 1, 2, 3); // klauw
    } else {
      // gestrekt vooruit (slome zombiehouding)
      this.px(ctx, pal.skin, cx + (dir > 0 ? 4 : -10), torsoTop + 2, 6, 3);
    }
  },

  drawWalker(ctx, cx, footY, dir, z) {
    const pal = this.zPal(z);
    const runner = z && z.type && z.type.id === 'runner';
    const legH = 8, torsoH = 11, headH = 8;
    const legTop = footY - legH, torsoTop = legTop - torsoH, headTop = torsoTop - headH;
    const ph = (z && z.walkPhase) || 0;
    const swing = (ph === 1) ? 2 : (ph === 3) ? -2 : 0;

    // benen
    this.px(ctx, pal.pants, cx - 4, legTop, 3, legH);
    this.px(ctx, pal.pants, cx + 1, legTop, 3, legH);
    this.px(ctx, '#1a1a1a', cx - 4 - swing, footY - 2, 4, 2);
    this.px(ctx, '#1a1a1a', cx + 1 + swing, footY - 2, 4, 2);

    // torso (gescheurd shirt + scheuren)
    this.px(ctx, pal.shirt, cx - 5, torsoTop, 10, torsoH);
    this.px(ctx, pal.shirtDark, cx - 5, torsoTop, 2, torsoH);
    this.px(ctx, pal.skin, cx + 2, torsoTop + 6, 2, 3);   // gat in shirt (huid)
    this.px(ctx, pal.blood, cx + 1, torsoTop + 4, 3, 2);

    this.zArms(ctx, pal, cx, torsoTop, dir, z);

    // hoofd
    this.px(ctx, pal.skin, cx - 4, headTop, 8, headH);
    this.px(ctx, pal.skinDark, cx - 4, headTop, 2, headH);
    this.px(ctx, pal.eye, cx + (dir > 0 ? 1 : -2), headTop + 3, 2, 2);
    this.px(ctx, '#fff', cx + (dir > 0 ? 1 : -2), headTop + 3, 1, 1); // glinster
    this.px(ctx, '#2e3a22', cx - 4, headTop - 1, runner ? 5 : 8, 2);  // haarplukken
    this.px(ctx, '#3a1a1a', cx + (dir > 0 ? 0 : 2), headTop + 6, 3, 1); // mond/wond
  },

  drawCrawler(ctx, cx, footY, dir, z) {
    const pal = this.zPal(z);
    const ph = (z && z.walkPhase) || 0;
    const swing = (ph === 1) ? 2 : (ph === 3) ? -2 : 0;
    const bodyTop = footY - 11;

    // achterpoten
    this.px(ctx, pal.pants, cx - 6, footY - 5, 3, 5);
    this.px(ctx, pal.pants, cx - 1, footY - 5, 3, 5);
    this.px(ctx, '#1a1a1a', cx - 6 + swing, footY - 2, 3, 2);

    // langwerpig lichaam (kruipend, voorover)
    this.px(ctx, pal.shirt, cx - 7, bodyTop, 13, 6);
    this.px(ctx, pal.shirtDark, cx - 7, bodyTop, 13, 2);
    this.px(ctx, pal.blood, cx - 2, bodyTop + 2, 3, 2);

    // gestrekte voorarmen/klauwen vooruit (laag bij de grond)
    const ax = cx + (dir > 0 ? 5 : -12);
    this.px(ctx, pal.skin, ax, footY - 4, 7, 3);
    this.px(ctx, pal.skinDark, cx + (dir > 0 ? 11 : -12), footY - 4, 2, 3);

    // kop vooruit gestoken
    const hx = cx + (dir > 0 ? 3 : -10);
    this.px(ctx, pal.skin, hx, bodyTop - 1, 7, 6);
    this.px(ctx, pal.skinDark, hx, bodyTop - 1, 7, 1);
    this.px(ctx, pal.eye, cx + (dir > 0 ? 7 : -7), bodyTop + 1, 2, 2);
  },

  drawBrute(ctx, cx, footY, dir, z) {
    const pal = this.zPal(z);
    pal.skin = '#4e7c3a'; pal.skinDark = '#365626';
    const ph = (z && z.walkPhase) || 0;
    const swing = (ph === 1) ? 2 : (ph === 3) ? -2 : 0;
    const legH = 11, torsoH = 17, headH = 11;
    const legTop = footY - legH, torsoTop = legTop - torsoH, headTop = torsoTop - headH;

    // dikke benen
    this.px(ctx, pal.pants, cx - 7, legTop, 6, legH);
    this.px(ctx, pal.pants, cx + 1, legTop, 6, legH);
    this.px(ctx, '#141414', cx - 7 - swing, footY - 3, 6, 3);
    this.px(ctx, '#141414', cx + 1 + swing, footY - 3, 6, 3);

    // brede romp
    this.px(ctx, pal.shirt, cx - 9, torsoTop, 18, torsoH);
    this.px(ctx, pal.shirtDark, cx - 9, torsoTop, 3, torsoH);
    this.px(ctx, pal.skin, cx + 3, torsoTop + 5, 4, 5);   // gescheurde huid
    this.px(ctx, pal.blood, cx - 2, torsoTop + 7, 5, 3);

    // grote armen (pose)
    const st = z ? z.atk : 'walk';
    if (st === 'strike') {
      this.px(ctx, pal.skin, cx + (dir > 0 ? 7 : -20), torsoTop + 2, 14, 5);
      this.px(ctx, pal.skinDark, cx + (dir > 0 ? 19 : -20), torsoTop + 1, 3, 6);
    } else if (st === 'windup') {
      this.px(ctx, pal.skin, cx + (dir > 0 ? 4 : -9), torsoTop - 6, 6, 5);
    } else {
      this.px(ctx, pal.skin, cx + (dir > 0 ? 7 : -16), torsoTop + 3, 9, 5);
    }

    // grote kop, ingezonken
    this.px(ctx, pal.skin, cx - 6, headTop, 12, headH);
    this.px(ctx, pal.skinDark, cx - 6, headTop, 3, headH);
    this.px(ctx, pal.eye, cx + (dir > 0 ? 1 : -3), headTop + 4, 3, 2);
    this.px(ctx, '#fff', cx + (dir > 0 ? 2 : -3), headTop + 4, 1, 1);
    this.px(ctx, '#2e3a22', cx - 6, headTop - 1, 12, 2);
    this.px(ctx, '#3a1a1a', cx - 3, headTop + 8, 6, 1); // grommende mond
  },

  /* ---------- MEGA-ZOMBIE BAAS ---------- */
  drawBoss(ctx, cx, footY, dir, z) {
    const skin = '#4a7a2e', skinDk = '#33581e', shirt = '#3a3026', shirtDk = '#241d15';
    const blood = '#8a1f1f', bone = '#cfcab0';
    const ph = (z && z.walkPhase) || 0;
    const sw = (ph === 1) ? 4 : (ph === 3) ? -4 : 0;
    const st = z ? z.atk : 'walk';
    // afmetingen (mega)
    const legH = 26, torsoH = 40, headH = 22;
    const legTop = footY - legH, torsoTop = legTop - torsoH, headTop = torsoTop - headH;

    // dikke poten
    this.px(ctx, shirt, cx - 16, legTop, 12, legH);
    this.px(ctx, shirt, cx + 4, legTop, 12, legH);
    this.px(ctx, '#141414', cx - 16 - sw, footY - 4, 13, 4);
    this.px(ctx, '#141414', cx + 4 + sw, footY - 4, 13, 4);

    // enorme romp
    this.px(ctx, shirt, cx - 20, torsoTop, 40, torsoH);
    this.px(ctx, shirtDk, cx - 20, torsoTop, 5, torsoH);
    // blootliggende ribben + bloed
    this.px(ctx, bone, cx + 4, torsoTop + 8, 12, 2);
    this.px(ctx, bone, cx + 4, torsoTop + 14, 12, 2);
    this.px(ctx, bone, cx + 4, torsoTop + 20, 12, 2);
    this.px(ctx, blood, cx - 10, torsoTop + 12, 10, 6);
    this.px(ctx, skin, cx - 18, torsoTop + 4, 6, 10);

    // gigantische armen + klauwen (pose)
    if (st === 'strike') {
      this.px(ctx, skin, cx + (dir > 0 ? 16 : -44), torsoTop + 6, 28, 9);
      this.px(ctx, skinDk, cx + (dir > 0 ? 42 : -44), torsoTop + 2, 4, 16); // klauw
    } else if (st === 'windup') {
      this.px(ctx, skin, cx + (dir > 0 ? 10 : -22), torsoTop - 12, 12, 10);
      this.px(ctx, skinDk, cx + (dir > 0 ? 10 : -22), torsoTop - 16, 12, 5);
    } else {
      this.px(ctx, skin, cx + (dir > 0 ? 16 : -34), torsoTop + 8, 18, 9);
      this.px(ctx, skinDk, cx + (dir > 0 ? 32 : -34), torsoTop + 6, 4, 12);
    }
    // andere arm (achter)
    this.px(ctx, skinDk, cx + (dir > 0 ? -22 : 16), torsoTop + 10, 8, 7);

    // grote kop
    this.px(ctx, skin, cx - 11, headTop, 22, headH);
    this.px(ctx, skinDk, cx - 11, headTop, 5, headH);
    this.px(ctx, '#2a3a1c', cx - 11, headTop - 2, 22, 3); // haar/rotte kruin
    // gloeiende rode ogen
    this.px(ctx, '#ff2a2a', cx + (dir > 0 ? 0 : -7), headTop + 8, 5, 4);
    this.px(ctx, '#ff7a4a', cx + (dir > 0 ? 1 : -6), headTop + 8, 2, 2);
    // grote grommende muil met tanden
    this.px(ctx, '#1a0a0a', cx - 7, headTop + 15, 14, 4);
    this.px(ctx, bone, cx - 6, headTop + 15, 2, 3);
    this.px(ctx, bone, cx - 2, headTop + 15, 2, 3);
    this.px(ctx, bone, cx + 2, headTop + 15, 2, 3);
    this.px(ctx, blood, cx - 4, headTop + 19, 8, 1); // kwijl/bloed
  },

  /* ---------- FINISH: stok met wapperende vlag ---------- */
  drawFlag(ctx, x, groundY, time, boss) {
    const poleH = 62;
    const top = groundY - poleH;
    // voet in de grond
    this.px(ctx, '#2a313e', x - 4, groundY - 2, 11, 3);
    this.px(ctx, '#3a4456', x - 2, groundY - 4, 6, 3);
    // houten stok
    this.px(ctx, '#8a6438', x, top, 3, poleH);
    this.px(ctx, '#6b4a28', x, top, 1, poleH);   // schaduwkant
    this.px(ctx, '#caa84a', x - 1, top - 2, 4, 2); // knop bovenop

    // driehoekige vlag (pennant) die naar rechts wappert vanaf de top
    const fy = top + 2;        // bovenrand van de vlag
    const len = 26;            // lengte van de punt
    const tall = 16;           // hoogte bij de stok
    const cloth = boss ? '#d94343' : '#6abe30';
    const clothDk = boss ? '#a82e2e' : '#4a8c1f';
    for (let i = 0; i < len; i++) {
      const wave = Math.round(Math.sin(time / 150 + i / 4) * 2);
      const hh = Math.round(tall * (1 - i / len));   // taps mooi naar de punt
      if (hh <= 0) continue;
      this.px(ctx, (i % 6 < 3) ? cloth : clothDk, x + 3 + i, fy + wave, 1, hh);
      this.px(ctx, clothDk, x + 3 + i, fy + wave + hh - 1, 1, 1); // onderrand
    }
    // embleem (doodskop op de laatste-level-vlag)
    if (boss) {
      const sx = x + 8, sy = fy + 5 + Math.round(Math.sin(time / 150 + 2) * 2);
      this.px(ctx, '#f4f8f0', sx, sy, 6, 5);
      this.px(ctx, '#7a1a1a', sx + 1, sy + 1, 1, 2);
      this.px(ctx, '#7a1a1a', sx + 3, sy + 1, 1, 2);
      this.px(ctx, '#f4f8f0', sx + 1, sy + 5, 4, 1);
    }
  },

  /* ---------- DOOD LIJK (blijft liggen) ---------- */
  drawCorpse(ctx, x, groundY, dir, cp) {
    const pal = this.zPal(cp);
    const id = cp.type && cp.type.id;
    const s = id === 'boss' ? 2.4 : id === 'brute' ? 1.4 : 1;
    const d = cp.flip ? -dir : dir;     // willekeurig of hoofd links/rechts ligt
    const y = groundY - 1;

    // bloedplas
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#5e1414';
    ctx.beginPath();
    ctx.ellipse(x, groundY, 14 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // liggend lichaam (horizontaal)
    const bw = Math.round(12 * s), bh = Math.round(5 * s);
    this.px(ctx, pal.shirt, x - bw / 2, y - bh, bw, bh);
    this.px(ctx, pal.shirtDark, x - bw / 2, y - 1, bw, 1);
    this.px(ctx, pal.blood, x - 2, y - bh + 1, 3, 2);

    // gespreide benen aan één kant
    this.px(ctx, pal.pants, x - d * (bw / 2 + 3), y - 3, Math.round(5 * s), 2);
    this.px(ctx, pal.pants, x - d * (bw / 2 + 2), y - 1, Math.round(5 * s), 2);

    // arm gespreid
    this.px(ctx, pal.skin, x + d * 1, y - bh - 1, Math.round(5 * s), 2);

    // hoofd aan de andere kant
    const hx = x + d * (bw / 2 + Math.round(3 * s));
    const hr = Math.round(5 * s);
    this.px(ctx, pal.skin, hx - hr / 2, y - hr, hr, hr);
    this.px(ctx, pal.skinDark, hx - hr / 2, y - 1, hr, 1);
    // dood (X-)oog
    this.px(ctx, '#3a1a1a', hx - 1, y - hr + 1, 2, 2);
  },

  /* ---------- MUNITIEDOOSJE (grond-pickup) ---------- */
  drawAmmoBox(ctx, x, y, bob) {
    const oy = Math.round(Math.sin(bob) * 1); // klein dobber-effectje
    const top = y - 7 + oy;
    // kogels die uit het doosje steken
    this.px(ctx, '#caa84a', x - 3, top - 3, 2, 3);
    this.px(ctx, '#caa84a', x, top - 3, 2, 3);
    this.px(ctx, '#e8c860', x - 3, top - 3, 2, 1);
    this.px(ctx, '#e8c860', x, top - 3, 2, 1);
    // doosje
    this.px(ctx, '#4a5a2e', x - 5, top, 11, 7);
    this.px(ctx, '#5e7038', x - 5, top, 11, 2);
    this.px(ctx, '#2e3a1c', x - 5, top + 6, 11, 1);
    // bandje + tekst-suggestie
    this.px(ctx, '#caa84a', x - 5, top + 3, 11, 1);
  },

  /* ---------- EHBO-DOOSJE (grond-pickup) ---------- */
  drawHealthBox(ctx, x, y, bob) {
    const oy = Math.round(Math.sin(bob) * 1);
    const top = y - 9 + oy;
    // wit doosje
    this.px(ctx, '#e8ecf1', x - 5, top, 11, 9);
    this.px(ctx, '#ffffff', x - 5, top, 11, 2);
    this.px(ctx, '#b8c0cc', x - 5, top + 8, 11, 1);
    // rood kruis
    this.px(ctx, '#d94343', x - 1, top + 2, 3, 5);
    this.px(ctx, '#d94343', x - 3, top + 3, 7, 3);
    this.px(ctx, '#ff6b6b', x - 1, top + 2, 1, 5);
  },

  /* ---------- OBSTAKELS ---------- */
  drawObstacle(ctx, o, groundY) {
    if (o.type === 'car') {
      const x = o.x, w = o.w, top = groundY - o.h;
      // wielen
      this.px(ctx, '#0e0e0e', x - w / 2 + 3, groundY - 5, 7, 5);
      this.px(ctx, '#0e0e0e', x + w / 2 - 10, groundY - 5, 7, 5);
      // body
      this.px(ctx, o.color, x - w / 2, groundY - 16, w, 12);
      this.px(ctx, '#00000033', x - w / 2, groundY - 16, w, 3);
      // cabine
      this.px(ctx, o.color, x - w / 2 + 6, top, w - 14, 8);
      // raampjes (kapot)
      this.px(ctx, '#9fb8c8', x - w / 2 + 8, top + 1, 6, 5);
      this.px(ctx, '#6a8090', x + w / 2 - 12, top + 1, 5, 5);
      // roest/bloed
      this.px(ctx, '#5a2a1a', x - 2, groundY - 12, 4, 4);
    } else if (o.type === 'lowbar') {
      const x = o.x, w = o.w;
      const barTop = groundY - 30, barH = 10;
      // steunpalen
      this.px(ctx, '#5a5048', x - w / 2, barTop, 3, 30);
      this.px(ctx, '#5a5048', x + w / 2 - 3, barTop, 3, 30);
      // balk
      this.px(ctx, '#7a6a4a', x - w / 2, barTop, w, barH);
      this.px(ctx, '#9a8a5a', x - w / 2, barTop, w, 3);
      // waarschuwingsstrepen
      for (let i = 0; i < w; i += 6) this.px(ctx, '#caa01e', x - w / 2 + i, barTop + 4, 3, 3);
    } else if (o.type === 'hazard') {
      const x = o.x, w = o.w;
      this.px(ctx, '#1a1410', x - w / 2, groundY, w, 4); // putrand
      // spikes
      for (let i = 0; i < w; i += 5) {
        const sx = x - w / 2 + i;
        this.px(ctx, '#b8c0cc', sx + 1, groundY - 5, 1, 5);
        this.px(ctx, '#cfd6df', sx + 2, groundY - 7, 1, 7);
        this.px(ctx, '#9aa3ad', sx + 3, groundY - 5, 1, 5);
      }
    } else if (o.type === 'barrel') {
      const x = o.x, top = groundY - 20;
      this.px(ctx, '#b33a2a', x - 6, top, 12, 20);          // vat
      this.px(ctx, '#8a2a1e', x - 6, top, 3, 20);           // schaduwkant
      this.px(ctx, '#d9d0b0', x - 6, top + 6, 12, 4);       // band
      this.px(ctx, '#d9d0b0', x - 6, top + 14, 12, 2);
      // gevaar-symbool
      this.px(ctx, '#1a1a1a', x - 2, top + 6, 1, 4);
      this.px(ctx, '#1a1a1a', x, top + 6, 1, 4);
      this.px(ctx, '#1a1a1a', x - 3, top + 9, 5, 1);
    }
  },

  /* ---------- POWER-UP (zwevend, gloeiend) ---------- */
  drawPowerUp(ctx, x, y, kind, bob) {
    const pu = POWERUPS[kind];
    const oy = Math.round(Math.sin(bob) * 2);
    const cy = y - 12 + oy;
    // gloed
    ctx.globalAlpha = 0.22; ctx.fillStyle = pu.color;
    ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // capsule
    this.px(ctx, pu.color, x - 5, cy - 5, 10, 10);
    this.px(ctx, '#ffffff', x - 5, cy - 5, 10, 2);
    this.px(ctx, '#00000033', x - 5, cy + 3, 10, 2);
    // symbool per type
    if (kind === 'rage') {        // zwaard/kruis
      this.px(ctx, '#fff', x - 1, cy - 3, 2, 7);
      this.px(ctx, '#fff', x - 3, cy - 1, 6, 2);
    } else if (kind === 'speed') { // bliksem
      this.px(ctx, '#fff', x, cy - 3, 2, 3);
      this.px(ctx, '#fff', x - 2, cy, 3, 2);
      this.px(ctx, '#fff', x - 1, cy + 1, 2, 3);
    } else {                       // schild
      this.px(ctx, '#fff', x - 3, cy - 3, 6, 4);
      this.px(ctx, '#fff', x - 2, cy + 1, 4, 2);
      this.px(ctx, '#fff', x - 1, cy + 3, 2, 1);
    }
  },

  /* ---------- CHECKPOINT-VLAG (kleiner, halverwege) ---------- */
  drawCheckpoint(ctx, x, groundY, time, reached) {
    const poleH = 40, top = groundY - poleH;
    this.px(ctx, '#2a313e', x - 3, groundY - 2, 8, 3);          // voet
    this.px(ctx, '#9aa3ad', x, top, 2, poleH);                   // paal
    // klein driehoekig vlaggetje (blauw -> groen als gehaald)
    const cloth = reached ? '#6abe30' : '#3a9ad9';
    const clothDk = reached ? '#4a8c1f' : '#2a72a8';
    const len = 16, tall = 11;
    for (let i = 0; i < len; i++) {
      const wave = Math.round(Math.sin(time / 150 + i / 3.5) * 1.5);
      const hh = Math.round(tall * (1 - i / len));
      if (hh <= 0) continue;
      this.px(ctx, (i % 6 < 3) ? cloth : clothDk, x + 2 + i, top + 2 + wave, 1, hh);
    }
    if (reached) this.px(ctx, '#fff', x + 4, top + 4, 3, 3);     // vinkje-achtig stipje
  },

  /* ---------- SCHADUW onder personage ---------- */
  shadow(ctx, cx, footY, w) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, footY + 1, w, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  /* ---------- BAAS-PROJECTIEL (zuur) ---------- */
  drawEnemyShot(ctx, x, y, spin) {
    // gloed
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#8aff3a';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // klodder
    this.px(ctx, '#6abe30', x - 4, y - 3, 8, 6);
    this.px(ctx, '#8aff3a', x - 3, y - 3, 5, 3);
    this.px(ctx, '#3f7a18', x - 4, y + 2, 8, 1);
    // spat-druppels (draaiend)
    const o = Math.round(Math.sin(spin) * 2);
    this.px(ctx, '#6abe30', x - 6, y + o, 2, 2);
    this.px(ctx, '#6abe30', x + 4, y - o, 2, 2);
  },

  /* ---------- ZWAKKE PLEK (baas-hoofd) ---------- */
  drawWeakpoint(ctx, cx, cy, halfW, time) {
    const pulse = (Math.sin(time / 220) + 1) / 2;
    const col = pulse > 0.5 ? '#ff4a3a' : '#ffd24a';
    const w = halfW + 5, h = 17, L = 4;
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    // hoek-haakjes rond de kop (richtkruis)
    this.px(ctx, col, cx - w, cy - h, L, 1); this.px(ctx, col, cx - w, cy - h, 1, L);
    this.px(ctx, col, cx + w - L, cy - h, L, 1); this.px(ctx, col, cx + w - 1, cy - h, 1, L);
    this.px(ctx, col, cx - w, cy + h - 1, L, 1); this.px(ctx, col, cx - w, cy + h - L, 1, L);
    this.px(ctx, col, cx + w - L, cy + h - 1, L, 1); this.px(ctx, col, cx + w - 1, cy + h - L, 1, L);
    // bobbende pijl erboven
    const oy = Math.round(Math.sin(time / 220) * 2);
    this.px(ctx, col, cx - 3, cy - h - 8 + oy, 6, 2);
    this.px(ctx, col, cx - 2, cy - h - 6 + oy, 4, 2);
    this.px(ctx, col, cx - 1, cy - h - 4 + oy, 2, 2);
    ctx.globalAlpha = 1;
  },

  /* ---------- RAKET (projectiel) ---------- */
  drawRocket(ctx, x, y, vx) {
    const d = vx >= 0 ? 1 : -1;
    this.px(ctx, '#ffd24a', x - d * 7, y - 1, 3, 2);   // vlam
    this.px(ctx, '#ff8a3a', x - d * 5, y - 2, 3, 4);
    this.px(ctx, '#4a5158', x - 4, y - 2, 8, 4);       // body
    this.px(ctx, '#6a737c', x - 4, y - 2, 8, 1);
    this.px(ctx, '#d94343', x + d * 4, y - 1, 2, 2);   // rode neus
    this.px(ctx, '#2a2e34', x - d * 4, y - 3, 2, 1);   // vinnen
    this.px(ctx, '#2a2e34', x - d * 4, y + 2, 2, 1);
  },

  /* ---------- RAKET-PICKUP ---------- */
  drawRocketPickup(ctx, x, y, bob) {
    const oy = Math.round(Math.sin(bob) * 1), top = y - 9 + oy;
    this.px(ctx, '#4a5158', x - 5, top + 3, 11, 4);
    this.px(ctx, '#6a737c', x - 5, top + 3, 11, 1);
    this.px(ctx, '#d94343', x + 5, top + 2, 3, 5);     // kop
    this.px(ctx, '#2a2e34', x - 6, top + 1, 2, 3);     // vin
    this.px(ctx, '#2a2e34', x - 6, top + 5, 2, 3);
    this.px(ctx, '#ffd24a', x - 7, top + 4, 1, 2);     // staartvlam
  },

  /* ---------- KOGEL ---------- */
  drawBullet(ctx, x, y) {
    this.px(ctx, '#ffd24a', x, y, 4, 2);
    this.px(ctx, '#ff8a3a', x, y, 1, 2);
  },

  /* ---------- MUNT (zwevend) ---------- */
  drawCoin(ctx, x, y, frame) {
    const w = [4, 3, 1, 3][frame % 4]; // draai-effect
    this.px(ctx, '#b8901e', x + (4 - w) / 2, y, w, 5);
    this.px(ctx, '#f2c94c', x + (4 - w) / 2, y, Math.max(1, w - 1), 4);
  },

  /* ---------- WAPEN ICOON (voor shop) ---------- */
  drawWeaponIcon(ctx, weaponId, scale) {
    ctx.save();
    ctx.scale(scale, scale);
    const cx = 26, y = 24;
    const w = WEAPONS[weaponId];
    if (w.type === 'melee') {
      if (weaponId === 'machete') {
        this.px(ctx, '#cfd6df', cx - 12, y - 8, 20, 5);
        this.px(ctx, '#9aa3ad', cx - 12, y - 8, 20, 2);
        this.px(ctx, '#5a3a22', cx + 6, y - 9, 6, 7);
      } else {
        this.px(ctx, '#7a5230', cx - 12, y - 7, 16, 5);
        this.px(ctx, '#9a6a3a', cx - 12, y - 7, 16, 2);
        this.px(ctx, '#5a3a22', cx + 2, y - 6, 6, 4);
      }
    } else {
      const body = '#3a3f46', dark = '#23262b', wood = '#6b4a2a';
      if (weaponId === 'pistol') {
        this.px(ctx, body, cx - 8, y - 6, 14, 5);
        this.px(ctx, dark, cx - 4, y - 1, 4, 7);
      } else if (weaponId === 'uzi') {
        this.px(ctx, body, cx - 12, y - 6, 20, 5);
        this.px(ctx, dark, cx - 4, y - 1, 4, 9);
        this.px(ctx, dark, cx + 6, y - 8, 3, 4);
      } else if (weaponId === 'ak47') {
        this.px(ctx, body, cx - 16, y - 6, 30, 5);
        this.px(ctx, wood, cx + 8, y - 6, 8, 5);
        this.px(ctx, wood, cx - 16, y - 6, 5, 5);
        this.px(ctx, dark, cx - 2, y - 1, 5, 9);
      } else if (weaponId === 'rocket') {
        this.px(ctx, '#3a4750', cx - 16, y - 6, 26, 6);    // buis
        this.px(ctx, '#566872', cx - 16, y - 6, 26, 2);
        this.px(ctx, dark, cx - 6, y, 5, 8);               // handvat
        this.px(ctx, '#d94343', cx + 8, y - 7, 5, 8);      // raketkop steekt eruit
        this.px(ctx, '#ffd24a', cx - 18, y - 4, 3, 3);     // achteruitlaat
      }
    }
    ctx.restore();
  },
};
