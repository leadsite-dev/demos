/* Cases rail: endless loop and mouse drag. Local, no network, no storage.
   Progressive enhancement: without this file the rail is a normal finite scroller. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function initRail() {
    const rail = document.querySelector('.rail');
    if (!rail) return;
    const originals = [...rail.children];
    if (originals.length < 2) return;

    const smooth = () => (reduced.matches ? 'auto' : 'smooth');
    const copy = (node) => {
      const el = node.cloneNode(true);
      el.removeAttribute('id');
      el.setAttribute('aria-hidden', 'true');
      return el;
    };
    // One copy before and two after, so a full "page" of scrolling never reaches an edge.
    const before = originals.map(copy);
    rail.prepend(...before);
    rail.append(...originals.map(copy), ...originals.map(copy));
    document.documentElement.classList.add('rail-loop');

    let span = 0;
    const measure = () => { span = originals[0].offsetLeft - before[0].offsetLeft; };
    const setLeft = (left) => {
      rail.style.scrollBehavior = 'auto';
      rail.scrollLeft = left;
      rail.style.scrollBehavior = '';
    };
    // Keep the position inside the original set; a jump of exactly one set is invisible.
    const normalize = () => {
      if (!span) return;
      const offset = rail.scrollLeft - span;
      const wrapped = ((offset % span) + span) % span;
      if (Math.abs(wrapped - offset) > 1) setLeft(span + wrapped);
    };
    measure();
    setLeft(span);

    let settling = false;
    const onScrollEnd = () => {
      if (dragging) return;
      if (settling) { settling = false; rail.classList.remove('settling'); }
      normalize();
    };
    if ('onscrollend' in window) {
      rail.addEventListener('scrollend', onScrollEnd);
    } else {
      let timer = 0;
      rail.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(onScrollEnd, 140); }, { passive: true });
    }
    new ResizeObserver(() => {
      const ratio = span ? (rail.scrollLeft - span) / span : 0;
      measure();
      setLeft(span + ratio * span);
    }).observe(rail);

    /* Drag with mouse or pen. Touch keeps the browser's native swipe. */
    let pressed = false, dragging = false, startX = 0, startLeft = 0, lastX = 0, lastTime = 0, velocity = 0;
    const snapLeft = (left) => {
      const pad = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
      let best = left, distance = Infinity;
      for (const card of rail.children) {
        const candidate = card.offsetLeft - pad;
        const d = Math.abs(candidate - left);
        if (d < distance) { distance = d; best = candidate; }
      }
      return best;
    };
    rail.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      pressed = true;
      startX = lastX = event.clientX;
      startLeft = rail.scrollLeft;
      lastTime = event.timeStamp;
      velocity = 0;
    });
    window.addEventListener('pointermove', (event) => {
      if (!pressed) return;
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 5) return;
        dragging = true;
        settling = false;
        rail.classList.remove('settling');
        rail.classList.add('dragging');
      }
      const dt = event.timeStamp - lastTime;
      if (dt > 0) velocity = 0.75 * velocity + 0.25 * ((event.clientX - lastX) / dt);
      lastX = event.clientX;
      lastTime = event.timeStamp;
      rail.scrollLeft = startLeft - dx;
      event.preventDefault();
    });
    const release = () => {
      if (!pressed) return;
      pressed = false;
      if (!dragging) return;
      dragging = false;
      // A short, capped glide: at most about one and a half cards past the release point.
      const card = originals[0].getBoundingClientRect().width;
      const glide = Math.max(-1.5 * card, Math.min(1.5 * card, -velocity * 260));
      const target = snapLeft(rail.scrollLeft + glide);
      settling = true;
      rail.classList.add('settling');
      rail.classList.remove('dragging');
      rail.scrollTo({ left: target, behavior: smooth() });
      if (Math.abs(target - rail.scrollLeft) < 1) onScrollEnd();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    rail.addEventListener('dragstart', (event) => event.preventDefault());
  }
  initRail();

  /* Scroll-driven fallback for browsers without animation-timeline (Firefox, Safari iOS <= 18):
     IntersectionObserver entrances plus a light scroll-only rAF for the progress bar and the FAB.
     Marks <html class="sda-fallback"> so the matching CSS (@supports not (animation-timeline: view()))
     can start these elements hidden; without this script everything stays visible by default. */
  function initScrollFallback() {
    if (reduced.matches || CSS.supports('animation-timeline: view()')) return;
    const root = document.documentElement;
    root.classList.add('sda-fallback');

    const targets = document.querySelectorAll(
      '.reveal, .stars, .timeline, .about, .area, .area figure img, .office-photo img, .morph');
    if ('IntersectionObserver' in window && targets.length) {
      // threshold: 0 fires on the first visible pixel; a ratio-based threshold can never reach .2
      // for a target taller than ~5 screens (e.g. .area), leaving it stuck invisible after scrolling past it.
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
      targets.forEach((el) => observer.observe(el));
    }

    const progress = document.querySelector('.progress');
    const fab = document.querySelector('.fab');
    if (!progress && !fab) return;
    let pending = false;
    const onScroll = () => {
      pending = false;
      if (progress) {
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      }
      if (fab) fab.classList.toggle('in', scrollY > 380);
    };
    const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(onScroll); } };
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    schedule();
  }
  initScrollFallback();
})();
