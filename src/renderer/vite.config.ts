import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const viteDevPortFile = path.join(projectRoot, '.vite-dev-port')

/** 供 Electron 启动脚本读取实际端口（5173 被占用时 Vite 会自动递增） */
function writeDevPortPlugin(): Plugin {
  return {
    name: 'private-rag-write-vite-dev-port',
    configureServer(server) {
      try {
        fs.unlinkSync(viteDevPortFile)
      } catch {
        /* 不存在则忽略 */
      }
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        if (addr && typeof addr === 'object' && addr.port) {
          try {
            fs.writeFileSync(viteDevPortFile, String(addr.port), 'utf8')
          } catch (e) {
            console.warn('[vite] 无法写入 .vite-dev-port', e)
          }
        }
      })
      return () => {
        try {
          fs.unlinkSync(viteDevPortFile)
        } catch {
          /* ignore */
        }
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: command === 'serve' ? '/' : './',
  plugins: [react(), ...(command === 'serve' ? [writeDevPortPlugin()] : [])],
  server: {
    // 与 Electron 统一用 IPv4，避免只监听 ::1 时 127.0.0.1 连不上
    host: '127.0.0.1',
    port: Number(process.env.VITE_DEV_PORT || 5173),
    /** 默认端口被占用时自动尝试下一个，避免 dev 链整体失败 */
    strictPort: false,
  },
}))
