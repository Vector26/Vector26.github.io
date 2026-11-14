/** Live Substack metadata — fetched in the browser (RSS has no CORS; use rss2json bridge). */

export const SUBSTACK_FEED = 'https://vector2604.substack.com/feed';

const RSS_BRIDGE = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(SUBSTACK_FEED)}`;

export interface LivePost {
  title: string;
  description: string;
  slug: string;
  url: string;
  pubDate: string;
  cover: string | null;
  readingMinutes: number;
  html: string;
}

export function slugFromLink(link: string): string {
  const m = link.match(/\/p\/([^/?#]+)/);
  return m ? m[1] : '';
}

function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapRssItem(item: Record<string, unknown>): LivePost | null {
  const link = String(item.link ?? '');
  const slug = slugFromLink(link);
  if (!slug) return null;
  const content = String(item.content ?? item.description ?? '');
  const thumb = item.thumbnail;
  const enc = item.enclosure as { link?: string } | undefined;
  return {
    title: String(item.title ?? ''),
    description: stripTags(String(item.description ?? '')),
    slug,
    url: link,
    pubDate: new Date(String(item.pubDate ?? '')).toISOString(),
    cover: typeof thumb === 'string' && thumb ? thumb : enc?.link ?? null,
    readingMinutes: readingMinutes(content),
    html: content,
  };
}

async function fetchFromRssBridge(): Promise<LivePost[]> {
  const res = await fetch(RSS_BRIDGE, { cache: 'no-store' });
  if (!res.ok) throw new Error(`rss bridge ${res.status}`);
  const data = (await res.json()) as { status?: string; items?: Record<string, unknown>[] };
  if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('rss bridge bad payload');
  return data.items.map(mapRssItem).filter((p): p is LivePost => p !== null);
}

async function fetchFromOriginCache(): Promise<LivePost[]> {
  const res = await fetch(`/substack/posts.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`posts.json ${res.status}`);
  const data = (await res.json()) as { posts?: LivePost[] };
  return Array.isArray(data.posts) ? data.posts : [];
}

/** Latest posts from Substack (live first, then last build snapshot). */
export async function fetchLivePosts(): Promise<LivePost[]> {
  try {
    const live = await fetchFromRssBridge();
    if (live.length) return live.sort(byDateDesc);
  } catch (e) {
    console.warn('[substack] live feed failed', e);
  }
  try {
    const cached = await fetchFromOriginCache();
    if (cached.length) return cached.sort(byDateDesc);
  } catch (e) {
    console.warn('[substack] origin cache failed', e);
  }
  return [];
}

function byDateDesc(a: LivePost, b: LivePost): number {
  return new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf();
}

export function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const DROP_SELECTORS = 'script,style,iframe,form,button,input,svg,noscript,.subscription-widget,.image-link-expand';

export function sanitizeEssayHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(DROP_SELECTORS).forEach((el) => el.remove());
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (!/^(https?:|mailto:|#)/i.test(href)) a.removeAttribute('href');
    else {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
  });
  doc.querySelectorAll('img').forEach((img) => img.setAttribute('loading', 'lazy'));
  return doc.body.innerHTML;
}

export function slugListsDiffer(baked: string[], live: LivePost[]): boolean {
  const a = baked.join(',');
  const b = live.map((p) => p.slug).join(',');
  return a !== b;
}

export function renderSubstackCard(post: LivePost): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'substack__card';
  a.href = `/substack/${post.slug}`;
  if (post.cover) {
    const cover = document.createElement('span');
    cover.className = 'substack__cover';
    const img = document.createElement('img');
    img.src = post.cover;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    cover.appendChild(img);
    a.appendChild(cover);
  }
  const meta = document.createElement('span');
  meta.className = 'substack__meta mono';
  meta.textContent = `${formatShort(post.pubDate)} · ${post.readingMinutes} min read`;
  const title = document.createElement('span');
  title.className = 'substack__title';
  title.textContent = post.title;
  const desc = document.createElement('span');
  desc.className = 'substack__desc';
  desc.textContent = post.description;
  a.append(meta, title, desc);
  return a;
}

export function replaceSubstackGrid(grid: HTMLElement, posts: LivePost[]): void {
  const frag = document.createDocumentFragment();
  for (const post of posts) frag.appendChild(renderSubstackCard(post));
  grid.replaceChildren(frag);
}