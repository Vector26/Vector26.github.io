import {
  fetchLivePosts,
  formatLong,
  sanitizeEssayHtml,
} from './substack-feed';

function essaySlugFromPath(): string | null {
  const m = location.pathname.match(/^\/substack\/([^/]+)\/?$/);
  if (!m) return null;
  const slug = decodeURIComponent(m[1]);
  if (!slug || slug === 'index.html') return null;
  return slug;
}

async function renderMissingEssay(substackBase: string): Promise<void> {
  const slug = essaySlugFromPath();
  if (!slug) return;

  const posts = await fetchLivePosts();
  const post = posts.find((p) => p.slug === slug);
  if (!post?.html) return;

  const generic = document.getElementById('generic-404');
  const article = document.getElementById('substack-live-essay');
  if (!article) return;

  generic?.setAttribute('hidden', '');
  article.removeAttribute('hidden');

  document.title = `${post.title} — Hritik Rai`;

  const back = article.querySelector<HTMLAnchorElement>('.essay__back');
  const eyebrow = article.querySelector<HTMLElement>('.eyebrow');
  const titleEl = article.querySelector<HTMLElement>('.essay__title');
  const dek = article.querySelector<HTMLElement>('.essay__dek');
  const body = article.querySelector<HTMLElement>('.essay__body');
  const comment = article.querySelector<HTMLAnchorElement>('[data-substack-post]');
  const subscribe = article.querySelector<HTMLAnchorElement>('[data-substack-subscribe]');

  if (back) back.href = '/substack';
  if (eyebrow) {
    eyebrow.textContent = `prometheus · ${formatLong(post.pubDate)} · ${post.readingMinutes} min read`;
  }
  if (titleEl) titleEl.textContent = post.title;
  if (dek) {
    dek.textContent = post.description;
    dek.hidden = !post.description;
  }
  if (body) body.innerHTML = sanitizeEssayHtml(post.html);
  if (comment) comment.href = post.url;
  if (subscribe) subscribe.href = `${substackBase}subscribe`;
}

const root = document.getElementById('substack-live-essay');
const substackBase = root?.dataset.substack ?? 'https://vector2604.substack.com/';
renderMissingEssay(substackBase);