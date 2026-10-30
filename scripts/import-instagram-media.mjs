#!/usr/bin/env node
/**
 * Attach full Instagram media (carousel slides, videos, captions, dates) to src/data/instagram.json.
 * Usage: npm run import:instagram-media -- <download-dir> <encoded-dir>
 *   download-dir: yt-dlp output, one folder per post code ({NN}-{id}.jpg|mp4) plus meta/{code}.json
 *   encoded-dir:  web-encoded videos at instagram/{code}/{NN}.mp4 with a poster {NN}.jpg beside each
 * Images and posters go to src/assets/instagram/{code}/; videos to public/media/instagram/{code}/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'src/assets/instagram');
const mediaDir = path.join(root, 'public/media/instagram');
const dataFile = path.join(root, 'src/data/instagram.json');

function videoSize(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = out.trim().split(',').map(Number);
  return { w, h };
}

async function imageExt(file) {
  const fh = await fs.open(file);
  const { buffer } = await fh.read(Buffer.alloc(4), 0, 4, 0);
  await fh.close();
  return buffer.toString('latin1') === 'RIFF' ? 'webp' : 'jpg';
}

async function main() {
  const [dlDir, encDir] = process.argv.slice(2);
  if (!dlDir || !encDir) throw new Error('Usage: npm run import:instagram-media -- <download-dir> <encoded-dir>');

  const data = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  await fs.rm(mediaDir, { recursive: true, force: true });

  for (const post of data.posts) {
    const dir = path.join(dlDir, post.code);
    const meta = JSON.parse(await fs.readFile(path.join(dlDir, 'meta', `${post.code}.json`), 'utf8'));
    const files = (await fs.readdir(dir)).filter((f) => /^\d+-.+\.(jpg|mp4)$/.test(f)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (!files.length) throw new Error(`no media for ${post.code}`);

    await fs.mkdir(path.join(assetDir, post.code), { recursive: true });
    const slides = [];
    for (const f of files) {
      const idx = f.split('-')[0];
      if (f.endsWith('.mp4')) {
        const enc = path.join(encDir, 'instagram', post.code, `${idx}.mp4`);
        const { w, h } = videoSize(enc);
        await fs.mkdir(path.join(mediaDir, post.code), { recursive: true });
        await fs.copyFile(enc, path.join(mediaDir, post.code, `${idx}.mp4`));
        const poster = `${post.code}/${idx}-poster.jpg`;
        await fs.copyFile(enc.replace(/\.mp4$/, '.jpg'), path.join(assetDir, poster));
        slides.push({ type: 'video', src: `/media/instagram/${post.code}/${idx}.mp4`, poster, w, h });
      } else {
        const src = path.join(dir, f);
        const name = `${post.code}/${idx}.${await imageExt(src)}`;
        await fs.copyFile(src, path.join(assetDir, name));
        slides.push({ type: 'image', src: name });
      }
    }

    post.slides = slides;
    post.kind = slides.length > 1 ? 'carousel' : slides[0].type === 'video' ? 'reel' : 'photo';
    if (meta.description) post.caption = meta.description.trim();
    if (meta.timestamp) post.date = new Date(meta.timestamp * 1000).toISOString();
    if (typeof meta.like_count === 'number') post.likes = meta.like_count;
  }

  for (const h of data.highlights ?? []) {
    await fs.rm(path.join(assetDir, h.image), { force: true });
  }
  await fs.rm(path.join(assetDir, 'highlights'), { recursive: true, force: true });
  delete data.highlights;

  await fs.writeFile(dataFile, `${JSON.stringify(data, null, 2)}\n`);
  const count = (t) => data.posts.reduce((n, p) => n + p.slides.filter((s) => s.type === t).length, 0);
  console.log(`posts ${data.posts.length} · images ${count('image')} · videos ${count('video')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
