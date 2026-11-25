import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { initTextReveals } from './reveals.js';
import { initVideoFacade } from './video.js';

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
const isReducedMotion = () => reducedMotionQuery.matches;

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeDonExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// =========================================================
// DOM REFERENCES
// =========================================================
const loaderEl = document.getElementById('loader');
const loaderCounterEl = document.getElementById('loader-counter');
const loaderStageEl = document.getElementById('loader-stage');
const loaderSweepEl = document.getElementById('loader-sweep');
const loaderLineEl = document.getElementById('loader-line');

const pinSection = document.getElementById('beranda');
const stageEl = document.getElementById('stage');
const heroLayer = document.getElementById('hero-layer');
const heroShape = document.getElementById('hero-shape');
const heroCopy = document.getElementById('hero-copy');
const heroRing = document.getElementById('hero-ring');
const heroStage = document.getElementById('hero-stage');
const heroDish = document.getElementById('hero-dish');
const orbitItems = Array.from(document.querySelectorAll('.orbit-item'));
const dishHero = document.getElementById('dish-hero');
const dishHeroTitle = document.getElementById('dish-hero-title');
const dishMetaLeft = document.getElementById('dish-meta-left');
const dishMetaRight = document.getElementById('dish-meta-right');
const motionToggleBtn = document.getElementById('motion-toggle');
const motionToggleLabel = document.getElementById('motion-toggle-label');

const ingredientsArc = document.getElementById('ingredients-arc');
const roleJumpLinks = Array.from(document.querySelectorAll('[data-role-jump]'));

const rolesSection = document.getElementById('peran');
const rolesStage = document.getElementById('roles-stage');
const roleSlides = Array.from(document.querySelectorAll('.role-slide'));
const roleImgs = roleSlides.map((slide) => slide.querySelector('.role-slide__img'));
const roleDots = Array.from(document.querySelectorAll('[data-role-dot]'));
const roleCountEl = document.getElementById('role-count');
const roleProgressFill = document.getElementById('role-progress-fill');
const rolePrevBtn = document.getElementById('role-prev');
const roleNextBtn = document.getElementById('role-next');

const cursorPill = document.getElementById('cursor-pill');
const cursorPillText = document.getElementById('cursor-pill-text');

// =========================================================
// STATE
// =========================================================
let lenis = null;
let revealsApi = null;
let ambientPaused = false;
let stageMode = 'hero';
let pinA = 0;
let pinB = 0;
let heroPinHeight = 0;
let lastPh = '';
let heroStaticDirty = true;
let metricsW = 0;
let metricsH = 0;

// Mobile URL-bar show/hide changes innerHeight by roughly 50-120px while scrolling.
// Recomputing pin distances then would resize the page mid-scroll and make pins jump.
const MOBILE_BAR_TOLERANCE = 160;

const heroState = {
  maxRy: Infinity,
  orbitAngle: 0,
  targetOrbitOffset: 0,
  orbitOffset: 0,
  pointerX: 0,
  pointerY: 0,
  smoothX: 0,
  smoothY: 0,
  pointerPresence: 0,
  isOverHero: false,
  isDragging: false,
  dragStartX: 0,
  dragLastX: 0,
  dragLastT: 0,
  dragVel: 0,
  dragCaptured: false,
  lastScrollY: 0,
};

const rolesState = {
  lastScrolled: -1,
  stepPx: 520,
  travel: 3120,
  activeIdx: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartScroll: 0,
  dragLastX: 0,
  dragLastT: 0,
  dragVel: 0,
  dragCaptured: false,
};

const cursorState = {
  visible: false,
  x: -100,
  y: -100,
  tx: -100,
  ty: -100,
  hideTimer: 0,
};

