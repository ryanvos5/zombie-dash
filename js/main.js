/* ============================================================
   MAIN — start alles op.
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  Storage.load();
  Input.init();
  UI.init();
  Game.init(document.getElementById('game-canvas'));
  UI.show('menu');

  // oriëntatie bijhouden (voor de draai-hint) + canvas herschalen
  function updateOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('portrait', portrait);
    Game.resize();
  }
  updateOrientation();
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 250));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateOrientation);

  // pinch-zoom blokkeren (dubbeltik-zoom wordt al door touch-action:none voorkomen)
  document.addEventListener('gesturestart', (e) => e.preventDefault());
});
