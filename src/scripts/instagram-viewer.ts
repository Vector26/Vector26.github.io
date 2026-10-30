type ViewerPost = {
  kind: 'photo' | 'carousel' | 'reel';
  url: string;
  embed: string;
  full: string;
  width: number;
  height: number;
  caption: string;
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

function renderMedia(el: HTMLElement, post: ViewerPost): void {
  el.replaceChildren();
  el.dataset.kind = post.kind;
  const img = document.createElement('img');
  img.src = post.full;
  img.alt = '';
  img.width = post.width;
  img.height = post.height;
  img.className = 'ig-view__poster';
  el.append(img);
  if (post.kind === 'photo') return;

  const frame = document.createElement('iframe');
  frame.src = post.embed;
  frame.title = `Instagram ${KIND_LABEL[post.kind].toLowerCase()}`;
  frame.loading = 'lazy';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.className = 'ig-view__embed';
  frame.addEventListener('load', () => el.classList.add('is-embedded'), { once: true });
  el.classList.remove('is-embedded');
  el.append(frame);
}

function initViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('.ig-view');
  const dataEl = document.getElementById('ig-data');
  if (!dialog || !dataEl?.textContent || typeof dialog.showModal !== 'function') return;
  const posts = JSON.parse(dataEl.textContent) as ViewerPost[];
  const media = dialog.querySelector<HTMLElement>('.ig-view__media')!;
  const caption = dialog.querySelector<HTMLElement>('.ig-view__caption')!;
  const kind = dialog.querySelector<HTMLElement>('.ig-view__kind')!;
  const open = dialog.querySelector<HTMLAnchorElement>('.ig-view__open')!;
  let current = 0;

  const show = (i: number) => {
    current = (i + posts.length) % posts.length;
    const post = posts[current];
    renderMedia(media, post);
    renderCaption(caption, post.caption);
    kind.textContent = `${KIND_LABEL[post.kind]} · ${current + 1}/${posts.length}`;
    open.href = post.url;
    open.textContent = post.kind === 'photo' ? 'Open on Instagram ↗' : `Watch on Instagram ↗`;
    if (post.kind === 'carousel') open.textContent = 'See all slides on Instagram ↗';
  };

  document.querySelectorAll<HTMLAnchorElement>('.ig__tile').forEach((tile) => {
    tile.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      show(Number(tile.dataset.i));
      dialog.showModal();
    });
  });

  dialog.querySelector('.ig-view__prev')?.addEventListener('click', () => show(current - 1));
  dialog.querySelector('.ig-view__next')?.addEventListener('click', () => show(current + 1));
  dialog.querySelector('.ig-view__close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => media.replaceChildren());
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
}

initViewer();
