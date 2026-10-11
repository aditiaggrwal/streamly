import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
  server: {
    proxy: {
      '/__justwatch': {
        target: 'https://apis.justwatch.com',
        changeOrigin: true,
        rewrite: () => '/graphql',
      },
    },
  },
})
