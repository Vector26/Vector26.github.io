type TermData = {
  name: string;
  tagline: string;
  location: string;
  email: string;
  links: Record<string, string>;
  experience: { company: string; title: string; span: string }[];
  projects: { slug: string; title: string; description: string; href: string; tags: string[]; stars: number }[];
  essays: { slug: string; title: string; href: string; date: string }[];
};

type Part = { text: string; cls?: string };
type Line = { text?: string; parts?: Part[]; cls?: string; href?: string };

type Win = { el: HTMLElement; app: string; placed: boolean };

const isNarrow = (): boolean => window.matchMedia('(max-width: 760px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LAYOUT: Record<string, [number, number, number, number]> = {
  terminal: [0.03, 0.05, 0.56, 0.74],
  finder: [0.41, 0.08, 0.55, 0.64],
  notes: [0.3, 0.12, 0.6, 0.66],
  mail: [0.47, 0.15, 0.48, 0.64],
};

function initWindows(root: HTMLElement): void {
  const screen = root.querySelector<HTMLElement>('.desk__screen');
  if (!screen) return;
  const wins = new Map<string, Win>();
  root.querySelectorAll<HTMLElement>('.win').forEach((el) => {
    const app = el.dataset.app;
    if (app) wins.set(app, { el, app, placed: false });
  });
  let z = 20;

  const dockItem = (app: string) => root.querySelector<HTMLElement>(`.dock__item[data-launch="${app}"]`);
  const setRunning = (app: string, on: boolean) => dockItem(app)?.classList.toggle('is-running', on);

  const place = (w: Win): void => {
    if (isNarrow()) return;
    const [x, y, ww, hh] = LAYOUT[w.app] ?? [0.2, 0.1, 0.5, 0.6];
    const sw = screen.clientWidth;
    const sh = screen.clientHeight;
    w.el.style.left = `${Math.round(x * sw)}px`;
    w.el.style.top = `${Math.round(y * sh)}px`;
    w.el.style.width = `${Math.round(Math.min(sw, Math.max(320, ww * sw)))}px`;
    w.el.style.height = `${Math.round(Math.max(240, hh * sh))}px`;
    w.placed = true;
  };

  const focus = (w: Win): void => {
    wins.forEach((o) => o.el.classList.toggle('is-focused', o === w));
    w.el.style.zIndex = String(++z);
  };

  const open = (app: string): void => {
    const w = wins.get(app);
    if (!w) return;
    if (!w.placed) place(w);
    const wasHidden = w.el.hidden;
    w.el.hidden = false;
    w.el.classList.remove('is-min');
    if (wasHidden && !reducedMotion) {
      w.el.classList.add('is-opening');
      requestAnimationFrame(() => requestAnimationFrame(() => w.el.classList.remove('is-opening')));
    }
    setRunning(app, true);
    focus(w);
    if (isNarrow() && app !== 'terminal') document.documentElement.style.overflow = 'hidden';
    const target = w.el.querySelector<HTMLElement>('.term__input, input:not([readonly]), .is-active, button') ?? w.el;
    target.focus({ preventScroll: true });
  };

  const close = (w: Win): void => {
    w.el.hidden = true;
    w.el.classList.remove('is-max', 'is-min');
    setRunning(w.app, false);
    if (isNarrow()) document.documentElement.style.overflow = '';
    dockItem(w.app)?.focus({ preventScroll: true });
  };

  const minimise = (w: Win): void => {
    if (isNarrow()) return close(w);
    const d = dockItem(w.app);
    if (d) {
      const dr = d.getBoundingClientRect();
      const wr = w.el.getBoundingClientRect();
      w.el.style.setProperty('--to-x', `${dr.left + dr.width / 2 - wr.left}px`);
      w.el.style.setProperty('--to-y', `${dr.top + dr.height / 2 - wr.top}px`);
    }
    w.el.classList.add('is-min');
    w.el.classList.remove('is-focused');
  };

  const toggleMax = (w: Win): void => {
    if (isNarrow()) return;
    w.el.classList.toggle('is-max');
    focus(w);
  };

  wins.forEach((w) => {
    w.el.addEventListener('pointerdown', () => focus(w));
    w.el.querySelectorAll<HTMLButtonElement>('.win__btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'close') close(w);
        else if (act === 'min') minimise(w);
        else if (act === 'max') toggleMax(w);
      });
    });
    w.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && w.app !== 'terminal') close(w);
    });

    const bar = w.el.querySelector<HTMLElement>('.win__bar');
    bar?.addEventListener('dblclick', (e) => {
      if (!(e.target as HTMLElement).closest('button')) toggleMax(w);
    });
    bar?.addEventListener('pointerdown', (e) => {
      if (isNarrow() || w.el.classList.contains('is-max') || (e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      const sx = e.clientX;
      const sy = e.clientY;
      const ox = w.el.offsetLeft;
      const oy = w.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const maxX = screen.clientWidth - 80;
        const maxY = screen.clientHeight - 60;
        w.el.style.left = `${Math.min(maxX, Math.max(-w.el.offsetWidth + 120, ox + ev.clientX - sx))}px`;
        w.el.style.top = `${Math.min(maxY, Math.max(0, oy + ev.clientY - sy))}px`;
      };
      const up = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });

    const grip = w.el.querySelector<HTMLElement>('.win__resize');
    grip?.addEventListener('pointerdown', (e) => {
      if (isNarrow()) return;
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX;
      const sy = e.clientY;
      const ow = w.el.offsetWidth;
      const oh = w.el.offsetHeight;
      grip.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        w.el.style.width = `${Math.min(screen.clientWidth - w.el.offsetLeft, Math.max(320, ow + ev.clientX - sx))}px`;
        w.el.style.height = `${Math.min(screen.clientHeight - w.el.offsetTop, Math.max(220, oh + ev.clientY - sy))}px`;
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-launch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = wins.get(btn.dataset.launch ?? '');
      if (w && !w.el.hidden && !w.el.classList.contains('is-min') && w.el.classList.contains('is-focused')) {
        minimise(w);
        return;
      }
      open(btn.dataset.launch ?? '');
    });
  });
  window.addEventListener('desk:open', (e) => open((e as CustomEvent<string>).detail));

  window.addEventListener('resize', () => {
    if (isNarrow()) return;
    wins.forEach((w) => {
      if (!w.placed) return;
      w.el.style.left = `${Math.min(w.el.offsetLeft, Math.max(0, screen.clientWidth - 120))}px`;
      w.el.style.top = `${Math.min(w.el.offsetTop, Math.max(0, screen.clientHeight - 80))}px`;
      w.el.style.width = `${Math.min(w.el.offsetWidth, screen.clientWidth)}px`;
      w.el.style.height = `${Math.min(w.el.offsetHeight, screen.clientHeight - 20)}px`;
    });
  });

  const finder = wins.get('finder');
  if (finder && !isNarrow()) {
    place(finder);
    finder.el.hidden = false;
    setRunning('finder', true);
    focus(finder);
  }
  const term = wins.get('terminal');
  if (term) {
    place(term);
    setRunning('terminal', true);
    focus(term);
  }
}

