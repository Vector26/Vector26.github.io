#!/usr/bin/env node
/**
 * Parse vector2604 Substack RSS → src/data/substack.json and refresh blog stubs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, walkSync, ELEMENT_NODE } from 'ultrahtml';
import sanitize from 'ultrahtml/transformers/sanitize';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const feedUrl = 'https://vector2604.substack.com/feed';
const outJson = path.join(root, 'src/data/substack.json');
const blogDir = path.join(root, 'src/content/blog');

function slugFromLink(link) {
  const m = link.match(/\/p\/([^/?#]+)/);
  return m ? m[1] : link.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function decodeXml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const title = decodeXml((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const link = decodeXml((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const description = decodeXml(
      (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '',
    ).trim();
    const pubDate = decodeXml((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '').trim();
    const content = (block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/) || [])[1] || '';
    const cover = decodeXml((block.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1] || '');
    if (title && link) items.push({ title, link, description, pubDate, content, cover });
  }
  return items;
}

const DROP_CLASSES = ['subscription-widget', 'image-link-expand'];

const ALLOWED_ATTRS = {
  a: ['href'],
  img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height'],
  source: ['srcset', 'sizes', 'type'],
};

function isDroppedChrome(node) {
  const cls = node.type === ELEMENT_NODE ? node.attributes.class || '' : '';
  return DROP_CLASSES.some((c) => cls.includes(c));
}

// ultrahtml's sanitize only removes attributes listed in dropAttributes, so the allowlist is enforced here.
function stripSubstackChrome() {
  return (doc) => {
    doc.children = doc.children.filter((child) => !isDroppedChrome(child));
    walkSync(doc, (node) => {
      if (node.type !== ELEMENT_NODE) return;
      node.children = node.children.filter((child) => !isDroppedChrome(child));
      const keep = ALLOWED_ATTRS[node.name] || [];
      for (const key of Object.keys(node.attributes)) {
        if (!keep.includes(key)) delete node.attributes[key];
      }
      if (node.name === 'a') {
        const href = node.attributes.href || '';
        if (!/^(https?:|mailto:)/i.test(href)) delete node.attributes.href;
        node.attributes.target = '_blank';
        node.attributes.rel = 'noopener';
      }
      if (node.name === 'img') node.attributes.loading = 'lazy';
    });
    return doc;
  };
}

async function cleanHtml(html) {
  if (!html) return '';
  return transform(html, [
    stripSubstackChrome(),
    sanitize({
      dropElements: ['script', 'style', 'iframe', 'form', 'button', 'input', 'svg', 'noscript'],
      allowElements: [
        'p', 'a', 'em', 'strong', 'b', 'i', 'u', 's', 'br', 'hr', 'span', 'div',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
        'figure', 'figcaption', 'picture', 'source', 'img', 'code', 'pre', 'sup', 'sub',
      ],
    }),
  ]);
}

function readingMinutes(html) {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function frontmatter(post) {
  const slug = slugFromLink(post.link);
  const iso = post.pubDate ? new Date(post.pubDate).toISOString().slice(0, 10) : '';
  const desc = post.description.replace(/"/g, '\\"').slice(0, 280);
  return `---
title: "${post.title.replace(/"/g, '\\"')}"
description: "${desc}"
pubDate: ${iso}
canonical: ${post.link}
tags: [prometheus]
---

Read on [Substack](${post.link}).
`;
}

async function main() {
  const res = await fetch(feedUrl, { headers: { 'User-Agent': 'vector26.github.io feed sync' } });
  if (!res.ok) throw new Error(`Feed ${res.status}`);
  const xml = await res.text();
  const items = parseItems(xml);
  const posts = [];
  for (const p of items) {
    const html = await cleanHtml(p.content);
    posts.push({
      title: p.title,
      description: p.description,
      url: p.link,
      pubDate: p.pubDate ? new Date(p.pubDate).toISOString() : null,
      slug: slugFromLink(p.link),
      cover: p.cover || null,
      readingMinutes: readingMinutes(html),
      html,
    });
  }
  const payload = { syncedAt: new Date().toISOString(), feed: feedUrl, posts };
  await fs.mkdir(path.dirname(outJson), { recursive: true });
  await fs.writeFile(outJson, JSON.stringify(payload, null, 2) + '\n');
  await fs.mkdir(blogDir, { recursive: true });
  for (const post of payload.posts) {
    const file = path.join(blogDir, `${post.slug}.md`);
    const raw = items.find((i) => slugFromLink(i.link) === post.slug);
    await fs.writeFile(file, frontmatter(raw));
  }
  console.log(`Synced ${payload.posts.length} posts → ${outJson}`);
}

main().catch(async (e) => {
  const hasCache = await fs.access(outJson).then(() => true, () => false);
  if (hasCache) {
    console.warn(`Substack sync failed (${e.message}); building with the last synced posts.`);
    return;
  }
  console.error(e);
  process.exit(1);
});
