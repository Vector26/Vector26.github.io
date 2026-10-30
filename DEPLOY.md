# Deploy to vector26.github.io

Everything lives in [Vector26/Vector26.github.io](https://github.com/Vector26/Vector26.github.io):

| Branch | Contents |
|--------|----------|
| `source` | This Astro project |
| `master` | Built static site served by GitHub Pages (plus `.github/workflows/publish.yml`) |

`.github/workflows/publish.yml` (must exist on both branches) builds `source` and commits `dist/` to `master` when the output changed. It runs:

- hourly (picks up new Substack posts),
- on every push to `source`,
- manually from the Actions tab (**Build and publish site → Run workflow**) to publish a new post immediately.

GitHub pauses scheduled workflows after 60 days without repository activity; re-enable it from the Actions tab if that happens.

## Edit and publish

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm ci && npm run build && npm run preview
git push origin HEAD:source
```

## Substack sync

`npm run build` runs `scripts/sync-substack.mjs` first. It pulls the RSS feed, cleans each post's HTML into `src/data/substack.json`, and refreshes `src/content/blog/`. If the feed is unreachable, the build continues with the last synced posts.

## Pinterest sync

`npm run build` also runs `scripts/sync-pinterest.mjs`, which mirrors the pins created by `hritik26rai` (newest first) using Pinterest's public web endpoint. It downloads only new pins, encodes new video pins with ffmpeg into `public/media/pinterest/`, and drops pins deleted on Pinterest. The workflow copies new videos into `master` under `/media/` and commits the synced data back to `source`. If Pinterest is unreachable, the build keeps the last synced pins.

## Instagram and Pinterest media

Photos live in `src/assets/instagram/` and `src/assets/pinterest/` and go through the normal image pipeline. Video (~250 MB) lives in `public/media/`, which is gitignored on `source` and committed directly to `master` under `/media/`; the workflow never deletes it.

To refresh after re-importing:

```bash
npm run import:instagram -- /path/to/Instagram.html
npm run import:instagram-media -- <yt-dlp-dir> <encoded-dir>
# then copy public/media/ into a master checkout under media/, commit, push
```

Videos are expected pre-encoded: H.264, max 720px on the short edge, CRF 26, AAC 96k, `-movflags +faststart`, with a poster `{name}.jpg` beside each `.mp4`.
