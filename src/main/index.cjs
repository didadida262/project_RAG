const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

function getProjectRoot() {
  return path.join(__dirname, '..', '..')
}

/** 与 server/index.mjs 默认 PROXY_PORT=8787 一致，供渲染层组企业 API 绝对地址 */
function getApiBase() {
  return (
    process.env.PRIVATE_RAG_API_URL?.replace(/\/$/, '') ||
    'http://127.0.0.1:8787'
  )
}

function portFromApiBase(base) {
  try {
    const u = new URL(base)
    if (u.port) return Number(u.port)
    return u.protocol === 'https:' ? 443 : 80
  } catch {
    return 8787
  }
}

let embeddedProxyChild = null

function checkProxyHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/health`,
      { timeout: 2000 },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function waitUntilProxyHealthy(port, timeoutMs) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      checkProxyHealth(port).then((ok) => {
        if (ok) {
          resolve()
          return
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error('proxy health timeout'))
          return
        }
        setTimeout(tick, 250)
      })
    }
    tick()
  })
}

/**
 * 子进程需执行真实磁盘上的脚本；将 server 列入 asarUnpack 后优先用 app.asar.unpacked。
 * 部分环境下从 app.asar 内路径 spawn .mjs 会失败，解压目录更稳。
 */
function resolveServerScriptPath() {
  if (!app.isPackaged) {
    return path.join(getProjectRoot(), 'server', 'index.mjs')
  }
  const appPath = app.getAppPath()
  const unpackedRoot = appPath.endsWith('.asar') ? `${appPath}.unpacked` : appPath
  const unpackedScript = path.join(unpackedRoot, 'server', 'index.mjs')
  if (fs.existsSync(unpackedScript)) return unpackedScript
  return path.join(appPath, 'server', 'index.mjs')
}

function startEmbeddedProxy(port) {
  const script = resolveServerScriptPath()
  if (!fs.existsSync(script)) {
    console.error('[Skynet] 未找到反代脚本:', script)
    return null
  }
  const appRoot = app.isPackaged ? app.getAppPath() : getProjectRoot()
  const child = spawn(process.execPath, [script], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PROXY_PORT: String(port),
    },
    cwd: appRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  embeddedProxyChild = child
  child.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk)
  })
  child.on('exit', (code, signal) => {
    if (embeddedProxyChild === child) embeddedProxyChild = null
    if (code !== 0 && code !== null) {
      console.error('[Skynet] 内嵌反代进程退出', { code, signal })
    }
  })
  return child
}

/**
 * 开发时 `npm run dev` 会并行起反代；安装包双击启动时没有该步骤，需在主进程内拉起 server/index.mjs。
 * 若 /health 已可用则跳过（例如用户已手动 npm run server）。
 * 设置 PRIVATE_RAG_SKIP_EMBEDDED_PROXY=1 可禁用自动拉起。
 */
async function ensureEmbeddedProxyWhenPackaged() {
  try {
    if (!app.isPackaged) return
    if (process.env.PRIVATE_RAG_SKIP_EMBEDDED_PROXY === '1') return

    const port = portFromApiBase(getApiBase())
    if (await checkProxyHealth(port)) return

    startEmbeddedProxy(port)
    try {
      await waitUntilProxyHealthy(port, 25000)
    } catch {
      dialog.showErrorBox(
        'Skynet',
        `无法连接本机 API 反代（http://127.0.0.1:${port}）。\n\n` +
          '本应用会在后台启动内嵌反代；若仍失败，请检查该端口是否被占用，或联系管理员配置上游地址。',
      )
    }
  } catch (err) {
    console.error('[Skynet] ensureEmbeddedProxyWhenPackaged', err)
    dialog.showErrorBox(
      'Skynet',
      `内嵌反代初始化异常：${err?.message || String(err)}`,
    )
  }
}

function createWindow() {
  const apiBase = getApiBase()

  const preloadPath = path.join(__dirname, '..', 'preload', 'index.cjs')
  const distIndex = path.join(getProjectRoot(), 'src', 'renderer', 'dist', 'index.html')
  const hasDist = fs.existsSync(distIndex)
  /**
   * 未打包时默认始终连 Vite，避免本地曾执行过 build 后 dist 残留导致界面永远停在旧版。
   * 需要无 Vite、只测构建产物时：PRIVATE_RAG_ELECTRON_USE_DIST=1 npm run electron:start（须先有 dist）
   */
  const useDistInDev =
    process.env.PRIVATE_RAG_ELECTRON_USE_DIST === '1' && hasDist
  const useDevServer = !app.isPackaged && !useDistInDev
  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

  const win = new BrowserWindow({
    title: 'Skynet',
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // macOS 下 sandbox + preload 偶发异常时会导致窗口空白；桌面壳需稳定弹出窗口
      sandbox: false,
      additionalArguments: [`--private-rag-api-base=${encodeURIComponent(apiBase)}`],
    },
    show: false,
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
  // 若首帧迟迟不触发 ready-to-show，避免窗口一直隐藏
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
      win.focus()
    }
  }, 2500)

  if (useDevServer) {
    win.loadURL(devServerUrl).catch((err) => {
      console.error(err)
      dialog.showErrorBox(
        'Skynet',
        `无法加载开发服务器 ${devServerUrl}。请用 npm run dev 同时启动 Vite 与本机反代；若端口被占用，Vite 会自动换端口（见环境变量 VITE_DEV_SERVER_URL）。`,
      )
    })
  } else {
    win.loadFile(distIndex).catch((err) => {
      console.error(err)
      dialog.showErrorBox(
        'Skynet',
        '未找到渲染进程构建产物。请在项目根目录执行：npm run build',
      )
    })
  }

  return win
}

app.whenReady().then(() => {
  /**
   * 必须先 createWindow：若在 await 反代就绪（最长约 25s）后才建窗，Dock 已启动但长时间无窗口，
   * 用户会误以为「应用打不开」。
   */
  createWindow()
  void ensureEmbeddedProxyWhenPackaged()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  if (embeddedProxyChild && !embeddedProxyChild.killed) {
    embeddedProxyChild.kill('SIGTERM')
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
