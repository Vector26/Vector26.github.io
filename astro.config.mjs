// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://vector26.github.io',
  output: 'static',
  compressHTML: true,
  redirects: {
    '/blog': '/substack',
    '/blog/[slug]': '/substack/[slug]',
  },
});