// =========================================================
// LAYOUT METRICS
// =========================================================
function updateMetrics(force = false) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!force && vw === metricsW && Math.abs(vh - metricsH) < MOBILE_BAR_TOLERANCE) return;
  metricsW = vw;
  metricsH = vh;

  pinA = Math.round(vh * 0.92);
  pinB = Math.round(vh * 0.62);
  document.documentElement.style.setProperty('--pin-a', `${pinA}px`);
  document.documentElement.style.setProperty('--pin-b', `${pinB}px`);

  // Cap the orbit's vertical radius so cutouts never cross the hero title/tagline
  if (heroCopy && orbitItems.length > 0) {
    const copyBottom = heroCopy.offsetTop + heroCopy.offsetHeight;
    const orbitCenterY = parseFloat(getComputedStyle(orbitItems[0]).top) || vh * 0.56;
    const maxHalfH = Math.max(...orbitItems.map((el) => el.offsetHeight)) / 2;
    heroState.maxRy = Math.max(12, orbitCenterY - copyBottom - maxHalfH * 1.05 - 8);
  }

  // One-at-a-time scroll-pinned ingredient role distance
  rolesState.stepPx = Math.max(380, Math.round(vh * 0.66));
  rolesState.travel = Math.max(1, (roleSlides.length - 1) * rolesState.stepPx);
  if (rolesSection) {
    rolesSection.style.setProperty('--roles-travel', `${rolesState.travel}px`);
  }

  heroPinHeight = pinSection ? pinSection.offsetHeight : 0;
  heroStaticDirty = true;
  rolesState.lastScrolled = -1;
}

// =========================================================
// PHYSICS SPICE LOADER
// =========================================================
async function runLoader(onDone = () => {}) {
  if (!loaderEl || isReducedMotion()) {
    if (loaderEl) loaderEl.classList.add('is-done');
    document.body.classList.add('is-intro-header', 'is-intro-hero');
    onDone();
    return;
  }

  lockScroll();
  // Matter.js is only needed for the intro, so it ships as its own lazy chunk
  const { createSpicePhysicsStage } = await import('./physics.js');

  const vw = window.innerWidth;
  const base = vw <= 480 ? 86 : vw <= 1024 ? 114 : 130;
  const spiceOrder = [
    'coconut', 'turmeric', 'galangal', 'lemongrass', 'bayLeaf', 'limeLeaf',
    'chili', 'turmeric', 'galangal', 'bayLeaf', 'lemongrass', 'coconut',
  ];

  let physicsSettled = false;
  let countFinished = false;
  let closingStarted = false;

  const stage = createSpicePhysicsStage(loaderStageEl, {
    gravity: 3.35,
    settleRatio: 0.72,
    items: spiceOrder.map((type, idx) => ({
      type,
      width: base * (0.86 + ((idx * 3) % 5) * 0.06),
    })),
    onSettled() {
      physicsSettled = true;
      maybeClose();
    },
  });

  requestAnimationFrame(() => loaderStageEl.classList.add('is-ready'));

  const startDelay = 100;
  const countDuration = 980;
  const maxWait = vw <= 480 ? 1450 : 1320;
  const t0 = performance.now();

  setTimeout(() => loaderEl.classList.add('is-counting'), startDelay);

  function tickCounter(now) {
    const elapsed = Math.max(0, now - t0 - startDelay);
    const p = clamp(elapsed / countDuration, 0, 1);
    const value = Math.round(easeOutCubic(p) * 100);
    if (loaderCounterEl) loaderCounterEl.textContent = `${value}%`;

    if (p < 1) {
      requestAnimationFrame(tickCounter);
    } else {
      countFinished = true;
      maybeClose();
    }
  }
  requestAnimationFrame(tickCounter);

  const hardTimeout = setTimeout(() => {
    countFinished = true;
    physicsSettled = true;
    maybeClose();
  }, maxWait);

  function maybeClose() {
    if (closingStarted || !countFinished || !physicsSettled) return;
    closingStarted = true;
    clearTimeout(hardTimeout);

    const closeStart = performance.now();
    const closeDur = 1100;
    let headerTriggered = false;
    let heroTriggered = false;
    let contentHidden = false;

    function tickClose(now) {
      const p = clamp((now - closeStart) / closeDur, 0, 1);
      let panelY;
      if (p < 0.5) {
        panelY = 100 - easeDonExpo(p * 2) * 100;
      } else {
        panelY = -easeDonExpo((p - 0.5) * 2) * 106;
      }
      if (loaderSweepEl) {
        loaderSweepEl.style.transform = `translate3d(0, ${panelY.toFixed(2)}%, 0)`;
      }

      if (loaderLineEl) {
        const lp = clamp(p / 0.72, 0, 1);
        const lx = -100 + easeDonExpo(lp) * 100;
        const lOpacity = lp < 0.15 ? lp / 0.15 : 1 - clamp((lp - 0.55) / 0.45, 0, 1);
        loaderLineEl.style.transform = `translate3d(${lx.toFixed(2)}vw, 0, 0)`;
        loaderLineEl.style.opacity = lOpacity.toFixed(2);
      }

      if (!contentHidden && p >= 0.48) {
        contentHidden = true;
        loaderEl.classList.add('is-content-hidden');
      }
      if (!headerTriggered && p >= 0.46) {
        headerTriggered = true;
        document.body.classList.add('is-intro-header');
      }
      if (!heroTriggered && p >= 0.62) {
        heroTriggered = true;
        document.body.classList.add('is-intro-hero');
      }

      if (p < 1) {
        requestAnimationFrame(tickClose);
      } else {
        stage.destroy();
        loaderEl.classList.add('is-done');
        document.documentElement.classList.remove('is-locked');
        if (lenis) lenis.start();
        onDone();
      }
    }

    requestAnimationFrame(tickClose);
  }
}

