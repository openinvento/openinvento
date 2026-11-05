import { type VitePWAOptions } from 'vite-plugin-pwa';

export const pwaConfig: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    // Without this the service worker answers navigations to the backend, such as the OIDC
    // callback, with index.html, and the request never reaches the server.
    navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
  },
  manifest: {
    name: 'OpenInvento',
    short_name: 'OpenInvento',
    description: 'Inventory management system',
    theme_color: '#ffffff',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/app',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  }
};