function initFinder(root: HTMLElement): void {
  const win = root.querySelector<HTMLElement>('.win--finder');
  if (!win) return;
  const search = win.querySelector<HTMLInputElement>('.finder__search');
  const crumb = win.querySelector<HTMLElement>('[data-crumb]');
  const count = win.querySelector<HTMLElement>('[data-count]');
  let place = 'projects';

  const apply = () => {
    const q = (search?.value ?? '').trim().toLowerCase();
    let n = 0;
    win.querySelectorAll<HTMLElement>('[data-place-pane]').forEach((pane) => {
      const active = pane.dataset.placePane === place;
      pane.hidden = !active;
      if (!active) return;
      pane.querySelectorAll<HTMLElement>('a.finder__row').forEach((row) => {
        const hit = !q || (row.dataset.search ?? '').includes(q);
        row.hidden = !hit;
        if (hit) n++;
      });
    });
    if (crumb) crumb.textContent = place;
    if (count) count.textContent = `${n} item${n === 1 ? '' : 's'}`;
  };

  win.querySelectorAll<HTMLButtonElement>('.finder__place').forEach((btn) => {
    btn.addEventListener('click', () => {
      place = btn.dataset.place ?? 'projects';
      win.querySelectorAll('.finder__place').forEach((b) => b.classList.toggle('is-active', b === btn));
      apply();
    });
  });
  search?.addEventListener('input', apply);
  apply();
}