// =========================================================
// HERO INTERACTIONS
// =========================================================
function initHeroInteractions() {
  if (!heroStage) return;

  heroStage.addEventListener('pointerenter', () => {
    heroState.isOverHero = true;
  });

  heroStage.addEventListener('pointerleave', () => {
    heroState.isOverHero = false;
  });

  window.addEventListener('pointermove', (e) => {
    if (!finePointerQuery.matches) return;
    heroState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    heroState.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  heroStage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    heroState.isDragging = true;
    heroState.dragCaptured = false;
    heroState.dragStartX = e.clientX;
    heroState.dragLastX = e.clientX;
    heroState.dragLastT = performance.now();
    heroState.dragVel = 0;
  });

  window.addEventListener('pointermove', (e) => {
    if (!heroState.isDragging) return;
    const dxTotal = e.clientX - heroState.dragStartX;
    if (!heroState.dragCaptured && Math.abs(dxTotal) > 6) {
      heroState.dragCaptured = true;
      heroStage.classList.add('is-dragging');
    }
    if (!heroState.dragCaptured) return;

    const now = performance.now();
    const dx = e.clientX - heroState.dragLastX;
    const dt = Math.max(8, now - heroState.dragLastT);
    heroState.targetOrbitOffset += dx * 0.24;
    heroState.dragVel = heroState.dragVel * 0.72 + (dx / dt) * 0.28;
    heroState.dragLastX = e.clientX;
    heroState.dragLastT = now;
  }, { passive: true });

  const endHeroDrag = () => {
    if (!heroState.isDragging) return;
    if (heroState.dragCaptured) {
      heroState.targetOrbitOffset += clamp(heroState.dragVel, -2.5, 2.5) * 44;
    }
    heroState.isDragging = false;
    heroState.dragCaptured = false;
    heroStage.classList.remove('is-dragging');
  };

  window.addEventListener('pointerup', endHeroDrag);
  window.addEventListener('pointercancel', endHeroDrag);

  if (motionToggleBtn) {
    motionToggleBtn.addEventListener('click', () => {
      ambientPaused = !ambientPaused;
      motionToggleBtn.classList.toggle('is-paused', ambientPaused);
      if (motionToggleLabel) {
        motionToggleLabel.textContent = ambientPaused ? 'Putar Gerak' : 'Jeda Gerak';
      }
      motionToggleBtn.setAttribute(
        'aria-label',
        ambientPaused ? 'Lanjutkan animasi putaran rempah' : 'Jeda animasi putaran rempah',
      );
    });
  }
}

// =========================================================
// SECTION 3 STAGGERED CARD REVEAL (fallback for no CSS view-timeline)
// =========================================================
function initSectionScrollReveals() {
  const supportsViewTimeline =
    typeof CSS !== 'undefined' &&
    CSS.supports('animation-timeline: scroll()') &&
    CSS.supports('animation-range: 0% 100%');

  if (ingredientsArc && !supportsViewTimeline && !isReducedMotion() && 'IntersectionObserver' in window) {
    ingredientsArc.classList.add('is-stagger-ready');
    const arcIo = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          ingredientsArc.classList.add('is-inview');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.15 },
    );
    arcIo.observe(ingredientsArc);
  }
}

