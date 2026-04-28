import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: command === 'serve' ? '/' : './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.VITE_DEV_PORT || 5173),
    strictPort: false,
  },
}))
