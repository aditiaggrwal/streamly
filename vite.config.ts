import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const watchLinksModule = fileURLToPath(
  new URL('./functions/watchLinks.js', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'watch-links-dev',
      configureServer(server) {
        const { handleWatchLinks } = require(watchLinksModule) as {
          handleWatchLinks: (req: IncomingMessage, res: ServerResponse) => Promise<void>
        }
        server.middlewares.use((req, res, next) => {
          const path = (req.url || '').split('?')[0]
          if (path !== '/api/watch-links') {
            next()
            return
          }
          void Promise.resolve(handleWatchLinks(req, res)).catch(() => {
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end('{"error":"Watch links unavailable"}')
            }
          })
        })
      },
    },
    {
      name: 'privacy-pretty-url',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/privacy' || req.url === '/privacy/') {
            req.url = '/privacy.html'
          }
          if (req.url?.startsWith('/invite')) {
            req.url = req.url.replace(/^\/invite\/?/, '/invite.html')
          }
          next()
        })
      },
    },
  ],
  base: '/',
})
