import Matter from 'matter-js';

/**
 * Flat-vector SVG artwork of kalio ingredients used by the loader physics rain.
 */
const SPICE_SVGS = {
  chili: {
    w: 120,
    h: 220,
    svg: `<svg viewBox="0 0 120 220" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M58 14 C61 28 60 40 56 50" stroke="#4F7A3A" stroke-width="8" stroke-linecap="round"/>
      <path d="M55 46 C80 48 92 78 86 122 C80 164 62 194 40 208 C32 184 36 146 34 112 C32 76 36 46 55 46 Z" fill="#C4281C"/>
      <path d="M64 62 C72 86 70 126 56 168" stroke="#E85A3A" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
    </svg>`,
  },
  limeLeaf: {
    w: 130,
    h: 210,
    svg: `<svg viewBox="0 0 130 210" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M65 18 C92 38 104 72 82 104 C106 130 98 176 65 198 C32 176 24 130 48 104 C26 72 38 38 65 18 Z" fill="#3B6B32"/>
      <path d="M65 26 L65 190" stroke="#76A65B" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,
  },
  turmeric: {
    w: 170,
    h: 120,
    svg: `<svg viewBox="0 0 170 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="85" cy="60" rx="74" ry="42" transform="rotate(-10 85 60)" fill="#C97B23"/>
      <ellipse cx="118" cy="54" rx="28" ry="22" transform="rotate(-10 118 54)" fill="#E87A14"/>
      <ellipse cx="118" cy="54" rx="18" ry="13" transform="rotate(-10 118 54)" fill="#F59B1D"/>
    </svg>`,
  },
  galangal: {
    w: 150,
    h: 150,
    svg: `<svg viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="75" cy="75" r="64" fill="#D5B395"/>
      <circle cx="75" cy="75" r="54" fill="#F2E4CE"/>
      <circle cx="75" cy="75" r="34" stroke="#D9C3A3" stroke-width="3" fill="none"/>
    </svg>`,
  },
  lemongrass: {
    w: 96,
    h: 230,
    svg: `<svg viewBox="0 0 96 230" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M36 22 L62 22 L70 184 C70 202 58 214 48 214 C38 214 26 202 26 184 Z" fill="#A9B96E"/>
      <path d="M32 130 L66 130 L69 184 C69 201 58 212 48 212 C38 212 27 201 27 184 Z" fill="#EFE4C4"/>
      <path d="M48 24 L48 160" stroke="#7A9447" stroke-width="3" opacity="0.6"/>
    </svg>`,
  },
  coconut: {
    w: 160,
    h: 140,
    svg: `<svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="80" cy="72" rx="70" ry="56" fill="#5A371E"/>
      <ellipse cx="80" cy="72" rx="56" ry="44" fill="#F4EAD8"/>
      <ellipse cx="80" cy="72" rx="34" ry="26" fill="#DDD0BA"/>
    </svg>`,
  },
  bayLeaf: {
    w: 120,
    h: 210,
    svg: `<svg viewBox="0 0 120 210" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60 16 C92 52 98 118 60 196 C22 118 28 52 60 16 Z" fill="#2F6329"/>
      <path d="M60 24 L60 192" stroke="#8AB86E" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M60 66 L80 50 M60 98 L84 80 M60 132 L78 116 M60 76 L40 60 M60 110 L36 92 M60 144 L42 128" stroke="#76A85C" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    </svg>`,
  },
};

/**
 * Matter.js 2D falling-item physics stage used by the intro loader.
 */
export function createSpicePhysicsStage(container, {
  items,
  gravity = 3.35,
  onSettled = null,
  settleRatio = 0.78,
} = {}) {
  const { Engine, World, Bodies, Body, Events, Runner, Sleeping } = Matter;
  const rect = container.getBoundingClientRect();
  const stageW = Math.max(rect.width, 200);
  const stageH = Math.max(rect.height, 200);

  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = gravity;

  const wallThick = 200;
  const makeWalls = (w, h) => [
    Bodies.rectangle(w / 2, h + wallThick / 2, w + wallThick * 2, wallThick, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.6,
    }),
    Bodies.rectangle(-wallThick / 2, h / 2 - 400, wallThick, h + 1600, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.6,
    }),
    Bodies.rectangle(w + wallThick / 2, h / 2 - 400, wallThick, h + 1600, {
      isStatic: true,
      restitution: 0.2,
      friction: 0.6,
    }),
  ];

  let walls = makeWalls(stageW, stageH);
  World.add(engine.world, walls);

  const entries = [];
  const fragment = document.createDocumentFragment();

  items.forEach((spec, idx) => {
    const art = SPICE_SVGS[spec.type] || SPICE_SVGS.chili;
    const width = Math.round(spec.width);
    const height = Math.round(width * (art.h / art.w));

    const el = document.createElement('div');
    el.className = 'physics-item';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.innerHTML = art.svg;
    fragment.appendChild(el);

    const x = Math.max(width * 0.5 + 16, Math.min(stageW - width * 0.5 - 16,
      width * 0.25 + Math.random() * Math.max(40, stageW - width * 1.1)));
    const y = -(height + 80) - idx * 68 - Math.random() * 75;

    const body = Bodies.rectangle(x, y, width * 0.78, height * 0.78, {
      chamfer: { radius: Math.min(width, height) * 0.26 },
      restitution: 0.04,
      friction: 0.82,
      frictionAir: 0.03,
      sleepThreshold: 18,
    });
    Body.setAngle(body, (Math.random() - 0.5) * 0.45);
    World.add(engine.world, body);
    entries.push({ el, body, hw: width / 2, hh: height / 2 });
  });

  container.appendChild(fragment);

  let settledFrames = 0;
  let notifiedSettled = false;
  let stopped = false;

  const runner = Runner.create();

  Events.on(engine, 'afterUpdate', () => {
    if (stopped) return;
    let calm = 0;
    let sleepingAll = true;

    for (let i = 0; i < entries.length; i += 1) {
      const { el, body, hw, hh } = entries[i];
      if (body.position.y < 0 && body.isSleeping) {
        Sleeping.set(body, false);
      }
      el.style.transform = `translate3d(${(body.position.x - hw).toFixed(1)}px, ${(body.position.y - hh).toFixed(1)}px, 0) rotate(${body.angle.toFixed(3)}rad)`;
      const isCalm = body.isSleeping || (body.speed < 0.22 && Math.abs(body.angularVelocity) < 0.02);
      if (isCalm && body.position.y > 0) calm += 1;
      if (!body.isSleeping) sleepingAll = false;
    }

    if (!notifiedSettled && entries.length > 0 && calm / entries.length >= settleRatio) {
      settledFrames += 1;
      if (settledFrames >= 8) {
        notifiedSettled = true;
        if (onSettled) onSettled();
      }
    } else {
      settledFrames = 0;
    }

    if (sleepingAll && entries.length > 0) {
      Runner.stop(runner);
    }
  });

  Runner.run(runner, engine);

  const onResize = () => {
    if (stopped) return;
    const next = container.getBoundingClientRect();
    World.remove(engine.world, walls);
    walls = makeWalls(Math.max(next.width, 200), Math.max(next.height, 200));
    World.add(engine.world, walls);
  };
  window.addEventListener('resize', onResize, { passive: true });

  return {
    destroy() {
      if (stopped) return;
      stopped = true;
      window.removeEventListener('resize', onResize);
      Runner.stop(runner);
      World.clear(engine.world, false);
      Engine.clear(engine);
      entries.forEach(({ el }) => el.remove());
    },
  };
}
