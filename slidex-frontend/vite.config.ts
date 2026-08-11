import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: true, // Pozwala na dostęp z IP sieci lokalnej (np. 10.0.2.28)
    port: 5173,
    allowedHosts: [
      'blnltshe0001.global.borgwarner.net'
    ]
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'BorgWarner Slidex Terminal',
        short_name: 'BW Slidex',
        description: 'System FIFO i Pick-to-Light',
        theme_color: '#051729',
        background_color: '#051729',
        display: 'standalone',
        start_url: './scanner/scan-in',
        scope: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});