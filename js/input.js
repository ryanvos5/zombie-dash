/* ============================================================
   INPUT — toetsenbord + touch knoppen.
   Exposeert Input.state: { left, right, jump, duck, attack }
   ============================================================ */

const Input = {
  state: { left: false, right: false, jump: false, duck: false, attack: false, melee: false },
  // 'pressed' = net dit frame ingedrukt (voor sprong/melee 1x trigger)
  jumpPressed: false,

  init() {
    const keyMap = {
      'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
      'ArrowRight': 'right', 'd': 'right', 'D': 'right',
      'ArrowUp': 'jump', 'w': 'jump', 'W': 'jump', ' ': 'jump',
      'ArrowDown': 'duck', 's': 'duck', 'S': 'duck',
      'j': 'attack', 'J': 'attack', 'f': 'attack', 'F': 'attack',
      'k': 'melee', 'K': 'melee', 'e': 'melee', 'E': 'melee',
    };

    window.addEventListener('keydown', (e) => {
      const action = keyMap[e.key];
      if (action) {
        if (action === 'jump' && !this.state.jump) this.jumpPressed = true;
        this.state[action] = true;
        if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = keyMap[e.key];
      if (action) this.state[action] = false;
    });

    // ---- touch/pointer knoppen (virtuele gamepad) ----
    // Elke vinger wordt los gevolgd en hit-getest tegen de knoppen, zodat je
    // soepel van knop naar knop kunt VEGEN (bv. links -> rechts) en multitouch werkt.
    const buttons = Array.prototype.slice.call(document.querySelectorAll('.tbtn'));
    const ACTKEYS = ['left', 'right', 'jump', 'duck', 'attack', 'melee'];
    this._pointerKey = {};   // pointerId -> key (of null)

    const keyAt = (x, y) => {
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        // iets ruimere raakzone (8px) voor een soepel gevoel
        if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return b.dataset.key;
      }
      return null;
    };
    const recompute = () => {
      const held = {};
      for (const id in this._pointerKey) { const k = this._pointerKey[id]; if (k) held[k] = true; }
      for (const k of ACTKEYS) {
        const now = !!held[k];
        if (k === 'jump' && now && !this.state.jump) this.jumpPressed = true; // edge-trigger
        this.state[k] = now;
      }
      // 'pressed'-klasse voor visuele feedback
      for (const b of buttons) b.classList.toggle('pressed', held[b.dataset.key]);
    };

    // alle vingers vrijgeven (vangnet tegen 'blijvende' knoppen)
    const releaseAll = () => {
      if (Object.keys(this._pointerKey).length === 0) return;
      this._pointerKey = {};
      recompute();
    };

    const onDown = (e) => {
      const k = keyAt(e.clientX, e.clientY);
      if (k == null) return;
      e.preventDefault();
      // impliciete pointer-capture loslaten -> window krijgt move/up betrouwbaar binnen
      try { if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId); } catch (err) {}
      this._pointerKey[e.pointerId] = k;
      recompute();
    };
    const onMove = (e) => {
      if (!(e.pointerId in this._pointerKey)) return; // alleen vingers die op een knop begonnen
      e.preventDefault();
      const k = keyAt(e.clientX, e.clientY);
      if (k !== this._pointerKey[e.pointerId]) { this._pointerKey[e.pointerId] = k; recompute(); }
    };
    const onUp = (e) => {
      if (!(e.pointerId in this._pointerKey)) return;
      delete this._pointerKey[e.pointerId];
      recompute();
    };

    const tc = document.getElementById('touch-controls');
    tc.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    tc.addEventListener('contextmenu', (e) => e.preventDefault());

    // VANGNET 1: zodra er geen enkele vinger meer op het scherm is, alles vrijgeven.
    // Dit fixt 'blijvende' knoppen als een pointerup ooit gemist wordt.
    const onTouchEnd = (e) => { if (!e.touches || e.touches.length === 0) releaseAll(); };
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });

    // VANGNET 2: app naar de achtergrond of venster verliest focus -> niets laten hangen.
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    window.addEventListener('blur', () => releaseAll());
  },

  // reset 'pressed' flags aan einde van frame
  endFrame() { this.jumpPressed = false; },

  clear() {
    this.state.left = this.state.right = this.state.jump = this.state.duck = this.state.attack = this.state.melee = false;
    this.jumpPressed = false;
    this._pointerKey = {};
    document.querySelectorAll('.tbtn.pressed').forEach((b) => b.classList.remove('pressed'));
  },

  // is dit waarschijnlijk een touch-apparaat?
  isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
};
