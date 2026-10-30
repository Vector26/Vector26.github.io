type TermData = {
  projects: { title: string; href?: string; meta: string }[];
  blog: { title: string; href: string; meta: string }[];
};

const Z = 10;

function qs<T extends Element>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel);
}

function bring(win: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('.win').forEach((w) => {
    w.style.zIndex = '1';
  });
  win.style.zIndex = String(Z);
  win.hidden = false;
}

function closeWin(win: HTMLElement): void {
  win.hidden = true;
  const app = win.dataset.app;
  if (app) {
    document.querySelector(`.dock__item[data-launch="${app}"]`)?.classList.remove('is-running');
  }
}

function initWindows(): void {
  document.querySelectorAll<HTMLElement>('.win').forEach((win, i) => {
    win.style.left = `${12 + i * 24}px`;
    win.style.top = `${12 + i * 18}px`;
    win.style.zIndex = String(i + 1);

    win.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'close') closeWin(win);
        if (act === 'min') win.hidden = true;
        if (act === 'max') {
          win.style.width = 'calc(100% - 2rem)';
          win.style.height = 'calc(100% - 2rem)';
          win.style.left = '1rem';
          win.style.top = '1rem';
        }
      });
    });

    const bar = qs<HTMLElement>('.win__bar', win);
    let drag = false;
    let ox = 0;
    let oy = 0;
    bar?.addEventListener('pointerdown', (e) => {
      drag = true;
      bring(win);
      ox = e.clientX - win.offsetLeft;
      oy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar?.addEventListener('pointermove', (e) => {
      if (!drag) return;
      win.style.left = `${e.clientX - ox}px`;
      win.style.top = `${e.clientY - oy}px`;
    });
    bar?.addEventListener('pointerup', () => {
      drag = false;
    });
    win.addEventListener('mousedown', () => bring(win));
  });
}

function initDock(): void {
  document.querySelectorAll<HTMLButtonElement>('.dock__item[data-launch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const app = btn.dataset.launch;
      const win = document.querySelector<HTMLElement>(`.win[data-app="${app}"]`);
      if (!win) return;
      bring(win);
      btn.classList.add('is-running');
    });
  });
}

function initNotes(): void {
  document.querySelectorAll<HTMLButtonElement>('.notes__item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.note;
      document.querySelectorAll('.notes__item').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.querySelectorAll<HTMLElement>('.notes__doc').forEach((doc) => {
        doc.hidden = doc.dataset.note !== id;
      });
    });
  });
}

function initTerminal(data: TermData): void {
  const out = qs<HTMLElement>('.term__output');
  const input = qs<HTMLInputElement>('.term__input');
  if (!out || !input) return;

  const print = (text: string) => {
    out.textContent += (out.textContent ? '\n' : '') + text;
    out.scrollTop = out.scrollHeight;
  };

  print("Type 'help' for commands.");

  const commands: Record<string, () => void | Promise<void>> = {
    help: () => {
      print('Commands: help, about, experience, projects, blog, clear, open <url>');
    },
    about: () => {
      print('Opening /about — use the nav or visit in browser.');
      window.location.href = '/about';
    },
    experience: () => {
      print('Atlan (SDE2) · Founda (2026) · Tartan · see /about for timeline.');
    },
    projects: () => {
      data.projects.forEach((p) => print(`• ${p.title} — ${p.meta}`));
    },
    blog: () => {
      data.blog.forEach((b) => print(`• ${b.title} → ${b.href}`));
    },
    clear: () => {
      out.textContent = '';
    },
  };

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    print(`hritik@vector26 ~ % ${raw}`);
    const [cmd, ...rest] = raw.split(/\s+/);
    const key = cmd.toLowerCase();
    if (key === 'open' && rest[0]) {
      const url = rest.join(' ');
      window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
      return;
    }
    const fn = commands[key];
    if (fn) fn();
    else print(`command not found: ${cmd}`);
  });
}

function loadTermData(): TermData {
  const el = document.getElementById('term-data');
  if (!el?.textContent) return { projects: [], blog: [] };
  return JSON.parse(el.textContent) as TermData;
}

initWindows();
initDock();
initNotes();
initTerminal(loadTermData());
