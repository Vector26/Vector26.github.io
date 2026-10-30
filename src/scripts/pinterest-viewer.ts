type Pin = { title: string; date: string; full: string; video: string | null; w: number; h: number };

function initViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('.pin-view');
  const dataEl = document.getElementById('pin-data');
  if (!dialog || !dataEl?.textContent || typeof dialog.showModal !== 'function') return;
  const pins = JSON.parse(dataEl.textContent) as Pin[];
  const media = dialog.querySelector<HTMLElement>('.pin-view__media')!;
  const title = dialog.querySelector<HTMLElement>('.pin-view__title')!;
  const count = dialog.querySelector<HTMLElement>('.pin-view__count')!;
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let current = 0;

  const show = (i: number) => {
    current = (i + pins.length) % pins.length;
    const pin = pins[current];
    let node: HTMLImageElement | HTMLVideoElement;
    if (pin.video) {
      const v = document.createElement('video');
      v.src = pin.video;
      v.poster = pin.full;
      v.controls = true;
      v.playsInline = true;
      v.autoplay = true;
      v.loop = true;
      node = v;
    } else {
      const img = document.createElement('img');
      img.src = pin.full;
      img.alt = pin.title;
      node = img;
    }
    node.width = pin.w;
    node.height = pin.h;
    media.replaceChildren(node);
    title.textContent = pin.title;
    count.textContent = `${fmt.format(new Date(pin.date))} · ${current + 1} / ${pins.length}`;
    const next = pins[(current + 1) % pins.length];
    if (!next.video) new Image().src = next.full;
  };

  document.querySelectorAll<HTMLButtonElement>('.pin__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      dialog.showModal();
      show(Number(btn.dataset.i));
    });
  });

  dialog.querySelector('.pin-view__prev')?.addEventListener('click', () => show(current - 1));
  dialog.querySelector('.pin-view__next')?.addEventListener('click', () => show(current + 1));
  dialog.querySelector('.pin-view__close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === media) dialog.close();
  });
  dialog.addEventListener('close', () => media.replaceChildren());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  let touchX = 0;
  media.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
  media.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
  });
}

function initVideos(): void {
  const videos = document.querySelectorAll<HTMLVideoElement>('.pin__video');
  if (!videos.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const v = en.target as HTMLVideoElement;
        if (en.isIntersecting) {
          if (!v.src) v.src = v.dataset.src ?? '';
          v.play()
            .then(() => v.classList.add('is-playing'))
            .catch(() => undefined);
        } else {
          v.pause();
        }
      }
    },
    { rootMargin: '200px 0px', threshold: 0.25 },
  );
  videos.forEach((v) => io.observe(v));
}

initViewer();
initVideos();
