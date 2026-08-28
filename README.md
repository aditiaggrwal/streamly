# Streamly

Pick a movie based on your mood, genre preferences, and streaming subscriptions.

## Features

- Multi-select moods, genres, and streaming services
- Live recommendations from [TMDB](https://www.themoviedb.org/) when an API key is set
- Posters and US streaming availability (JustWatch via TMDB)
- Fallback to a curated catalog if the key is missing or TMDB is down
- Saved streaming service preferences (localStorage)
- Reset all to start fresh

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/streamly/](http://localhost:5173/streamly/).

## TMDB catalog

Streamly calls TMDB from the browser (no backend). Moods are mapped onto TMDB genres and keywords, then results are scored locally so "Why this one?" still reads like Streamly.

### Local setup

1. Create a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (the default *API Key* / v3 key).
2. Copy `.env.example` to `.env`.
3. Set `VITE_TMDB_API_KEY=your_key_here`.
4. Restart `npm run dev`.

Without a key, the app still works using the built-in curated list.

The key is exposed in the frontend bundle. That is acceptable for TMDB's public API key. Do not commit a real key (`.env` is gitignored).

### GitHub Pages

Pushes to `main` auto-deploy via GitHub Actions.

1. In the repo: **Settings → Secrets and variables → Actions**.
2. Add a repository secret named `VITE_TMDB_API_KEY`.
3. The deploy workflow passes it into the Vite build as `VITE_TMDB_API_KEY`.

If the secret is missing, the live site falls back to the curated catalog.

## Stack

- React + TypeScript + Vite

## Live site

Deployed to GitHub Pages: [aditiaggrwal.github.io/streamly](https://aditiaggrwal.github.io/streamly/)
