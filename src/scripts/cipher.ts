const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ·—|@./';

export function initCipher(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLElement>('[data-cipher]').forEach(decodeEl);
  document.querySelectorAll<HTMLElement>('[data-cipher-hover]').forEach((el) => {
    const target = el.textContent ?? '';
    el.addEventListener('mouseenter', () => scramble(el, target, 280));
  });
}

function decodeEl(el: HTMLElement): void {
  const target = el.textContent?.trim() ?? '';
  if (!target) return;
  el.style.visibility = 'visible';
  scramble(el, target, 900);
}

function scramble(el: HTMLElement, target: string, duration: number): void {
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const progress = t * t * (3 - 2 * t);
    const revealed = Math.floor(progress * target.length);
    let out = '';
    for (let i = 0; i < target.length; i++) {
      if (i < revealed) out += target[i];
      else out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
    }
    el.textContent = out;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('js');
  initCipher();
}
