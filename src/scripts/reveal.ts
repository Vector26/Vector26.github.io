const TARGETS = [
  '.desk__head',
  '.desk__screen',
  '.rings .eyebrow',
  '.rings .section-title',
  '.rings .section-lead',
  '.rings__label',
  '.rings__canvas-wrap',
  '.rings__badges',
  '.latest .wrap > *:not(.log)',
  '.log__item',
  '.xp__item',
  '.substack__card',
  '.pin',
  '.ig__grid > li',
].join(',');

function initReveal(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const els = [...document.querySelectorAll<HTMLElement>(TARGETS)].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      let batch = 0;
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        el.style.transitionDelay = `${Math.min(batch++, 6) * 70}ms`;
        el.classList.add('is-in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  for (const el of els) {
    el.dataset.reveal = '';
    io.observe(el);
  }
}

initReveal();
