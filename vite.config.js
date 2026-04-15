import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // IMPORTANT: Set base to your repository name
  base: '/rp-scout/', 
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Ensure the manifest and worker use the correct base path
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'RP Scout',
        short_name: 'RPScout',
        description: 'AI-Powered Roleplay Advertisement Scout',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2583/2583344.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
