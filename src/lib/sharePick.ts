import { STREAMING_SERVICES } from '../data/constants'
import type { Movie } from '../types'
import { movieWithWatchUrls } from './justwatch'
import { corsSafePosterUrl } from './poster'
import { getServiceWatchUrl, isJustWatchUrl } from './watchLinks'

function isTmdbUrl(url: string): boolean {
  return /themoviedb\.org/i.test(url)
}

function isShareableWatchUrl(url: string): boolean {
  const href = url.trim()
  return Boolean(href) && !isTmdbUrl(href) && !isJustWatchUrl(href)
}

function firstWatchService(movie: Movie) {
  const serviceId = movie.streamingServices[0]
  if (!serviceId) return null
  const service = STREAMING_SERVICES.find((entry) => entry.id === serviceId)
  if (!service) return null
  const href = getServiceWatchUrl(movie, serviceId)
  return {
    service,
    href: isShareableWatchUrl(href) ? href.trim() : '',
  }
}

export function pickShareUrl(movie: Movie): string {
  const first = firstWatchService(movie)
  if (first?.href) return first.href

  const watch = movie.watchUrl?.trim() ?? ''
  if (isShareableWatchUrl(watch)) return watch

  return ''
}

export function pickShareText(movie: Movie): string {
  const title = movie.title.trim() || 'this'
  const service = firstWatchService(movie)?.service
  return service
    ? `Let's watch ${title} tonight on ${service.label}:`
    : `Let's watch ${title} tonight:`
}

function streamlyHomeUrl(): string {
  return 'https://watchstreamly.web.app/'
}

function composeShareMessage(movie: Movie, url: string): string {
  const text = pickShareText(movie)
  const home = streamlyHomeUrl()
  const lines = url ? `${text}\n${url}` : text
  return `${lines}\n\nFind your next watch on ${home}`
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
    if (lines.length === maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[lines.length - 1] ?? ''
    let clipped = last
    while (clipped && ctx.measureText(`${clipped}…`).width > maxWidth) {
      clipped = clipped.slice(0, -1)
    }
    lines[lines.length - 1] = `${clipped}…`
  }
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load poster.'))
    image.src = src
  })
}

const SHARE_FONT = '"Plus Jakarta Sans", system-ui, sans-serif'

async function ensureShareFont() {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all([
    document.fonts.load('500 36px "Plus Jakarta Sans"'),
    document.fonts.load('600 58px "Plus Jakarta Sans"'),
    document.fonts.load('700 58px "Plus Jakarta Sans"'),
  ])
  await document.fonts.ready
}

function decodeLocalImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load logo.'))
    image.src = src
  })
}

async function loadBrandMark(): Promise<HTMLImageElement | null> {
  const base = import.meta.env.BASE_URL
  for (const file of ['logo-lockup-v3.png', 'logo-icon.png']) {
    try {
      return await decodeLocalImage(`${base}${file}`)
    } catch {
      // Try the next mark.
    }
  }
  return null
}

async function loadPosterImage(url: string): Promise<HTMLImageElement | null> {
  const candidates = [corsSafePosterUrl(url, 780), corsSafePosterUrl(url, 342), url]
  for (const src of candidates) {
    try {
      return await decodeImage(src)
    } catch {
      // Try the next source.
    }
  }
  return null
}

