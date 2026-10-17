/* Semantic web navigation inside a one-slide-at-a-time presentation. */
(() => {
  'use strict';

  function boot() {
    const stage = document.getElementById('stage');
    const slides = [...document.querySelectorAll('section.slide')]
      .sort((a, b) => Number(a.dataset.slide) - Number(b.dataset.slide));
    if (!stage || !slides.length) return;

    const indexes = new Map(slides.map((slide, index) => [slide.id, index]));
    const previous = document.getElementById('prev');
    const next = document.getElementById('next');
    const nextLabel = document.getElementById('next-label');
    const counter = document.getElementById('counter');
    const chapterName = document.getElementById('chapter-name');
    const announcement = document.getElementById('announcement');
    const fullscreenButton = document.getElementById('fullscreen');
    const printButton = document.getElementById('print');
    const chapterLinks = [...document.querySelectorAll('a[data-chapter]')];
    const menuButtons = [...document.querySelectorAll('button[data-open]')];
    const dialogs = ['chapter-menu', 'sources-menu']
      .map(id => document.getElementById(id))
      .filter(dialog => dialog?.tagName === 'DIALOG');
    const deck = document.getElementById('deck-main') ||
      document.getElementById('deckmain') || document.getElementById('deck') || stage;
    const pad = value => String(value).padStart(2, '0');
    let current = -1;
    let lastHandledHash;
    let fullscreenPending = false;
    let touchStart = null;

    function elementFromEvent(event) {
      return event.target instanceof Element ? event.target : event.target?.parentElement;
    }

    function indexFromHash(hash) {
      let id;
      try { id = decodeURIComponent(hash.replace(/^#/, '')); }
      catch { return undefined; }
      if (indexes.has(id)) return indexes.get(id);
      const legacy = id.match(/^slide-(\d+)$/);
      if (!legacy) return undefined;
      const index = Number(legacy[1]) - 1;
      return index >= 0 && index < slides.length ? index : undefined;
    }

    function setMenuExpanded(id, expanded) {
      for (const button of menuButtons) {
        if (button.dataset.open === id) button.setAttribute('aria-expanded', String(expanded));
      }
    }

    function closeMenus() {
      for (const dialog of dialogs) {
        if (dialog.open && typeof dialog.close === 'function') dialog.close();
      }
    }

    function openMenu(id) {
      const dialog = dialogs.find(item => item.id === id);
      if (!dialog || dialog.open || typeof dialog.showModal !== 'function') return;
      dialog.showModal();
      setMenuExpanded(id, true);
    }

    function focusTitle(slide) {
      const heading = slide.querySelector('h1, h2');
      if (!heading) return;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }

    function show(index, { historyMode = 'push', focusHeading = false } = {}) {
      const selected = Math.max(0, Math.min(slides.length - 1, index));
      const active = slides[selected];
      const changed = selected !== current;
      current = selected;

      slides.forEach((slide, position) => {
        const visible = position === selected;
        slide.hidden = !visible;
        slide.inert = !visible;
        slide.setAttribute('aria-hidden', String(!visible));
        slide.classList.toggle('active', visible);
      });
      if (changed || focusHeading) active.scrollTop = 0;
      stage.dataset.theme = active.dataset.theme ||
        (active.classList.contains('light') ? 'light' : 'dark');

      if (previous) previous.disabled = selected === 0;
      if (counter) counter.textContent = `${pad(selected + 1)} / ${pad(slides.length)}`;
      const title = active.dataset.title || active.querySelector('h1, h2')?.textContent.trim() || '';
      if (chapterName) chapterName.textContent = title;
      if (next) next.setAttribute('href', `#${slides[(selected + 1) % slides.length].id}`);
      if (nextLabel) nextLabel.textContent = active.dataset.next ||
        (selected === slides.length - 1 ? 'Torna all’inizio' : 'Continua');

      for (const link of chapterLinks) {
        if (link.dataset.chapter === active.dataset.chapter) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }

      const hash = `#${active.id}`;
      if (historyMode === 'replace') history.replaceState(history.state, '', hash);
      else if (historyMode === 'push' && location.hash !== hash) {
        history.pushState(history.state, '', hash);
      }
      lastHandledHash = location.hash;
      if (announcement && changed) {
        announcement.textContent = `Slide ${selected + 1} di ${slides.length}. ${title}`;
      }
      if (focusHeading) focusTitle(active);
    }

    function syncFromLocation() {
      if (location.hash === lastHandledHash) return;
      const selected = indexFromHash(location.hash) ?? 0;
      const canonical = `#${slides[selected].id}`;
      show(selected, { historyMode: location.hash === canonical ? 'none' : 'replace' });
    }

    function updateFullscreenLabel() {
      if (!fullscreenButton) return;
      const active = Boolean(document.fullscreenElement);
      const label = active ? 'Esci dallo schermo intero' : 'Attiva schermo intero';
      fullscreenButton.setAttribute('aria-label', label);
      fullscreenButton.setAttribute('aria-pressed', String(active));
      fullscreenButton.title = `${label} (F)`;
    }

    async function toggleFullscreen() {
      if (fullscreenPending) return;
      fullscreenPending = true;
      try {
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        } else if (typeof document.documentElement.requestFullscreen === 'function') {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // The browser can refuse fullscreen; ordinary navigation remains available.
      } finally {
        fullscreenPending = false;
        updateFullscreenLabel();
      }
    }

    document.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey) return;
      const target = elementFromEvent(event);
      if (!target) return;
      const opener = target.closest('button[data-open]');
      if (opener) {
        event.preventDefault();
        openMenu(opener.dataset.open);
        return;
      }
      const closer = target.closest('button[data-close]');
      if (closer) {
        const dialog = dialogs.find(item => item.id === closer.dataset.close) || closer.closest('dialog');
        if (dialog?.open && typeof dialog.close === 'function') {
          event.preventDefault();
          dialog.close();
        }
        return;
      }

      const link = target.closest('a[href]');
      if (!link) return;
      const fromDialog = Boolean(link.closest('dialog[open]'));
      if (link.hasAttribute('download') ||
          (link.target && link.target.toLowerCase() !== '_self')) {
        if (fromDialog) closeMenus();
        return;
      }
      const href = link.getAttribute('href');
      const index = href.startsWith('#') ? indexFromHash(href) : undefined;
      if (index === undefined) {
        if (fromDialog) closeMenus();
        return;
      }
      event.preventDefault();
      const fromSlide = Boolean(link.closest('section.slide'));
      closeMenus();
      show(index, { focusHeading: fromSlide || fromDialog });
    });

    for (const dialog of dialogs) {
      dialog.addEventListener('close', () => setMenuExpanded(dialog.id, false));
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
    }
    for (const button of menuButtons) {
      if (dialogs.some(dialog => dialog.id === button.dataset.open)) {
        button.setAttribute('aria-controls', button.dataset.open);
        button.setAttribute('aria-expanded', 'false');
      }
    }

    previous?.addEventListener('click', () => show(current - 1));
    fullscreenButton?.addEventListener('click', toggleFullscreen);
    printButton?.addEventListener('click', () => window.print());
    document.addEventListener('fullscreenchange', updateFullscreenLabel);
    window.addEventListener('popstate', syncFromLocation);
    window.addEventListener('hashchange', syncFromLocation);

    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey ||
          event.isComposing || document.querySelector('dialog[open]')) return;
      const target = elementFromEvent(event);
      if (target?.isContentEditable ||
          target?.closest('input, textarea, select, [role="textbox"]')) return;
      if (event.key === ' ' && target?.closest('button, a')) return;
      let destination;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') destination = current + 1;
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') destination = current - 1;
      else if (event.key === 'Home') destination = 0;
      else if (event.key === 'End') destination = slides.length - 1;
      else if (event.key === ' ') destination = current + (event.shiftKey ? -1 : 1);
      else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleFullscreen();
        return;
      } else if (event.key.toLowerCase() === 'i') {
        event.preventDefault();
        openMenu('chapter-menu');
        return;
      }
      if (destination !== undefined) {
        event.preventDefault();
        show(destination);
      }
    });

    deck.addEventListener('touchstart', event => {
      const target = elementFromEvent(event);
      if (event.touches.length !== 1 || document.querySelector('dialog[open]') ||
          target?.closest('a, button, input, textarea, select, [contenteditable]')) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    deck.addEventListener('touchend', event => {
      const start = touchStart;
      touchStart = null;
      if (!start || document.querySelector('dialog[open]')) return;
      const touch = [...event.changedTouches].find(item => item.identifier === start.identifier);
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        show(current + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
    deck.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

    show(indexFromHash(location.hash) ?? 0, { historyMode: 'replace' });
    updateFullscreenLabel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else boot();
})();
