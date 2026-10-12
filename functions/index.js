const { onRequest } = require('firebase-functions/v2/https')

const HOME = 'https://watchstreamly.web.app'
const FALLBACK_IMAGE = `${HOME}/og-v6.jpg`

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHttpsUrl(raw, extraDenied = []) {
  try {
    const url = new URL(String(raw || '').trim())
    if (url.protocol !== 'https:') return ''
    const host = url.hostname.toLowerCase()
    if (extraDenied.some((pattern) => pattern.test(host))) return ''
    return url.toString()
  } catch {
    return ''
  }
}

function safePoster(raw) {
  const url = safeHttpsUrl(raw)
  if (!url) return ''
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (
      host.endsWith('image.tmdb.org') ||
      host.endsWith('themoviedb.org') ||
      host.endsWith('weserv.nl') ||
      host.endsWith('watchstreamly.web.app')
    ) {
      return url
    }
  } catch {
    return ''
  }
  return ''
}

function render({ t, y, p, s, w }) {
  const title = String(t || '').trim() || 'tonight'
  const year = String(y || '').trim()
  const service = String(s || '').trim()
  const poster = safePoster(p)
  const watch = safeHttpsUrl(w, [/justwatch\.com$/i, /themoviedb\.org$/i])
  const pageTitle = title === 'tonight' ? "Let's watch tonight" : `Let's watch ${title}`
  const description = service
    ? `Tonight on ${service}`
    : year
      ? year
      : 'A friend picked something to watch tonight.'
  const image = poster || FALLBACK_IMAGE
  const watchHref = watch || HOME
  const watchLabel = watch && service ? `Watch on ${service}` : watch ? 'Watch' : 'Find your next watch'
  const posterHtml = poster
    ? `<img class="poster" src="${esc(poster)}" alt="${esc(title)}" />`
    : ''
  const serviceHtml = description ? `<p class="service">${esc(description)}</p>` : ''
  const canonical = `${HOME}/invite`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b0a14" />
    <title>${esc(pageTitle)} · Streamly</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <link rel="icon" type="image/png" href="/logo-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Streamly" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content="${esc(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(pageTitle)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <style>
      @font-face {
        font-family: 'Plus Jakarta Sans';
        src: url('/fonts/PlusJakartaSans.ttf') format('truetype');
        font-weight: 200 800;
        font-style: normal;
        font-display: swap;
      }
      :root { color-scheme: dark; --bg: #0b0a14; --text: #f5f3fa; --muted: #9a93b3; --accent: #7c5cff; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; min-height: 100%;
        background: radial-gradient(ellipse 900px 500px at 50% -10%, #241c42 0%, transparent 60%), var(--bg);
        color: var(--text);
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      }
      main { width: min(420px, calc(100% - 40px)); margin: 0 auto; padding: 48px 0 64px; text-align: center; }
      .lockup { display: block; width: min(260px, 80vw); height: auto; margin: 0 auto 28px; }
      .poster { width: min(240px, 70vw); aspect-ratio: 2 / 3; object-fit: cover; border-radius: 20px; background: #15131f; box-shadow: 0 18px 40px rgba(0,0,0,.45); }
      .kicker { margin: 28px 0 8px; color: var(--muted); font-size: .95rem; font-weight: 500; }
      h1 { margin: 0 0 8px; font-size: 1.85rem; font-weight: 700; line-height: 1.2; }
      .service { margin: 0 0 28px; color: #d8d3e8; font-size: 1rem; font-weight: 500; }
      .watch { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 700; font-size: .95rem; text-decoration: none; }
      .home { display: inline-block; margin-top: 16px; color: var(--muted); font-size: .85rem; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <img class="lockup" src="/logo-lockup-v3.png" alt="Streamly" />
      ${posterHtml}
      <p class="kicker">Let's watch</p>
      <h1>${esc(title)}</h1>
      ${serviceHtml}
      <a class="watch" href="${esc(watchHref)}">${esc(watchLabel)}</a>
      <a class="home" href="/">Find another pick on Streamly</a>
    </main>
  </body>
</html>`
}

exports.invite = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
  },
  (req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    res.status(200).send(render(req.query))
  },
)
