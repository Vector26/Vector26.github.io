const KEY = 'vector_booted';

const LINES = [
  { text: 'vector26 // secure boot v1.0', cls: 'grant' },
  { text: '[<i class="ok">ok</i>] loading profile.yaml' },
  { text: '[<i class="ok">ok</i>] syncing substack feed' },
  { text: '[<i class="ok">ok</i>] mounting ~/projects' },
  { text: '[<i class="ok">ok</i>] agent toolchain online' },
  { text: '> access granted', cls: 'grant' },
  { text: '> rendering interface_', cls: 'tag' },
];

export function initBoot(): void {
  const root = document.getElementById('boot');
  if (!root) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;
  try {
    if (sessionStorage.getItem(KEY) === '1' || reduced) {
      root.classList.add('is-removed');
      return;
    }
  } catch {
    /* ignore */
  }

  document.documentElement.style.overflow = 'hidden';
  const finish = () => {
    if (done) return;
    done = true;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    root.classList.add('is-done');
    document.documentElement.style.overflow = '';
    window.setTimeout(() => root.classList.add('is-removed'), 550);
  };

  window.addEventListener('keydown', finish, { once: true });
  root.addEventListener('click', finish);

  const log = document.getElementById('boot-log');
  const fill = document.getElementById('boot-fill');
  const pct = document.getElementById('boot-pct');
  const nodes = LINES.map((line) => {
    const div = document.createElement('div');
    div.className = `boot__line${line.cls ? ` ${line.cls}` : ''}`;
    div.innerHTML = line.text;
    log?.appendChild(div);
    return div;
  });

  let i = 0;
  const step = () => {
    if (done) return;
    if (i < LINES.length && log) {
      nodes[i].classList.add('is-visible');
      const p = Math.round(((i + 1) / LINES.length) * 100);
      if (fill) fill.style.width = `${p}%`;
      if (pct) pct.textContent = String(p).padStart(2, '0') + '%';
      i += 1;
      window.setTimeout(step, 140 + Math.random() * 90);
    } else {
      window.setTimeout(finish, 400);
    }
  };
  window.setTimeout(step, 200);
}

initBoot();
