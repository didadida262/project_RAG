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
    // 与 Electron、wait-on 统一用 IPv4，避免只监听 ::1 时 127.0.0.1 连不上
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}))
