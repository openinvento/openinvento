import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

// Using vite-plugin-pwa to manage PWA support
import { VitePWA } from 'vite-plugin-pwa';
import { pwaConfig } from './pwa.config.ts' // import custom config for PWA

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = env.VITE_BACKEND_ORIGIN || "http://localhost:8000"
  const proxy = {
    '/api': {
      target: backendOrigin,
      changeOrigin: true,
    },
    '/media': {
      target: backendOrigin,
      changeOrigin: true,
    },
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA(pwaConfig),
      babel({ presets: [reactCompilerPreset()] })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy,
      allowedHosts: env.VITE_ALLOWED_HOSTS 
        ? env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()) 
        : [],
    },
    preview: {
      proxy,
    },
  }
})
