/**
 * 本地 Node 服务入口：
 * - `POST /enterprise/api/v1/chat/completions`：JSON 透传上游；multipart 时本机读文档写入 messages 再 JSON 上游。
 * - 其余 `/enterprise/*`：反代到公网。
 *
 * 环境变量：`PROXY_PORT`、`PUBLIC_API_TARGET`、`PUBLIC_ENTERPRISE_SITE_ORIGIN`、
 * `PUBLIC_ENTERPRISE_COOKIE`，以及 `DOCUMENT_UPLOAD_MAX_BYTES`、`DOCUMENT_EXTRACT_MAX_CHARS`
 *（见 `server/config.mjs`）。
 */
import { PROXY_PORT } from './config.mjs'
import { createApp } from './createApp.mjs'

const app = createApp()

const server = app.listen(PROXY_PORT, '127.0.0.1', () => {
  console.log(
    `[api-proxy] http://127.0.0.1:${PROXY_PORT}/enterprise/...  →  上游 enterprise`,
  )
  console.log(
    `[chat] POST /enterprise/api/v1/chat/completions  （JSON | multipart→本机解析→JSON 上游）`,
  )
})

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[api-proxy] 端口 ${PROXY_PORT} 已被占用；假定已有反代在监听（如残留进程或其它终端里的 npm run server）。`,
    )
    console.error(
      '[api-proxy] 本进程不再监听，但保持存活，以免 concurrently -k 在「子进程退出」时连带结束 Vite / Electron。',
    )
    setInterval(() => {}, 60_000)
    return
  }
  console.error('[api-proxy]', err)
  process.exit(1)
})
