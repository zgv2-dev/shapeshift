import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(process.cwd(), 'index.html'),
        studio: resolve(process.cwd(), 'studio/index.html'),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5181,
    strictPort: true,
  },
})
