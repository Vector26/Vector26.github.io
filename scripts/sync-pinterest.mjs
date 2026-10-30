#!/usr/bin/env node
/**
 * Mirror the pins created by PINTEREST_USER into the site, newest first.
 * New pins: original image → src/assets/pinterest/{id}.jpg (long edge ≤ 2400px);
 *           video pins → public/media/pinterest/{id}.mp4 (720p H.264, faststart).
 * Pins deleted on Pinterest are dropped. If Pinterest can't be reached, the last sync is kept.
 * Requires ffmpeg/ffprobe on PATH.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const USER = 'hritik26rai';
const MAX_EDGE = 2400;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = path.join(root, 'src/assets/pinterest');
const mediaDir = path.join(root, 'public/media/pinterest');
const dataFile = path.join(root, 'src/data/pinterest.json');

const PROFILE = {
  name: 'Prometheus',
  handle: USER,
  url: `https://www.pinterest.com/${USER}/`,
  bio: 'Collective Journal of my soul',
};

async function getJson(url, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'X-Pinterest-PWS-Handler': 'www/[username]/_created.js' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function fetchCreatedPins() {
  const pins = [];
  let bookmark = null;
  for (let page = 0; page < 40; page++) {
    const options = { username: USER, page_size: 50, field_set_key: 'grid_item', ...(bookmark && { bookmarks: [bookmark] }) };
    const q = new URLSearchParams({ source_url: `/${USER}/_created/`, data: JSON.stringify({ options, context: {} }) });
    const { resource_response: r } = await getJson(`https://www.pinterest.com/resource/UserActivityPinsResource/get/?${q}`);
    if (r?.status !== 'success' || !Array.isArray(r.data)) throw new Error('unexpected Pinterest response');
    pins.push(...r.data.filter((p) => p?.id && p.images?.orig?.url));
    bookmark = r.bookmark;
    if (!bookmark || bookmark === '-end-' || !r.data.length) return pins;
  }
  throw new Error('too many pages; refusing a partial sync');
}

function videoUrl(pin) {
  const lists = [pin.videos?.video_list];
  for (const page of pin.story_pin_data?.pages_preview ?? pin.story_pin_data?.pages ?? []) {
    for (const block of page.blocks ?? []) lists.push(block.video?.video_list);
  }
  const variants = lists.filter(Boolean).flatMap((l) => Object.values(l)).filter((v) => v?.url);
  const mp4 = variants.filter((v) => v.url.endsWith('.mp4')).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return (mp4[0] ?? variants.find((v) => v.url.endsWith('.m3u8')))?.url ?? null;
}

function size(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = out.trim().split(',').map(Number);
  return { w, h };
}

async function saveImage(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`image ${res.status} ${url}`);
  const tmp = `${dest}.download`;
  await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  const { w, h } = size(tmp);
  const scale = Math.max(w, h) <= MAX_EDGE ? 'iw:ih' : w >= h ? `${MAX_EDGE}:-2` : `-2:${MAX_EDGE}`;
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', tmp, '-vf', `scale=${scale}:flags=lanczos`, '-frames:v', '1', '-q:v', '2', dest]);
  await fs.rm(tmp);
}

// ffmpeg stalls opening Pinterest's multi-variant HLS playlists, so pick the largest variant (and its audio) ourselves.
async function hlsInputs(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`playlist ${res.status}`);
  const lines = (await res.text()).split('\n').map((l) => l.trim());
  let best = null;
  lines.forEach((l, i) => {
    const height = Number(l.match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0);
    if (l.startsWith('#EXT-X-STREAM-INF') && (!best || height > best.height)) best = { height, uri: lines[i + 1] };
  });
  const audio = lines.find((l) => l.startsWith('#EXT-X-MEDIA:TYPE=AUDIO'))?.match(/URI="([^"]+)"/)?.[1];
  const abs = (u) => new URL(u, url).href;
  return best ? { video: abs(best.uri), audio: audio && abs(audio) } : { video: url };
}

async function saveVideo(url, dest) {
  const { video, audio } = url.endsWith('.m3u8') ? await hlsInputs(url) : { video: url };
  const input = (u) => ['-rw_timeout', '20000000', '-user_agent', UA, '-i', u];
  const tmp = `${dest}.part.mp4`;
  execFileSync('ffmpeg', [
    '-nostdin', '-loglevel', 'error', '-y', ...input(video), ...(audio ? input(audio) : []),
    '-map', '0:v:0', '-map', audio ? '1:a:0?' : '0:a:0?',
    '-vf', "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-maxrate', '1800k', '-bufsize', '3600k', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', tmp,
  ], { timeout: 300_000 });
  await fs.rename(tmp, dest);
}

const exists = (f) => fs.access(f).then(() => true, () => false);
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

async function main() {
  const prev = (await exists(dataFile)) ? JSON.parse(await fs.readFile(dataFile, 'utf8')) : { pins: [] };
  const known = new Map(prev.pins.map((p) => [p.id, p]));
  const remote = (await fetchCreatedPins()).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!remote.length) throw new Error('Pinterest returned no pins');

  await fs.mkdir(assetDir, { recursive: true });
  const pins = [];
  let added = 0;
  for (const p of remote) {
    const old = known.get(p.id);
    const image = `${p.id}.jpg`;
    if (!(await exists(path.join(assetDir, image)))) {
      await saveImage(p.images.orig.url, path.join(assetDir, image));
      added++;
    }
    const pin = {
      id: p.id,
      title: clean(p.title) || clean(p.grid_title) || clean(p.description) || 'Untitled',
      alt: clean(p.alt_text) || clean(p.auto_alt_text),
      date: new Date(p.created_at).toISOString(),
      image,
    };
    if (old?.video) {
      Object.assign(pin, { video: old.video, w: old.w, h: old.h });
    } else {
      const src = videoUrl(p);
      if (src) {
        await fs.mkdir(mediaDir, { recursive: true });
        const file = path.join(mediaDir, `${p.id}.mp4`);
        try {
          if (!(await exists(file))) await saveVideo(src, file);
          Object.assign(pin, { video: `/media/pinterest/${p.id}.mp4`, ...size(file) });
        } catch (e) {
          await fs.rm(`${file}.part.mp4`, { force: true });
          console.warn(`Pinterest: video for ${p.id} failed (${e.message.split('\n')[0]}); showing it as a photo.`);
        }
      }
    }
    pins.push(pin);
  }

  const keep = new Set(pins.map((p) => p.id));
  const removed = prev.pins.filter((p) => !keep.has(p.id));
  for (const p of removed) await fs.rm(path.join(assetDir, p.image), { force: true });

  const profile = { ...PROFILE, avatar: (await exists(path.join(assetDir, 'avatar.jpg'))) ? 'avatar.jpg' : null };
  const unchanged = JSON.stringify({ profile, pins }) === JSON.stringify({ profile: prev.profile, pins: prev.pins });
  if (!unchanged) {
    await fs.writeFile(dataFile, `${JSON.stringify({ syncedAt: new Date().toISOString(), profile, pins }, null, 2)}\n`);
  }
  console.log(`Pinterest: ${pins.length} pins (${added} new, ${removed.length} removed)${unchanged ? ', no changes' : ''}`);
}

main().catch(async (e) => {
  if (await exists(dataFile)) {
    console.warn(`Pinterest sync failed (${e.message}); building with the last synced pins.`);
    return;
  }
  console.error(e);
  process.exit(1);
});