export async function composeShareCard(movie: Movie): Promise<Blob | null> {
  if (typeof document === 'undefined') return null
  await ensureShareFont()

  const width = 960
  const height = 720
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#0b0a14'
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(
    width / 2,
    -height * 0.12,
    20,
    width / 2,
    height * 0.1,
    width * 0.7,
  )
  glow.addColorStop(0, '#241c42')
  glow.addColorStop(0.42, '#241c42cc')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  const pad = 48
  const posterH = height - pad * 2
  const posterW = Math.round(posterH * (2 / 3))
  const posterX = pad
  const posterY = pad
  const [poster, brand] = await Promise.all([
    movie.posterUrl ? loadPosterImage(movie.posterUrl) : Promise.resolve(null),
    loadBrandMark(),
  ])

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  roundRect(ctx, posterX, posterY, posterW, posterH, 28)
  ctx.clip()

  if (poster) {
    const scale = Math.max(posterW / poster.width, posterH / poster.height)
    const drawW = poster.width * scale
    const drawH = poster.height * scale
    ctx.drawImage(
      poster,
      posterX - (drawW - posterW) / 2,
      posterY - (drawH - posterH) / 2,
      drawW,
      drawH,
    )
  } else {
    const wash = ctx.createLinearGradient(posterX, posterY, posterX + posterW, posterY + posterH)
    wash.addColorStop(0, movie.accent)
    wash.addColorStop(1, '#15131f')
    ctx.fillStyle = wash
    ctx.fillRect(posterX, posterY, posterW, posterH)
    ctx.fillStyle = '#f5f3fa'
    ctx.font = `700 96px ${SHARE_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(
      movie.title.charAt(0) || 'S',
      posterX + posterW / 2,
      posterY + posterH / 2 + 32,
    )
  }
  ctx.restore()

  const textX = posterX + posterW + 40
  const textW = width - textX - pad
  const title = movie.title.trim() || 'this'
  const service = firstWatchService(movie)?.service
  const serviceLine = service ? `Tonight on ${service.label}` : 'Tonight'

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#f5f3fa'
  ctx.font = `500 28px ${SHARE_FONT}`
  ctx.fillText("Let's watch", textX, 210)

  ctx.font = `700 48px ${SHARE_FONT}`
  const titleLines = wrapLines(ctx, title, textW, 2)
  titleLines.forEach((line, index) => {
    ctx.fillText(line, textX, 274 + index * 56)
  })

  const afterTitle = 274 + titleLines.length * 56
  ctx.fillStyle = '#d8d3e8'
  ctx.font = `500 26px ${SHARE_FONT}`
  ctx.fillText(serviceLine, textX, afterTitle + 40)

  if (brand) {
    const wideLockup = brand.width / brand.height > 1.4
    const srcH = wideLockup ? brand.height * 0.68 : brand.height
    const logoW = wideLockup ? Math.min(240, textW) : 52
    const logoH = logoW * (srcH / brand.width)
    ctx.drawImage(
      brand,
      0,
      0,
      brand.width,
      srcH,
      textX,
      height - pad - logoH,
      logoW,
      logoH,
    )
  } else {
    ctx.fillStyle = '#9a93b3'
    ctx.font = `500 20px ${SHARE_FONT}`
    ctx.fillText('via Streamly', textX, afterTitle + 78)
  }

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
  })
}

async function copyShare(card: Blob | null, message: string) {
  const clipboard = navigator.clipboard
  if (card && clipboard && 'write' in clipboard && typeof ClipboardItem === 'function') {
    try {
      await clipboard.write([
        new ClipboardItem({
          'image/jpeg': Promise.resolve(card),
          'text/plain': Promise.resolve(new Blob([message], { type: 'text/plain' })),
        }),
      ])
      return
    } catch {
      // Fall through to text-only copy.
    }
  }
  if (message) await clipboard.writeText(message)
}

async function sharePayload(data: ShareData): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false
  try {
    await navigator.share(data)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return false
  }
}

export async function sharePick(movie: Movie): Promise<'shared' | 'copied'> {
  const resolved = await movieWithWatchUrls(movie)
  const url = pickShareUrl(resolved)
  const message = composeShareMessage(resolved, url)
  const card = await composeShareCard(resolved)
  const file = card
    ? new File(
        [card],
        `${resolved.title.replace(/[^\w]+/g, '-').toLowerCase()}-streamly.jpg`,
        { type: 'image/jpeg' },
      )
    : null

  if (file && (await sharePayload({ files: [file], text: message }))) return 'shared'
  if (await sharePayload({ text: message })) return 'shared'

  await copyShare(card, message)
  return 'copied'
}
