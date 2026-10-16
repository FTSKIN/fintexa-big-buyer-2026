(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const controls = document.querySelector('.controls');
  const announcement = document.getElementById('announcement');
  let current = 0;
  let quietTimer;
  const pad = n => String(n).padStart(2, '0');
  function show(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => {
      const active = current === i;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
      if (active) slide.scrollTop = 0;
    });
    document.getElementById('counter').textContent = `${pad(current + 1)} / ${pad(slides.length)}`;
    document.getElementById('progress').style.width = `${((current + 1) / slides.length) * 100}%`;
    document.getElementById('prev').disabled = current === 0;
    document.getElementById('next').disabled = current === slides.length - 1;
    announcement.textContent = slides[current].getAttribute('aria-label');
    history.replaceState(null, '', `#slide-${current + 1}`);
  }
  function revealControls() {
    controls.classList.remove('quiet');
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => controls.classList.add('quiet'), 2600);
  }
  document.getElementById('prev').addEventListener('click', () => show(current - 1));
  document.getElementById('next').addEventListener('click', () => show(current + 1));
  document.getElementById('fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen can be refused by the browser. */ }
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === ' ' && event.target.closest('button, a')) return;
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); show(current + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); show(current - 1); }
    else if (event.key === 'Home') { event.preventDefault(); show(0); }
    else if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
    else if (event.key.toLowerCase() === 'f') document.getElementById('fullscreen').click();
    revealControls();
  });
  let touch = null;
  const stage = document.getElementById('stage');
  stage.addEventListener('touchstart', event => { touch = { x: event.changedTouches[0].screenX, y: event.changedTouches[0].screenY }; }, { passive: true });
  stage.addEventListener('touchend', event => {
    if (!touch) return;
    const dx = event.changedTouches[0].screenX - touch.x;
    const dy = event.changedTouches[0].screenY - touch.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    touch = null;
  }, { passive: true });
  document.addEventListener('pointermove', revealControls, { passive: true });
  document.addEventListener('focusin', revealControls);
  window.addEventListener('hashchange', () => {
    const n = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
    if (n > 0) show(n - 1);
  });
  const initial = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
  show(initial > 0 ? initial - 1 : 0);
  revealControls();
})();
