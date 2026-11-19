import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['icon.svg', 'robots.txt'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,ico,txt}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: false,
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
})