// =========================================================
// SECTION 3B: SCROLL-PINNED INGREDIENT ROLES (One-at-a-Time)
// =========================================================
function scrollToRoleIndex(targetIdx) {
  if (!rolesSection) return;
  const idx = clamp(targetIdx, 0, roleSlides.length - 1);

  if (isReducedMotion()) {
    const slide = roleSlides[idx];
    if (slide) slide.scrollIntoView({ behavior: 'auto', block: 'center' });
    return;
  }

  const sectionTop = rolesSection.getBoundingClientRect().top + window.scrollY;
  const targetY = sectionTop + idx * rolesState.stepPx;
  if (lenis) {
    lenis.scrollTo(targetY, { duration: 0.9, easing: easeOutCubic });
  } else {
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}

function initIngredientRolesControls() {
  if (!rolesSection || !rolesStage) return;

  const stepRole = (dir) => {
    if (isReducedMotion()) return;
    const sectionTop = rolesSection.getBoundingClientRect().top + window.scrollY;
    const currentT = clamp(window.scrollY - sectionTop, 0, rolesState.travel);
    const currentIdx = Math.round(currentT / rolesState.stepPx);
    scrollToRoleIndex(currentIdx + dir);
  };

  if (rolePrevBtn) rolePrevBtn.addEventListener('click', () => stepRole(-1));
  if (roleNextBtn) roleNextBtn.addEventListener('click', () => stepRole(1));

  roleDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      scrollToRoleIndex(Number(dot.dataset.roleDot || 0));
    });
  });

  roleJumpLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToRoleIndex(Number(link.dataset.roleJump || 0));
    });
  });

  rolesStage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepRole(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepRole(-1);
    }
  });

  // Pointer drag-to-scrub through the 7 ingredients
  rolesStage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || isReducedMotion()) return;
    rolesState.isDragging = true;
    rolesState.dragCaptured = false;
    rolesState.dragStartX = e.clientX;
    rolesState.dragLastX = e.clientX;
    rolesState.dragLastT = performance.now();
    rolesState.dragStartScroll = window.scrollY;
    rolesState.dragVel = 0;
  });

  window.addEventListener('pointermove', (e) => {
    if (!rolesState.isDragging) return;
    const dxTotal = e.clientX - rolesState.dragStartX;
    if (!rolesState.dragCaptured && Math.abs(dxTotal) > 6) {
      rolesState.dragCaptured = true;
      rolesStage.classList.add('is-dragging');
    }
    if (!rolesState.dragCaptured) return;

    const now = performance.now();
    const dx = e.clientX - rolesState.dragLastX;
    const dt = Math.max(8, now - rolesState.dragLastT);
    rolesState.dragVel = rolesState.dragVel * 0.76 + (dx / dt) * 0.24;
    rolesState.dragLastX = e.clientX;
    rolesState.dragLastT = now;

    const sectionTop = rolesSection.getBoundingClientRect().top + window.scrollY;
    const targetY = clamp(
      rolesState.dragStartScroll - dxTotal * 1.25,
      sectionTop,
      sectionTop + rolesState.travel,
    );
    if (lenis) {
      lenis.scrollTo(targetY, { immediate: true });
    } else {
      window.scrollTo(0, targetY);
    }
  }, { passive: true });

  const endRoleDrag = () => {
    if (!rolesState.isDragging) return;
    if (rolesState.dragCaptured) {
      const sectionTop = rolesSection.getBoundingClientRect().top + window.scrollY;
      const projected = clamp(
        window.scrollY - rolesState.dragVel * 220,
        sectionTop,
        sectionTop + rolesState.travel,
      );
      const snapIdx = Math.round((projected - sectionTop) / rolesState.stepPx);
      scrollToRoleIndex(snapIdx);
    }
    rolesState.isDragging = false;
    rolesState.dragCaptured = false;
    rolesStage.classList.remove('is-dragging');
  };

  window.addEventListener('pointerup', endRoleDrag);
  window.addEventListener('pointercancel', endRoleDrag);
}

