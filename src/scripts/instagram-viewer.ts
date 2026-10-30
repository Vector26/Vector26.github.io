type Slide = { type: 'image'; src: string; w: number; h: number } | { type: 'video'; src: string; poster: string; w: number; h: number };

type ViewerPost = {
  kind: 'photo' | 'carousel' | 'reel';
  url: string;
  caption: string;
  date?: string;
  slides: Slide[];
};

const KIND_LABEL: Record<ViewerPost['kind'], string> = { photo: 'Photo', carousel: 'Carousel', reel: 'Reel' };

function renderCaption(el: HTMLElement, text: string): void {
  el.replaceChildren();
  for (const part of text.split(/([@#][\w.]+)/u)) {
    if (/^@[\w.]+$/u.test(part)) {
      const a = document.createElement('a');
      a.href = `https://www.instagram.com/${part.slice(1).replace(/\.$/, '')}/`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = part;
      el.append(a);
    } else if (/^#\w+$/u.test(part)) {
      const a = document.createElement('a');
      a.href = `https://www.instagram.com/explore/tags/${encodeURIComponent(part.slice(1))}/`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = part;
      el.append(a);
    } else {
      el.append(part);
    }
  }
}

function slideNode(s: Slide, eager: boolean): HTMLElement {
  if (s.type === 'image') {
    const img = document.createElement('img');
    img.src = s.src;
    img.alt = '';
    img.width = s.w;
    img.height = s.h;
    img.decoding = 'async';
    if (!eager) img.loading = 'lazy';
    return img;
  }
  const v = document.createElement('video');
  v.src = s.src;
  v.poster = s.poster;
  v.width = s.w;
  v.height = s.h;
  v.controls = true;
  v.playsInline = true;
  v.preload = eager ? 'auto' : 'none';
  return v;
}

function initViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('.ig-view');
  const dataEl = document.getElementById('ig-data');
  if (!dialog || !dataEl?.textContent || typeof dialog.showModal !== 'function') return;
  const posts = JSON.parse(dataEl.textContent) as ViewerPost[];
  const media = dialog.querySelector<HTMLElement>('.ig-view__media')!;
  const stage = dialog.querySelector<HTMLElement>('.ig-view__stage')!;
  const dots = dialog.querySelector<HTMLElement>('.ig-view__dots')!;
  const caption = dialog.querySelector<HTMLElement>('.ig-view__caption')!;
  const kind = dialog.querySelector<HTMLElement>('.ig-view__kind')!;
  const date = dialog.querySelector<HTMLTimeElement>('.ig-view__date')!;
  const open = dialog.querySelector<HTMLAnchorElement>('.ig-view__open')!;
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  let current = 0;
  let slide = 0;

  const pauseAll = () => stage.querySelectorAll('video').forEach((v) => v.pause());

  const goSlide = (i: number, autoplay = true) => {
    const nodes = [...stage.children] as HTMLElement[];
    if (!nodes.length) return;
    slide = Math.max(0, Math.min(nodes.length - 1, i));
    pauseAll();
    nodes.forEach((n, k) => n.classList.toggle('is-active', k === slide));
    [...dots.children].forEach((d, k) => d.classList.toggle('is-active', k === slide));
    media.classList.toggle('is-first', slide === 0);
    media.classList.toggle('is-last', slide === nodes.length - 1);
    const next = nodes[slide + 1];
    if (next instanceof HTMLVideoElement && next.preload === 'none') next.preload = 'metadata';
    const active = nodes[slide];
    if (active instanceof HTMLVideoElement) {
      if (active.preload === 'none') active.preload = 'auto';
      if (autoplay) active.play().catch(() => undefined);
    }
  };

  const show = (i: number, at: 'start' | 'end' = 'start') => {
    pauseAll();
    current = (i + posts.length) % posts.length;
    const post = posts[current];
    stage.replaceChildren(...post.slides.map((s, k) => slideNode(s, k === 0)));
    dots.replaceChildren(...post.slides.map(() => document.createElement('i')));
    media.classList.toggle('is-multi', post.slides.length > 1);
    renderCaption(caption, post.caption);
    kind.textContent = `${KIND_LABEL[post.kind]} · ${current + 1}/${posts.length}`;
    if (post.date) {
      date.dateTime = post.date;
      date.textContent = fmt.format(new Date(post.date));
    } else {
      date.textContent = '';
    }
    open.href = post.url;
    goSlide(at === 'start' ? 0 : post.slides.length - 1);
  };

  const step = (dir: 1 | -1) => {
    const n = posts[current].slides.length;
    if (slide + dir >= 0 && slide + dir < n) goSlide(slide + dir);
    else show(current + dir, dir === 1 ? 'start' : 'end');
  };

  document.querySelectorAll<HTMLAnchorElement>('.ig__tile').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      dialog.showModal();
      show(Number(tile.dataset.i));
    });
  });

  dialog.querySelector('.ig-view__step--prev')?.addEventListener('click', () => goSlide(slide - 1));
  dialog.querySelector('.ig-view__step--next')?.addEventListener('click', () => goSlide(slide + 1));
  dialog.querySelector('.ig-view__prev')?.addEventListener('click', () => show(current - 1));
  dialog.querySelector('.ig-view__next')?.addEventListener('click', () => show(current + 1));
  dialog.querySelector('.ig-view__close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    pauseAll();
    stage.replaceChildren();
  });
  dialog.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'VIDEO' && (e.key === ' ' || e.key === 'k')) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    }
  });

  let touchX = 0;
  stage.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });
}

function initPreviews(): void {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll<HTMLAnchorElement>('.ig__tile').forEach((tile) => {
    const v = tile.querySelector<HTMLVideoElement>('.ig__preview');
    if (!v) return;
    tile.addEventListener('mouseenter', () => {
      if (!v.src) v.src = v.dataset.src ?? '';
      v.play()
        .then(() => tile.classList.add('is-previewing'))
        .catch(() => undefined);
    });
    tile.addEventListener('mouseleave', () => {
      v.pause();
      tile.classList.remove('is-previewing');
    });
  });
}

initViewer();
initPreviews();
