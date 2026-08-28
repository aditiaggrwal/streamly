# Streamly

Pick a movie based on your mood, genre preferences, and streaming subscriptions.

## Features

- Multi-select moods, genres, and streaming services
- Scored recommendations from a curated catalog
- Saved streaming service preferences (localStorage)
- Reset all to start fresh

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Optional: TMDB integration

Copy `.env.example` to `.env` and add a free API key from [TMDB](https://www.themoviedb.org/settings/api):

```
VITE_TMDB_API_KEY=your_key_here
```

## Stack

- React + TypeScript + Vite

## Live site

Deployed to GitHub Pages: [aditiaggrwal.github.io/streamly](https://aditiaggrwal.github.io/streamly/)

Pushes to `main` auto-deploy via GitHub Actions.
