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
