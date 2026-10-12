# Streamly

Pick a movie based on your mood, genre preferences, and streaming subscriptions.

## Features

- Multi-select moods, genres, and streaming services
- Live recommendations from [TMDB](https://www.themoviedb.org/) when an API key is set
- Posters and US streaming availability (JustWatch via TMDB)
- Direct watch links to Disney+, Netflix, and other services when JustWatch has a title page
- Fallback to a curated catalog if the key is missing or TMDB fails
- Saved streaming service preferences for signed-in users
- Reset all to start fresh

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

## TMDB catalog

Streamly calls TMDB from the browser (no backend). Moods are mapped onto TMDB genres and keywords, then results are scored locally so “Why this one?” still reads like Streamly. Selected genres constrain the match count and the pick pool (a title must match at least one selected genre).

### Local setup

1. Create a free API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (the default *API Key* / v3 key).
2. Copy `.env.example` to `.env`.
3. Set `VITE_TMDB_API_KEY=your_key_here`.
4. Restart `npm run dev`.

Without a key, the app still works using the built-in curated list.

The key is exposed in the frontend bundle. That is acceptable for TMDB’s public API key. Do not commit a real key (`.env` is gitignored).

## Watch links

The “Watch on …” button starts on a service search link, then swaps to a direct title URL when `watch-links.json` has one. That file is built ahead of time (`npm run watch-links`) by querying JustWatch from Node, so the browser never calls JustWatch and there is no Cloud Function. Disney+ and Hulu are the full US subscription catalogs, not a popular sample. Links have to be `https` on that service’s own host (for example `disneyplus.com` or `hulu.com`). A title missing from the file keeps the search link.

Refresh the snapshot when streaming rights move, then redeploy Hosting:

```bash
npm run watch-links
npm run deploy:firebase
```

## Deploy (Firebase Hosting)

The live site is served from the Firebase project `streamly-167bd` at the site root (`/`), not a `/streamly/` subpath. The project stays on the **Spark** plan. Spark can publish Hosting. It cannot deploy Cloud Functions, and this deploy does not try to.

```bash
# .env already contains VITE_TMDB_API_KEY and VITE_FIREBASE_*  (never commit this file)
npm ci
npm run deploy:firebase
```

That builds the app and runs `firebase deploy --only hosting` for project `streamly-167bd`.

`npx firebase-tools login` once before the first deploy, with the Google account that owns `streamly-167bd`. Do not commit `.env`.

The old GitHub Pages URL (`aditiaggrwal.github.io/streamly/`) redirects to Firebase. Republish that redirect with `npm run deploy:gh-pages` if the live URL changes.

### Custom domain

1. Buy a domain (Namecheap, Google Domains / Squarespace, Cloudflare, etc.).
2. In [Firebase Console → Hosting](https://console.firebase.google.com/project/streamly-167bd/hosting) click **Add custom domain**.
3. Add the domain (and `www` if you want both).
4. Create the DNS records Firebase shows (usually an A record and a TXT record).
5. Add the same domain under **Authentication → Settings → Authorized domains**.
6. Wait for SSL to provision (often minutes, sometimes up to 24 hours).

## Accounts (Firebase)

Sign-in is optional. Guests still use the questionnaire and re-enter services each visit. Signed-in users save services to Firestore and skip the services step on later visits.

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Enable **Authentication → Email/Password** and **Google**.
   Add authorized domains: `localhost` and `watchstreamly.web.app`.
3. Create a **Firestore** database (start in production mode) and publish the rules in `firestore.rules`.
4. **Authentication → Settings → Authorized domains**: add `localhost`, `watchstreamly.web.app`, `streamly-167bd.web.app`, and your custom domain.
5. **Project settings → Your apps → Web app**: copy the config into `.env` using the `VITE_FIREBASE_*` names in `.env.example`.
6. Restart `npm run dev`, then redeploy with `npm run deploy:firebase`.

The Firebase web config is public in the frontend bundle. That is expected. Security comes from Firestore rules (each user can only read/write `users/{theirUid}`).

If Firebase env vars are missing, the Sign in button is hidden and the app behaves as a guest-only site.

## Stack

- React + TypeScript + Vite
- Firebase Auth + Firestore
- Firebase Hosting (Spark plan)

## Live site

[https://watchstreamly.web.app/](https://watchstreamly.web.app/)
