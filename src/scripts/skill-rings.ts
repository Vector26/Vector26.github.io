type RingData = { id: string; name: string; glyphs: string; skills: string[] };

const ACCENT = '110, 231, 255';
const CYCLE_MS = 2600;

export function initSkillRings(canvas: HTMLCanvasElement, rings: RingData[]): void {
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;
  if (!ctx || !wrap) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const section = canvas.closest<HTMLElement>('.rings') ?? wrap;
  const badges = [...document.querySelectorAll<HTMLButtonElement>('.rings__badge')];
  const index = rings.flatMap((r, ri) => r.skills.map((_, si) => ({ ri, si })));

  let active = 0;
  let userPicked = false;
  let lastCycle = performance.now();
  let spin = 0;
  let align = 0;
  let w = 0;
  let h = 0;
  let visible = false;
  let raf = 0;

  const setActive = (i: number) => {
    active = (i + index.length) % index.length;
    badges.forEach((b, k) => b.classList.toggle('is-active', k === active));
  };
  badges.forEach((btn, i) =>
    btn.addEventListener('click', () => {
      userPicked = true;
      setActive(i);
      if (!visible) draw(performance.now());
    }),
  );

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = wrap.clientWidth;
    h = wrap.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!visible) draw(performance.now());
  };

  // 0 when the section top enters the viewport, 1 when the canvas is centred.
  const scrollProgress = () => {
    const r = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = (vh - r.top) / (vh / 2 + r.height / 2);
    return Math.min(1, Math.max(0, p));
  };

  const label = (text: string, x: number, y: number, angle: number, size: number, hot: boolean) => {
    ctx.font = `${hot ? 600 : 400} ${size}px "Geist Mono Variable", ui-monospace, monospace`;
    const tw = ctx.measureText(text).width;
    const padX = 6;
    const bh = size + 8;
    const gap = 10;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let bx = x + cos * gap + (cos > 0.35 ? 0 : cos < -0.35 ? -(tw + padX * 2) : -(tw / 2 + padX));
    let by = y + sin * gap + (sin > 0.35 ? 0 : sin < -0.35 ? -bh : -bh / 2);
    bx = Math.min(w - tw - padX * 2 - 4, Math.max(4, bx));
    by = Math.min(h - bh - 4, Math.max(4, by));
    ctx.fillStyle = hot ? `rgba(${ACCENT}, 0.14)` : 'rgba(8, 9, 10, 0.82)';
    ctx.strokeStyle = hot ? `rgba(${ACCENT}, 0.6)` : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + padX * 2, bh, bh / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hot ? `rgb(${ACCENT})` : 'rgba(232, 234, 237, 0.85)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, bx + padX, by + bh / 2 + 0.5);
  };

  const draw = (now: number) => {
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const size = Math.round(Math.min(13, Math.max(10, Math.min(w, h) / 36)));
    const outer = Math.min(w, h) / 2 - (size + 14);
    const inner = outer * 0.3;
    const step = rings.length > 1 ? (outer - inner) / (rings.length - 1) : 0;
    const { ri: activeRing, si: activeSkill } = index[active];

    rings.forEach((ring, ri) => {
      const r = inner + step * ri;
      const isActive = ri === activeRing;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${ACCENT}, ${isActive ? 0.55 : 0.14 + ri * 0.04})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      const n = ring.skills.length;
      const phase = spin * (ri % 2 ? -1 : 1) * (0.6 + ri * 0.15) + (1 - align) * (ri + 1) * 0.9;
      ring.skills.forEach((skill, si) => {
        const a = -Math.PI / 2 + (si + 0.5) * ((Math.PI * 2) / n) + phase;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const hot = isActive && si === activeSkill;
        if (hot) {
          ctx.fillStyle = `rgba(${ACCENT}, 0.18)`;
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hot ? `rgb(${ACCENT})` : isActive ? 'rgba(232, 234, 237, 0.9)' : 'rgba(232, 234, 237, 0.35)';
        ctx.beginPath();
        ctx.arc(x, y, hot ? 3.5 : isActive ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (isActive) label(skill, x, y, a, size, hot);
      });
    });

    const ring = rings[activeRing];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(${ACCENT}, 0.8)`;
    ctx.font = `${size - 1}px "Geist Mono Variable", ui-monospace, monospace`;
    ctx.fillText(`RING 0${activeRing + 1}`, cx, cy - size * 0.8);
    ctx.fillStyle = 'rgba(232, 234, 237, 0.9)';
    ctx.font = `600 ${size + 1}px "Geist Variable", system-ui, sans-serif`;
    const maxText = inner * 1.7;
    let name = ring.name;
    while (ctx.measureText(name).width > maxText && name.length > 4) name = `${name.slice(0, -2)}…`;
    ctx.fillText(name, cx, cy + size * 0.6);

    if (!reduced && !userPicked && visible && now - lastCycle > CYCLE_MS) {
      lastCycle = now;
      setActive(active + 1);
    }
  };

  const loop = (now: number) => {
    if (!reduced) spin += 0.0025;
    align += (scrollProgress() - align) * 0.08;
    draw(now);
    raf = visible ? requestAnimationFrame(loop) : 0;
  };

  new ResizeObserver(resize).observe(wrap);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) {
        lastCycle = performance.now();
        raf = requestAnimationFrame(loop);
      }
    },
    { rootMargin: '100px 0px' },
  ).observe(section);
  align = reduced ? 1 : scrollProgress();
  resize();
}

const canvas = document.querySelector<HTMLCanvasElement>('.rings__canvas');
const dataEl = document.getElementById('rings-data');
if (canvas && dataEl?.textContent) {
  initSkillRings(canvas, JSON.parse(dataEl.textContent) as RingData[]);
}
