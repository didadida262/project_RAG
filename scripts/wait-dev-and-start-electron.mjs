#!/usr/bin/env node
/**
 * 等本机反代 8787 就绪 + Vite 写出实际端口后，再带 VITE_DEV_SERVER_URL 启动 Electron。
 * （Vite strictPort:false 时端口可能不是 5173）
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const portFile = path.join(projectRoot, '.vite-dev-port')

function httpGetOk(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      req.destroy()
      reject(new Error(`timeout ${url}`))
    }, timeoutMs)
    const req = http.get(url, (res) => {
      clearTimeout(t)
      res.resume()
      if (res.statusCode && res.statusCode < 500) resolve()
      else reject(new Error(`HTTP ${res.statusCode} ${url}`))
    })
    req.on('error', (err) => {
      clearTimeout(t)
      reject(err)
    })
  })
}

async function waitUrl(url, totalMs, intervalMs) {
  const deadline = Date.now() + totalMs
  let lastErr
  while (Date.now() < deadline) {
    try {
      await httpGetOk(url, 5000)
      return
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
  throw lastErr ?? new Error(`wait ${url} failed`)
}

async function main() {
  await waitUrl('http://127.0.0.1:8787/health', 120_000, 250)

  const deadline = Date.now() + 120_000
  let devUrl
  while (Date.now() < deadline) {
    if (fs.existsSync(portFile)) {
      const port = fs.readFileSync(portFile, 'utf8').trim()
      if (/^\d+$/.test(port)) {
        const url = `http://127.0.0.1:${port}`
        try {
          await httpGetOk(url, 5000)
          devUrl = url
          break
        } catch {
          /* Vite 尚未监听 */
        }
      }
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  if (!devUrl) {
    console.error(
      '[dev] 未检测到 Vite 端口（.vite-dev-port）。请确认 vite 已启动且 vite.config 已启用 writeDevPort 插件。',
    )
    process.exit(1)
  }

  const env = { ...process.env, VITE_DEV_SERVER_URL: devUrl }
  const electronBin = path.join(
    projectRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron',
  )

  const child = spawn(electronBin, ['.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  })
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
}

main().catch((e) => {
  console.error('[dev]', e)
  process.exit(1)
})
