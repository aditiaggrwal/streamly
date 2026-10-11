export function corsSafePosterUrl(url: string, width = 780): string {
  const source = url
    .replace('/w342/', `/w${width}/`)
    .replace('/w185/', `/w${width}/`)
    .replace('/w500/', `/w${width}/`)
  return `https://images.weserv.nl/?url=${encodeURIComponent(
    source.replace(/^https?:\/\//, ''),
  )}&w=${width}`
}