// =========================================================
// CURSOR PILL
// =========================================================
function initCursorPill() {
  if (!cursorPill || !finePointerQuery.matches) return;

  window.addEventListener('pointermove', (e) => {
    cursorState.tx = e.clientX;
    cursorState.ty = e.clientY;
  }, { passive: true });

  document.querySelectorAll('[data-cursor]').forEach((el) => {
    el.addEventListener('pointerenter', () => {
      clearTimeout(cursorState.hideTimer);
      if (cursorPillText) cursorPillText.textContent = el.dataset.cursor || 'JELAJAHI';
      if (!cursorState.visible) {
        const dist = Math.hypot(cursorState.tx - cursorState.x, cursorState.ty - cursorState.y);
        if (dist > 80) {
          cursorState.x = cursorState.tx;
          cursorState.y = cursorState.ty;
        }
      }
      cursorState.visible = true;
      cursorPill.classList.add('is-visible');
    });

    el.addEventListener('pointerleave', () => {
      clearTimeout(cursorState.hideTimer);
      cursorState.hideTimer = setTimeout(() => {
        cursorState.visible = false;
        cursorPill.classList.remove('is-visible');
      }, 90);
    });
  });
}

// =========================================================
// SINGLE REQUESTANIMATIONFRAME CHOREOGRAPHY LOOP
// =========================================================
let lastFrameTime = performance.now();

