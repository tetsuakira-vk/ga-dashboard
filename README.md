# GA Dashboard

Static traffic dashboard for japaneseunlocked.com and vkchronicle.com, pulling
daily/monthly sessions, users and pageviews straight from GA4 — no database.

## How it works

- `scripts/fetch-data.js` calls the GA4 Data API and writes `docs/data.json`
- `docs/index.html` is a static page that reads that JSON and renders the charts
- A GitHub Actions workflow (`.github/workflows/update-data.yml`) runs the
  fetch script daily and commits the refreshed `docs/data.json`
- GitHub Pages serves the `docs/` folder as the live site

## Local setup

```bash
npm install
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json node scripts/fetch-data.js
npx serve docs
```

## GitHub setup (one-time)

1. Repo secret **GA_SERVICE_ACCOUNT_KEY** — paste the full contents of the
   service account JSON key
2. Settings → Pages → deploy from branch `main`, folder `/docs`
3. The workflow also runs on-demand via **Actions → Update GA data → Run workflow**