function initNotes(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>('.notes__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.note;
      root.querySelectorAll('.notes__item').forEach((b) => b.classList.toggle('is-active', b === btn));
      root.querySelectorAll<HTMLElement>('.notes__doc').forEach((doc) => {
        doc.hidden = doc.dataset.note !== id;
      });
    });
  });
}

function initMail(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('.win--mail .mail');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('.mail__status');
  const to = form.dataset.to ?? '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const subject = String(data.get('subject') ?? '').trim();
    const body = String(data.get('body') ?? '').trim();
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (status) status.textContent = 'opening your mail app…';
  });

  form.querySelector<HTMLButtonElement>('.mail__copy')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? to);
      btn.textContent = 'copied';
    } catch {
      btn.textContent = to;
    }
    window.setTimeout(() => (btn.textContent = 'copy'), 1600);
  });
}

function initTerminal(root: HTMLElement, data: TermData): void {
  const win = root.querySelector<HTMLElement>('.win--terminal');
  const out = win?.querySelector<HTMLElement>('.term__output');
  const input = win?.querySelector<HTMLInputElement>('.term__input');
  if (!win || !out || !input) return;
  const PROMPT = 'hritik@vector26 ~ % ';

  const scroll = () => {
    out.scrollTop = out.scrollHeight;
  };

  const print = (line: Line): void => {
    const el = document.createElement(line.href ? 'a' : 'div');
    el.className = `term__line${line.cls ? ` term__line--${line.cls}` : ''}`;
    if (line.parts) {
      for (const p of line.parts) {
        const span = document.createElement('span');
        if (p.cls) span.className = `term__c--${p.cls}`;
        span.textContent = p.text;
        el.appendChild(span);
      }
    } else {
      el.textContent = line.text || ' ';
    }
    if (line.href && el instanceof HTMLAnchorElement) {
      el.href = line.href;
      if (line.href.startsWith('http')) {
        el.target = '_blank';
        el.rel = 'noopener';
      }
    }
    out.appendChild(el);
  };

  const echo = (cmd: string): void => {
    print({ parts: [{ text: PROMPT, cls: 'prompt' }, { text: cmd }] });
  };

  const kv = (k: string, v: string): Line => ({ parts: [{ text: k.padEnd(11), cls: 'key' }, { text: v }] });

  const findProject = (q: string) => data.projects.find((p) => p.slug === q || p.title.toLowerCase() === q);
  const findEssay = (q: string) => data.essays.find((e) => e.slug === q || `${e.slug}.md` === q);

  const LINKS: Record<string, string> = {
    github: data.links.github,
    linkedin: data.links.linkedin,
    substack: '/substack',
    instagram: '/instagram',
    insta: '/instagram',
    pinterest: '/pinterest',
    projects: '/projects',
    about: '/about',
    cv: '/about',
  };
  const APPS: Record<string, string> = {
    finder: 'finder',
    notes: 'notes',
    essays: 'notes',
    mail: 'mail',
    contact: 'mail',
    terminal: 'terminal',
  };

  const commands: Record<string, (args: string[]) => Line[] | 'CLEAR'> = {
    help: () => [
      { text: 'available commands', cls: 'faint' },
      ...(
        [
          ['whoami', 'who is this'],
          ['about', 'the short version'],
          ['experience', 'where I have worked'],
          ['projects', 'things I have built'],
          ['essays', 'latest Substack essays'],
          ['ls', 'list files'],
          ['cat <name>', 'read a project or essay'],
          ['open <app|site>', 'finder, notes, mail, github, pinterest…'],
          ['social', 'where to find me'],
          ['mail', 'write me a message'],
          ['neofetch', 'system info'],
          ['clear', 'clear the screen (ctrl+l)'],
        ] as const
      ).map(([c, d]) => ({ parts: [{ text: `  ${c.padEnd(18)}`, cls: 'accent' }, { text: d, cls: 'dim' }] })),
    ],
    whoami: () => [{ text: `${data.name} — ${data.tagline}` }],
    about: () => [
      { text: data.name, cls: 'accent' },
      { text: data.tagline },
      { text: `based in ${data.location} · type 'experience' or 'projects'`, cls: 'dim' },
    ],
    experience: () =>
      data.experience.map((e) => ({
        parts: [
          { text: `  ${e.span.padEnd(22)}`, cls: 'dim' },
          { text: e.company.padEnd(10), cls: 'accent' },
          { text: e.title },
        ],
      })),
    projects: () => [
      ...data.projects.map((p) => ({
        parts: [
          { text: `  ${p.slug.padEnd(30)}`, cls: 'accent' },
          { text: p.stars ? `★${p.stars} ` : '', cls: 'warn' },
          { text: p.tags.slice(0, 3).join(' · '), cls: 'dim' },
        ],
      })),
      { text: "cat <name> for details · 'open finder' to browse", cls: 'faint' },
    ],
    essays: () => [
      ...data.essays.map((e) => ({
        parts: [{ text: `  ${e.date.padEnd(10)}`, cls: 'dim' }, { text: e.title }],
        href: e.href,
      })),
      { text: "click to read · 'open notes' for previews", cls: 'faint' },
    ],
    ls: (args) => {
      const dir = (args[0] ?? '').replace(/\/$/, '');
      if (dir === 'projects') return [{ text: data.projects.map((p) => p.slug).join('  ') }];
      if (dir === 'essays') return [{ text: data.essays.map((e) => `${e.slug}.md`).join('  ') }];
      return [{ parts: [{ text: 'projects/  essays/  ', cls: 'accent' }, { text: 'about.txt  contact.txt' }] }];
    },
    cat: (args) => {
      const q = (args[0] ?? '').toLowerCase().replace(/^(projects|essays)\//, '');
      if (!q) return [{ text: 'usage: cat <project|essay>', cls: 'faint' }];
      if (q === 'about.txt') return commands.about([]) as Line[];
      if (q === 'contact.txt') return commands.social([]) as Line[];
      const p = findProject(q);
      if (p)
        return [
          { text: p.title, cls: 'accent' },
          { text: p.description },
          { text: p.tags.join(' · '), cls: 'dim' },
          { text: `→ ${p.href}`, href: p.href, cls: 'accent' },
        ];
      const e = findEssay(q);
      if (e) return [{ text: e.title, cls: 'accent' }, { text: e.date, cls: 'dim' }, { text: `→ read ${e.href}`, href: e.href, cls: 'accent' }];
      return [{ text: `cat: ${args[0]}: no such file`, cls: 'warn' }];
    },
    open: (args) => {
      const t = (args[0] ?? '').toLowerCase();
      if (APPS[t]) {
        window.dispatchEvent(new CustomEvent('desk:open', { detail: APPS[t] }));
        return [{ text: `launching ${APPS[t]} …`, cls: 'accent' }];
      }
      const href = LINKS[t];
      if (!href) return [{ text: `open: unknown target — try: ${[...Object.keys(APPS), ...Object.keys(LINKS)].join(', ')}`, cls: 'warn' }];
      if (href.startsWith('http')) window.open(href, '_blank', 'noopener');
      else window.location.href = href;
      return [{ text: `opening ${t} …`, href, cls: 'accent' }];
    },
    social: () => [
      kv('email', data.email),
      kv('github', data.links.github),
      kv('linkedin', data.links.linkedin),
      kv('substack', `${location.origin}/substack`),
      kv('instagram', `${location.origin}/instagram`),
      kv('pinterest', `${location.origin}/pinterest`),
    ],
    mail: () => {
      window.dispatchEvent(new CustomEvent('desk:open', { detail: 'mail' }));
      return [{ text: 'launching mail …', cls: 'accent' }];
    },
    neofetch: () => {
      const latest = data.experience[0];
      return [
        { parts: [{ text: 'hritik', cls: 'accent' }, { text: '@' }, { text: 'vector26', cls: 'accent' }] },
        { text: '───────────────', cls: 'faint' },
        kv('name', data.name),
        kv('role', latest ? `${latest.title} @ ${latest.company}` : data.tagline),
        kv('location', data.location),
        kv('shell', 'zsh (ish)'),
        kv('stack', 'Java · Python · TypeScript · Go'),
        kv('infra', 'Kafka · Cassandra · Temporal · K8s'),
        kv('writes', 'Substack · prometheus'),
        kv('projects', String(data.projects.length)),
      ];
    },
    date: () => [{ text: new Date().toString() }],
    echo: (args) => [{ text: args.join(' ') }],
    history: () => history.slice().reverse().map((h, i) => ({ text: `  ${String(i + 1).padStart(3)}  ${h}` })),
    sudo: () => [{ text: 'permission denied: this incident will be reported.', cls: 'warn' }],
    exit: () => [{ text: 'there is no escape. keep scrolling ↓', cls: 'dim' }],
    clear: () => 'CLEAR',
  };
  const ALIAS: Record<string, string> = {
    '?': 'help',
    exp: 'experience',
    work: 'experience',
    blog: 'essays',
    substack: 'essays',
    contact: 'social',
    cls: 'clear',
    fastfetch: 'neofetch',
    dir: 'ls',
    ll: 'ls',
    resume: 'about',
  };
  const names = Object.keys(commands).sort();
  const history: string[] = [];
  let cursor = -1;

  const run = (raw: string): void => {
    const line = raw.trim();
    echo(raw);
    if (!line) return scroll();
    history.unshift(line);
    cursor = -1;
    const [cmd, ...args] = line.split(/\s+/);
    const key = ALIAS[cmd.toLowerCase()] ?? cmd.toLowerCase();
    const fn = commands[key];
    const res = fn ? fn(args) : [{ text: `command not found: ${cmd} — type 'help'`, cls: 'warn' }];
    if (res === 'CLEAR') out.textContent = '';
    else {
      res.forEach(print);
      print({ text: '' });
    }
    scroll();
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      run(input.value);
      input.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cursor < history.length - 1) cursor++;
      input.value = history[cursor] ?? '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      cursor = Math.max(-1, cursor - 1);
      input.value = cursor >= 0 ? history[cursor] : '';
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      out.textContent = '';
    } else if (e.key === 'Tab' && !e.shiftKey) {
      const v = input.value.trimStart().toLowerCase();
      if (!v) return;
      e.preventDefault();
      const [head, arg] = v.split(/\s+/, 2);
      if (arg !== undefined && (head === 'cat' || head === 'open')) {
        const pool = head === 'cat' ? [...data.projects.map((p) => p.slug), ...data.essays.map((x) => `${x.slug}.md`)] : [...Object.keys(APPS), ...Object.keys(LINKS)];
        const hits = pool.filter((n) => n.startsWith(arg));
        if (hits.length === 1) input.value = `${head} ${hits[0]}`;
        else if (hits.length > 1) {
          echo(input.value);
          print({ text: hits.join('   '), cls: 'faint' });
          scroll();
        }
        return;
      }
      const hits = names.filter((n) => n.startsWith(v));
      if (hits.length === 1) input.value = `${hits[0]} `;
      else if (hits.length > 1) {
        echo(input.value);
        print({ text: hits.join('   '), cls: 'faint' });
        scroll();
      }
    }
  });

  win.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('a, button, .win__bar') && !window.getSelection()?.toString()) {
      input.focus({ preventScroll: true });
    }
  });

  const greet = (): void => {
    print({ text: '╭──────────────────────────────────────╮', cls: 'accent' });
    print({ text: '│  hritik rai  ·  vector26  ·  ~/home  │', cls: 'accent' });
    print({ text: '╰──────────────────────────────────────╯', cls: 'accent' });
    print({ text: `Last login: ${new Date().toDateString()} on ttys001`, cls: 'faint' });
    print({ text: "type 'help' to list commands · tab completes · ↑ history", cls: 'faint' });
    print({ text: '' });
  };

  const typeOut = (cmd: string, done: () => void): void => {
    let i = 0;
    const step = () => {
      input.value = cmd.slice(0, i);
      i++;
      if (i <= cmd.length) window.setTimeout(step, 55 + Math.random() * 45);
      else window.setTimeout(done, 280);
    };
    step();
  };

  greet();
  if (reducedMotion) {
    run('neofetch');
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      window.setTimeout(
        () =>
          typeOut('neofetch', () => {
            run(input.value);
            input.value = '';
          }),
        450,
      );
    },
    { threshold: 0.35 },
  );
  io.observe(win);
}

function loadTermData(): TermData | null {
  const el = document.getElementById('term-data');
  if (!el?.textContent) return null;
  return JSON.parse(el.textContent) as TermData;
}

const desk = document.querySelector<HTMLElement>('.desk');
if (desk) {
  initWindows(desk);
  initFinder(desk);
  initNotes(desk);
  initMail(desk);
  const data = loadTermData();
  if (data) initTerminal(desk, data);
}
