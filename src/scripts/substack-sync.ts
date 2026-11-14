import {
  fetchLivePosts,
  replaceSubstackGrid,
  slugListsDiffer,
} from './substack-feed';

async function syncSubstackIndex(): Promise<void> {
  const grid = document.getElementById('substack-grid');
  if (!grid) return;
  const baked = (grid.dataset.slugs ?? '').split(',').filter(Boolean);
  const posts = await fetchLivePosts();
  if (!posts.length) return;
  if (baked.length && !slugListsDiffer(baked, posts)) return;
  replaceSubstackGrid(grid, posts);
  grid.dataset.slugs = posts.map((p) => p.slug).join(',');
  grid.dataset.liveSync = new Date().toISOString();
}

syncSubstackIndex();