#!/usr/bin/env node
/**
 * Import Pinterest pins into the site.
 * Usage: npm run import:pinterest -- <pins.json> <originals-dir> <encoded-dir> [avatar.jpg]
 *   pins.json:      [{ id, title, alt, video }] in profile order
 *   originals-dir:  {id}.jpg full-size pin images (also used as video posters)
 *   encoded-dir:    pinterest/{id}.mp4 web-encoded videos
 * Images are capped at 2400px on the long edge into src/assets/pinterest/; videos go to public/media/pinterest/.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_EDGE = 2400;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'src/assets/pinterest');
const mediaDir = path.join(root, 'public/media/pinterest');
const dataFile = path.join(root, 'src/data/pinterest.json');

const PROFILE = {
  name: 'Prometheus',
  handle: 'hritik26rai',
  url: 'https://www.pinterest.com/hritik26rai/',
  bio: 'Collective Journal of my soul',
};

function size(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = out.trim().split(',').map(Number);
  return { w, h };
}

function shrink(src, dest) {
  const { w, h } = size(src);
  if (Math.max(w, h) <= MAX_EDGE) return fs.copyFile(src, dest);
  const scale = w >= h ? `${MAX_EDGE}:-2` : `-2:${MAX_EDGE}`;
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', src, '-vf', `scale=${scale}:flags=lanczos`, '-q:v', '2', dest]);
}

async function main() {
  const [pinsFile, origDir, encDir, avatar] = process.argv.slice(2);
  if (!pinsFile || !origDir || !encDir) throw new Error('Usage: npm run import:pinterest -- <pins.json> <originals-dir> <encoded-dir> [avatar.jpg]');
  const pins = JSON.parse(await fs.readFile(pinsFile, 'utf8'));

  await fs.rm(assetDir, { recursive: true, force: true });
  await fs.rm(mediaDir, { recursive: true, force: true });
  await fs.mkdir(assetDir, { recursive: true });
  await fs.mkdir(mediaDir, { recursive: true });

  const out = [];
  for (const p of pins) {
    const image = `${p.id}.jpg`;
    shrink(path.join(origDir, image), path.join(assetDir, image));
    const pin = { id: p.id, title: p.title.trim(), alt: (p.alt ?? '').replace(/^This (may )?contains?:?\s*(an image of:?)?\s*/i, '').trim(), image };
    const video = path.join(encDir, 'pinterest', `${p.id}.mp4`);
    if (p.video && (await fs.stat(video).catch(() => null))) {
      await fs.copyFile(video, path.join(mediaDir, `${p.id}.mp4`));
      const { w, h } = size(video);
      Object.assign(pin, { video: `/media/pinterest/${p.id}.mp4`, w, h });
    }
    out.push(pin);
  }

  const profile = { ...PROFILE, avatar: null };
  if (avatar) {
    await fs.copyFile(avatar, path.join(assetDir, 'avatar.jpg'));
    profile.avatar = 'avatar.jpg';
  }

  await fs.writeFile(dataFile, `${JSON.stringify({ importedAt: new Date().toISOString(), profile, pins: out }, null, 2)}\n`);
  console.log(`pins ${out.length} · videos ${out.filter((p) => p.video).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
