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

    // ---- touch/pointer knoppen ----
    // Pointer Events + pointer-capture = direct reagerend, en de knop blijft
    // ingedrukt ook als je duim een beetje verschuift (geen "release" bij drift).
    document.querySelectorAll('.tbtn').forEach((btn) => {
      const key = btn.dataset.key;
      const press = (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        if (key === 'jump' && !this.state.jump) this.jumpPressed = true;
        this.state[key] = true;
      };
      const release = (e) => { e.preventDefault(); this.state[key] = false; };
      if (window.PointerEvent) {
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
      } else {
        // fallback voor heel oude browsers
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
      }
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  },

  // reset 'pressed' flags aan einde van frame
  endFrame() { this.jumpPressed = false; },

  clear() {
    this.state.left = this.state.right = this.state.jump = this.state.duck = this.state.attack = this.state.melee = false;
    this.jumpPressed = false;
  },

  // is dit waarschijnlijk een touch-apparaat?
  isTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }
};
