/**
 * WAAPI masked text reveals for data-reveal="chars" and data-reveal="lines".
 * Respects prefers-reduced-motion and briefly waits for web fonts.
 */

const VEIL_EASE = 'cubic-bezier(0.165, 1, 0.32, 1)';
const FONT_WAIT_MS = 1200;

function splitChars(el) {
  const originalText = el.textContent.replace(/\s+/g, ' ').trim();

  const units = [];
  const childNodes = Array.from(el.childNodes);
  el.textContent = '';

  // Screen readers get the intact text; the per-character spans are aria-hidden.
  // (aria-label is not reliably exposed on generic elements such as <p>.)
  const srText = document.createElement('span');
  srText.className = 'sr-only';
  srText.textContent = originalText;
  el.appendChild(srText);

  childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      el.appendChild(document.createElement('br'));
      return;
    }

    const text = node.textContent || '';
    const tokens = text.split(/(\s+)/);
    tokens.forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        el.appendChild(document.createTextNode(' '));
        return;
      }

      const wordSpan = document.createElement('span');
      wordSpan.className = 'reveal-word';
      wordSpan.setAttribute('aria-hidden', 'true');

      for (const ch of Array.from(token)) {
        const mask = document.createElement('span');
        mask.className = 'reveal-mask';
        const inner = document.createElement('span');
        inner.className = 'reveal-unit';
        inner.textContent = ch;
        inner.style.transform = 'translate3d(0, 108%, 0)';
        mask.appendChild(inner);
        wordSpan.appendChild(mask);
        units.push(inner);
      }

      el.appendChild(wordSpan);
    });
  });

  el.classList.add('is-split');
  return units;
}

function splitLines(el) {
  // Wrap content in a single clean masked container (or preserve <br> segments)
  const segments = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = '';
  const units = [];

  segments.forEach((seg) => {
    const trimmed = seg.trim();
    if (!trimmed) return;
    const mask = document.createElement('span');
    mask.className = 'reveal-line-mask';
    const inner = document.createElement('span');
    inner.className = 'reveal-line-inner';
    inner.innerHTML = trimmed;
    inner.style.transform = 'translate3d(0, 112%, 0)';
    mask.appendChild(inner);
    el.appendChild(mask);
    units.push(inner);
  });

  el.classList.add('is-split');
  return units;
}

export async function initTextReveals({ reducedMotion = false } = {}) {
  const targets = Array.from(document.querySelectorAll('[data-reveal]'));
  const registry = new Map();

  if (reducedMotion) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return {
      play(el) {
        if (el) el.classList.add('is-revealed');
      },
    };
  }

  // Wait for web fonts so glyph widths are final, but never longer than FONT_WAIT_MS
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => {
        setTimeout(resolve, FONT_WAIT_MS);
      }),
    ]);
  } catch {
    // Proceed even if the Font Loading API rejects
  }

  targets.forEach((el) => {
    const mode = el.dataset.reveal || 'lines';
    const units = mode === 'chars' ? splitChars(el) : splitLines(el);
    registry.set(el, { mode, units, played: false });
  });

  function play(el, delayMs = 0) {
    const entry = registry.get(el);
    if (!entry) return;
    entry.played = true;
    const isChars = entry.mode === 'chars';
    const duration = isChars ? 900 : 560;
    const stagger = isChars ? 18 : 75;
    const startY = isChars ? '108%' : '112%';

    entry.units.forEach((unit, idx) => {
      unit.getAnimations().forEach((a) => a.cancel());
      unit.animate(
        [
          { transform: `translate3d(0, ${startY}, 0)` },
          { transform: 'translate3d(0, 0, 0)' },
        ],
        {
          duration,
          delay: delayMs + idx * stagger,
          easing: VEIL_EASE,
          fill: 'both',
        },
      );
    });
  }

  // IntersectionObserver for scroll-revealed copy (excludes manual pinned-stage titles)
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((item) => {
        if (!item.isIntersecting) return;
        const entry = registry.get(item.target);
        if (entry && !entry.played) {
          play(item.target, 0);
        }
        observer.unobserve(item.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );

  targets.forEach((el) => {
    if (el.closest('#dish-hero')) return;
    observer.observe(el);
  });

  return { play };
}