function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - lastFrameTime) / 1000));
  lastFrameTime = now;

  if (lenis) lenis.raf(now);

  const scrollY = window.scrollY;
  const reduced = isReducedMotion();

  // 1. Hero Dish + 7 Orbiting Ingredient Cutouts + Scroll Transition
  if (pinSection) {
    const heroScrollP = clamp(scrollY / Math.max(pinA, 1), 0, 1);

    // Skip hero transforms entirely once the pinned hero has scrolled out of view
    const heroInView = scrollY < heroPinHeight;

    if (!reduced && heroInView) {
      const deltaY = scrollY - heroState.lastScrollY;
      if (scrollY <= pinA * 1.1) {
        heroState.targetOrbitOffset -= deltaY * 0.09;
      }
      heroState.lastScrollY = scrollY;

      if (!ambientPaused && !heroState.isDragging) {
        heroState.orbitAngle += dt * 4.6;
      }

      const followRate = 1 - Math.exp(-(heroState.isDragging ? 11 : 3.2) * dt);
      heroState.orbitOffset += (heroState.targetOrbitOffset - heroState.orbitOffset) * followRate;

      const pRate = 1 - Math.exp(-3.8 * dt);
      const targetPresence = heroState.isOverHero && finePointerQuery.matches ? 1 : 0;
      heroState.pointerPresence += (targetPresence - heroState.pointerPresence) * pRate;
      heroState.smoothX += (heroState.pointerX - heroState.smoothX) * pRate;
      heroState.smoothY += (heroState.pointerY - heroState.smoothY) * pRate;

      const px = heroState.smoothX * heroState.pointerPresence;
      const py = heroState.smoothY * heroState.pointerPresence;

      if (heroShape) {
        heroShape.style.transform = `translate3d(calc(-50% + ${(px * -14).toFixed(1)}px), ${(Math.max(0, py * -10)).toFixed(1)}px, 0)`;
      }

      const ringDeg = heroState.orbitAngle * 0.65 + heroState.orbitOffset * 0.35;
      if (heroRing) {
        heroRing.style.transform = `translate3d(-50%, 0, 0) rotate(${ringDeg.toFixed(2)}deg)`;
      }

      if (heroDish) {
        const dishScale = 1 + heroScrollP * 0.12;
        const dishRot = heroScrollP * 14 + px * 4;
        const dishY = heroScrollP * -28 + py * 12;
        heroDish.style.transform = `translate3d(${(px * 16).toFixed(1)}px, ${dishY.toFixed(1)}px, 0) rotate(${dishRot.toFixed(2)}deg) scale(${dishScale.toFixed(3)})`;
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isCompactMobile = vw <= 640;
      const baseRx = isCompactMobile ? Math.min(vw * 0.39, 164) : Math.min(vw * 0.35, 435);
      const baseRy = isCompactMobile ? Math.min(vh * 0.17, 132) : Math.min(vh * 0.27, 226);
      const rx = baseRx * (1 + heroScrollP * 0.55);
      const ry = Math.min(baseRy * (1 + heroScrollP * 0.45), heroState.maxRy);
      const totalDeg = heroState.orbitAngle + heroState.orbitOffset;

      for (let i = 0; i < orbitItems.length; i += 1) {
        const el = orbitItems[i];
        const baseDeg = Number(el.dataset.angle || 0);
        const depth = Number(el.dataset.depth || 1);
        const rad = ((baseDeg + totalDeg * (0.82 + (i % 3) * 0.1)) * Math.PI) / 180;
        const ox = Math.cos(rad) * rx + px * 28 * depth;
        const oy = Math.sin(rad) * ry + py * 20 * depth;
        const itemRot = Math.sin(rad + i) * 14 + heroScrollP * (i % 2 === 0 ? 18 : -18);
        const itemScale = (0.88 + depth * 0.12) * (1 - heroScrollP * 0.18);
        el.style.transform = `translate3d(calc(-50% + ${ox.toFixed(1)}px), calc(-50% + ${oy.toFixed(1)}px), 0) rotate(${itemRot.toFixed(1)}deg) scale(${itemScale.toFixed(3)})`;
        el.style.opacity = (1 - heroScrollP * 0.86).toFixed(2);
      }
    } else if (reduced && heroStaticDirty) {
      // Static orbit layout: only recomputed when viewport metrics change
      heroStaticDirty = false;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const isCompactMobile = vw <= 640;
      const rx = isCompactMobile ? Math.min(vw * 0.39, 160) : Math.min(vw * 0.34, 415);
      const ry = Math.min(isCompactMobile ? Math.min(vh * 0.17, 130) : Math.min(vh * 0.26, 218), heroState.maxRy);
      orbitItems.forEach((el) => {
        const rad = (Number(el.dataset.angle || 0) * Math.PI) / 180;
        const ox = Math.cos(rad) * rx;
        const oy = Math.sin(rad) * ry;
        el.style.transform = `translate3d(calc(-50% + ${ox.toFixed(1)}px), calc(-50% + ${oy.toFixed(1)}px), 0)`;
      });
    }

    const switchY = pinA * 0.72;
    // Reduced motion: hero is not pinned, so the dish-reveal layer never takes over
    const nextMode = !reduced && scrollY >= switchY ? 'dish' : 'hero';
    if (nextMode !== stageMode) {
      stageMode = nextMode;
      const isDish = stageMode === 'dish';
      if (heroLayer) heroLayer.classList.toggle('is-faded', isDish);
      if (dishHero) {
        dishHero.classList.toggle('is-active', isDish);
        dishHero.setAttribute('aria-hidden', String(!isDish));
      }
      if (isDish && revealsApi) {
        revealsApi.play(dishHeroTitle, 40);
        revealsApi.play(dishMetaLeft, 220);
        revealsApi.play(dishMetaRight, 320);
      }
    }

    // Scoped to the hero stage and written only on change, to avoid whole-document style recalcs
    const ph = clamp((scrollY - switchY) / Math.max(pinB, 1), 0, 1).toFixed(4);
    if (ph !== lastPh && stageEl) {
      lastPh = ph;
      stageEl.style.setProperty('--ph', ph);
    }
  }

  // 2. Scroll-Pinned One-at-a-Time Ingredient Roles ("Peran Setiap Bahan")
  if (rolesSection && !reduced && roleSlides.length > 0) {
    const rect = rolesSection.getBoundingClientRect();
    const scrolled = clamp(-rect.top, 0, rolesState.travel);
    const exactIdx = scrolled / Math.max(rolesState.stepPx, 1);
    // Slide state depends only on `scrolled`, so skip all writes while it is unchanged
    const rolesChanged = scrolled !== rolesState.lastScrolled;
    rolesState.lastScrolled = scrolled;

    for (let i = 0; rolesChanged && i < roleSlides.length; i += 1) {
      const slide = roleSlides[i];
      const delta = i - exactIdx;
      const absD = Math.abs(delta);

      if (absD >= 1.0) {
        slide.style.opacity = '0';
        slide.style.transform = `translate3d(${(Math.sign(delta) * 26).toFixed(1)}%, 0, 0) scale(0.88)`;
        slide.classList.remove('is-active');
      } else {
        // Smooth cosine crossfade so strictly one ingredient owns center stage at each stop
        const alpha = Math.pow(Math.cos((absD * Math.PI) / 2), 1.5);
        const shiftX = delta * 28;
        const shiftY = absD * 14;
        const scale = 1 - absD * 0.14;
        slide.style.opacity = alpha.toFixed(3);
        slide.style.transform = `translate3d(${shiftX.toFixed(2)}%, ${shiftY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
        slide.classList.toggle('is-active', absD < 0.5);

        const img = roleImgs[i];
        if (img) {
          const rot = delta * 9;
          const imgScale = 1.04 - absD * 0.1;
          img.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${imgScale.toFixed(3)})`;
        }
      }
    }

    const activeIdx = clamp(Math.round(exactIdx), 0, roleSlides.length - 1);
    if (activeIdx !== rolesState.activeIdx) {
      rolesState.activeIdx = activeIdx;
      if (roleCountEl) {
        roleCountEl.textContent = `${String(activeIdx + 1).padStart(2, '0')} / ${String(roleSlides.length).padStart(2, '0')}`;
      }
      roleDots.forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === activeIdx);
      });
    }

    if (roleProgressFill && rolesChanged) {
      const total = Math.max(roleSlides.length, 1);
      const minFill = 1 / total;
      const ratio = (scrolled / Math.max(rolesState.travel, 1)) * (1 - minFill) + minFill;
      roleProgressFill.style.transform = `scaleX(${clamp(ratio, minFill, 1).toFixed(4)})`;
    }
  }

  // 3. Cursor Pill Smooth Lerp
  if (cursorPill && finePointerQuery.matches) {
    const lerpAmt = reduced ? 1 : 0.15;
    cursorState.x += (cursorState.tx - cursorState.x) * lerpAmt;
    cursorState.y += (cursorState.ty - cursorState.y) * lerpAmt;
    const scale = cursorState.visible ? 1 : 0.45;
    cursorPill.style.transform = `translate3d(${cursorState.x.toFixed(1)}px, ${cursorState.y.toFixed(1)}px, 0) translate(18px, -50%) scale(${scale})`;
  }

  requestAnimationFrame(frame);
}

