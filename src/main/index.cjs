const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

function getProjectRoot() {
  return path.join(__dirname, '..', '..')
}

function createWindow() {
  const apiBase =
    process.env.PRIVATE_RAG_API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:8000'

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
        'Private RAG',
        `无法加载开发服务器 ${devServerUrl}。请用 npm run / yarn dev 同时启动 Vite；若端口被占用请先结束占用 5173 的进程。`,
      )
    })
  } else {
    win.loadFile(distIndex).catch((err) => {
      console.error(err)
      dialog.showErrorBox(
        'Private RAG',
        '未找到渲染进程构建产物。请在项目根目录执行：npm run build',
      )
    })
  }

  return win
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
