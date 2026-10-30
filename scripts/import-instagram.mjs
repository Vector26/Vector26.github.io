#!/usr/bin/env node
/**
 * Import a browser "Save Page As" copy of the Instagram profile page.
 * Usage: npm run import:instagram -- /path/to/Instagram.html
 * Writes src/data/instagram.json and copies images into src/assets/instagram/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDLE = 'thehritikrai';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'src/assets/instagram');
const outJson = path.join(root, 'src/data/instagram.json');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n] ?? m);
}

function visibleText(html) {
  return decode(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, '\n'),
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

async function copyImage(srcDir, src, destBase) {
  const file = path.join(srcDir, decodeURIComponent(path.basename(src)));
  const buf = await fs.readFile(file);
  const ext = buf.subarray(0, 4).toString('latin1') === 'RIFF' ? 'webp' : 'jpg';
  const name = `${destBase}.${ext}`;
  await fs.writeFile(path.join(assetDir, name), buf);
  return name;
}

async function main() {
  const htmlPath = process.argv[2];
  if (!htmlPath) throw new Error('Usage: npm run import:instagram -- /path/to/Instagram.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const filesDir = path.join(path.dirname(htmlPath), `${path.basename(htmlPath, '.html')}_files`);

  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.mkdir(path.join(assetDir, 'highlights'), { recursive: true });

  const posts = [];
  const seen = new Set();
  const postRe = /<a[^>]+href="([^"]*\/(p|reel)\/([^"/]+)\/?)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(postRe)) {
    const [, href, type, code, inner] = m;
    if (!href.includes(`/${HANDLE}/`) || seen.has(code)) continue;
    const img = inner.match(/<img[^>]*>/);
    const src = img?.[0].match(/src="([^"]+)"/)?.[1];
    if (!src) continue;
    seen.add(code);
    const alt = decode(img[0].match(/alt="([^"]*)"/)?.[1] ?? '').trim();
    const kind = type === 'reel' || /Clip/.test(inner) ? 'reel' : /Carousel/.test(inner) ? 'carousel' : 'photo';
    posts.push({
      code,
      kind,
      pinned: /Pinned post icon/.test(inner),
      url: `https://www.instagram.com/${type}/${code}/`,
      caption: alt,
      image: await copyImage(filesDir, src, code),
    });
  }

  const hlSrcs = [...html.matchAll(/<img[^>]*alt="[^"]*highlight story picture"[^>]*>/g)].map(
    (m) => m[0].match(/src="([^"]+)"/)[1],
  );
  const lines = visibleText(html);
  const start = lines.indexOf('View archive') + 1;
  const end = lines.indexOf('Posts', start);
  const hlTitles = start > 0 && end > start ? lines.slice(start, end) : [];
  if (hlTitles.length !== hlSrcs.length) {
    throw new Error(`Highlight mismatch: ${hlSrcs.length} images vs ${hlTitles.length} titles`);
  }
  const highlights = [];
  for (const [i, src] of hlSrcs.entries()) {
    highlights.push({ title: hlTitles[i], image: await copyImage(filesDir, src, `highlights/${String(i + 1).padStart(2, '0')}`) });
  }

  const avatarSrc = [...html.matchAll(/<img[^>]*alt="Change profile photo"[^>]*>/g)]
    .map((m) => m[0].match(/src="([^"]+)"/)[1])
    .find((s) => /\(1\)\.jpg$/.test(decodeURIComponent(s)));
  const nameIdx = lines.indexOf(HANDLE);
  const at = (label) => lines[lines.indexOf(label, nameIdx) - 1];
  const profile = {
    handle: HANDLE,
    url: `https://www.instagram.com/${HANDLE}/`,
    name: lines[nameIdx + 2],
    posts: Number(at('posts')?.replace(/,/g, '')) || posts.length,
    category: lines[lines.indexOf('following', nameIdx) + 1],
    bio: lines.slice(lines.indexOf('following', nameIdx) + 2, lines.indexOf('Link icon', nameIdx)),
    avatar: avatarSrc ? await copyImage(filesDir, avatarSrc, 'avatar') : null,
  };

  await fs.writeFile(outJson, JSON.stringify({ importedAt: new Date().toISOString(), profile, highlights, posts }, null, 2) + '\n');
  console.log(`Imported ${posts.length} posts, ${highlights.length} highlights → ${path.relative(root, outJson)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