// =========================================================
// IN-PAGE ANCHORS (smooth scroll + real focus move for keyboard users)
// =========================================================
function focusSection(target) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

function scrollToTarget(target, immediate = false) {
  if (lenis) {
    lenis.scrollTo(target, immediate ? { immediate: true, force: true } : { duration: 1.05, easing: easeOutCubic });
  } else {
    target.scrollIntoView({ behavior: immediate || isReducedMotion() ? 'auto' : 'smooth' });
  }
}

function initAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    if (anchor.hasAttribute('data-role-jump')) return;
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      focusSection(target);
      scrollToTarget(target);
      history.replaceState(null, '', id);
    });
  });
}

// Honour a #hash deep link once the intro has finished
function scrollToInitialHash() {
  const { hash } = window.location;
  if (!hash || hash === '#') return;
  let target = null;
  try {
    target = document.querySelector(hash);
  } catch {
    return;
  }
  if (target) scrollToTarget(target, true);
}

function lockScroll() {
  document.documentElement.classList.add('is-locked');
  if (lenis) lenis.stop();
}

// Resolves once the LCP hero image has decoded and been painted, so heavy intro
// work (physics, text splitting) never delays the first meaningful paint.
function afterHeroPaint() {
  const img = document.getElementById('hero-dish-img');
  const decoded = img && typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
  return decoded.then(
    () => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }),
  );
}

// =========================================================
// BOOTSTRAP
// =========================================================
function boot() {
  window.scrollTo(0, 0);
  updateMetrics(true);
  window.addEventListener('resize', () => updateMetrics(), { passive: true });
  // Web fonts change the hero title height, which bounds the orbit radius
  document.fonts?.ready.then(() => updateMetrics(true));

  if (!isReducedMotion()) {
    lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
    });
  }

  initAnchors();
  initVideoFacade();
  initHeroInteractions();
  initSectionScrollReveals();
  initIngredientRolesControls();
  initCursorPill();

  const withIntro = Boolean(loaderEl) && !isReducedMotion();
  if (withIntro) lockScroll();

  afterHeroPaint().then(() => {
    runLoader(scrollToInitialHash);
    requestAnimationFrame(frame);

    initTextReveals({ reducedMotion: isReducedMotion() }).then((api) => {
      revealsApi = api;
      if (stageMode === 'dish') {
        api.play(dishHeroTitle, 0);
        api.play(dishMetaLeft, 120);
        api.play(dishMetaRight, 200);
      }
    });
  });
}

boot();
