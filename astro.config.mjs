// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hritikrai.com',
  output: 'static',
  compressHTML: true,
  redirects: {
    '/blog': '/substack',
    '/blog/[slug]': '/substack/[slug]',
  },
});
