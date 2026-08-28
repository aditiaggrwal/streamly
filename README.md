# Streamly

Pick a movie based on your mood, genre preferences, and streaming subscriptions.

## Features

- Multi-select moods, genres, and streaming services
- Live recommendations from [TMDB](https://www.themoviedb.org/) when an API key is set
- Posters and US streaming availability (JustWatch via TMDB)
- Watch links to the TMDB / JustWatch “where to watch” page
- Fallback to a curated catalog if the key is missing or TMDB fails
- Saved streaming service preferences (localStorage)
- Reset all to start fresh

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/streamly/](http://localhost:5173/streamly/).

## TMDB catalog

Streamly calls TMDB from the browser (no backend). Moods are mapped onto TMDB genres and keywords, then results are scored locally so “Why this one?” still reads like Streamly. Selected genres constrain the match count and the pick pool (a title must match at least one selected genre).

### Local setup

1. Create a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (the default *API Key* / v3 key).
2. Copy `.env.example` to `.env`.
3. Set `VITE_TMDB_API_KEY=your_key_here`.
4. Restart `npm run dev`.

Without a key, the app still works using the built-in curated list.

The key is exposed in the frontend bundle. That is acceptable for TMDB’s public API key. Do not commit a real key (`.env` is gitignored).

### GitHub Actions deploy

Pushes to `main` run `.github/workflows/deploy.yml`, which builds with `VITE_TMDB_API_KEY` from repository secrets and deploys to Pages.

1. In the repo: **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `VITE_TMDB_API_KEY`.

If the secret is missing, the built site falls back to the curated catalog.

### Manual `gh-pages` deploy (no Actions)

If GitHub Actions cannot run (for example an account billing lock), publish `dist/` to the `gh-pages` branch yourself. The live site is served from that branch.

Production TMDB build:

```bash
# .env already contains VITE_TMDB_API_KEY=...
npm ci
npm run deploy:gh-pages
```

Or step by step:

```bash
npm ci
npm run build          # inlines VITE_TMDB_API_KEY from .env
# then publish the contents of dist/ to the gh-pages branch root
# (the deploy:gh-pages script does this via a git worktree)
```

Never commit `.env` or a real API key.

## Stack

- React + TypeScript + Vite

## Live site

Deployed to GitHub Pages: [aditiaggrwal.github.io/streamly](https://aditiaggrwal.github.io/streamly/)
