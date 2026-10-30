type RingData = { id: string; name: string; glyphs: string; skills: string[] };

export function initSkillRings(canvas: HTMLCanvasElement, rings: RingData[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let angle = 0;
  let active = 0;

  document.querySelectorAll<HTMLButtonElement>('.rings__badge').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rings__badge').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      active = i;
    });
  });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const draw = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;

    rings.forEach((ring, ri) => {
      const r = maxR * (0.35 + ri * 0.22);
      ctx.strokeStyle = `rgba(110, 231, 255, ${0.15 + ri * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      const spin = reduced ? 0 : angle * (0.3 + ri * 0.15);
      ring.skills.forEach((skill, si) => {
        const a = spin + (si / ring.skills.length) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        ctx.fillStyle = active === si + ri * 3 ? '#6ee7ff' : 'rgba(232, 234, 237, 0.5)';
        ctx.font = '10px Geist Mono Variable, monospace';
        ctx.fillText(skill.slice(0, 8), x - 20, y);
      });
    });

    if (!reduced) angle += 0.004;
    requestAnimationFrame(draw);
  };
  draw();
}

const canvas = document.querySelector<HTMLCanvasElement>('.rings__canvas');
const dataEl = document.getElementById('rings-data');
if (canvas && dataEl?.textContent) {
  initSkillRings(canvas, JSON.parse(dataEl.textContent) as RingData[]);
}
