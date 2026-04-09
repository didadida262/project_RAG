/**
 * 本地 API 反代：浏览器只打本机，由 Node 转发到公网，绕过 CORS。
 *
 * 路径一一对应，例如：
 *   GET http://127.0.0.1:8787/enterprise/api/api-keys?pageNum=1&pageSize=10
 *   → GET http://58.222.41.68/enterprise/api/api-keys?pageNum=1&pageSize=10
 *
 * 环境变量：
 *   PROXY_PORT                  监听端口，默认 8787
 *   PUBLIC_API_TARGET           上游站点根（不含路径），默认 http://58.222.41.68
 *   PUBLIC_ENTERPRISE_SITE_ORIGIN  写 Referer 用的站点根，默认与 PUBLIC_API_TARGET 相同
 *   PUBLIC_ENTERPRISE_COOKIE    可选；与平台网页同源请求里的 Cookie 一致时，从浏览器 DevTools 复制整段粘贴到 .env（勿提交）
 */
import cors from 'cors'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const PORT = Number(process.env.PROXY_PORT || 8787)
const TARGET = (process.env.PUBLIC_API_TARGET || 'http://58.222.41.68').replace(
  /\/$/,
  '',
)
const SITE_ORIGIN = (
  process.env.PUBLIC_ENTERPRISE_SITE_ORIGIN || TARGET
).replace(/\/$/, '')

const app = express()
app.disable('x-powered-by')

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Api-Key',
      'X-API-Key',
      'token',
      'api_key',
      'Accept',
    ],
    exposedHeaders: ['Content-Type'],
  }),
)

app.get('/health', (_req, res) => {
  res.json({ ok: true, target: TARGET })
})

/**
 * 必须挂在根路径 + pathFilter，不能 app.use('/enterprise', proxy)。
 * Express 5 子挂载会把 req.url 裁成 /api/...，上游会收到错误路径导致 nginx 500。
 */
app.use(
  createProxyMiddleware({
    pathFilter: '/enterprise',
    target: TARGET,
    changeOrigin: true,
    proxyTimeout: 0,
    timeout: 0,
    on: {
      proxyReq(proxyReq) {
        const auth = proxyReq.getHeader('authorization')
        if (!auth) {
          const raw = proxyReq.getHeader('token') ?? proxyReq.getHeader('Token')
          if (raw != null) {
            const v = (Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)).trim()
            if (v) {
              const bearer = /^Bearer\s/i.test(v) ? v : `Bearer ${v}`
              proxyReq.setHeader('Authorization', bearer)
            }
          }
        }
        proxyReq.removeHeader('token')
        proxyReq.removeHeader('Token')

        /** 浏览器 fetch 不能设 Referer；与平台 Web 一致，由反代写入 */
        proxyReq.setHeader('Referer', `${SITE_ORIGIN}/enterprise/ai-chat`)

        const extra = process.env.PUBLIC_ENTERPRISE_COOKIE?.trim()
        if (extra) {
          const cur = proxyReq.getHeader('cookie')
          const curStr = cur
            ? (Buffer.isBuffer(cur) ? cur.toString('utf8') : String(cur)).trim()
            : ''
          proxyReq.setHeader('Cookie', curStr ? `${curStr}; ${extra}` : extra)
        }
      },
      error(err, _req, res) {
        console.error('[api-proxy]', err.message)
        if (res && !res.headersSent && typeof res.writeHead === 'function') {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      },
      proxyRes(proxyRes) {
        proxyRes.headers['access-control-allow-origin'] = '*'
        const ct = String(proxyRes.headers['content-type'] ?? '')
        if (ct.includes('text/event-stream')) {
          proxyRes.headers['x-accel-buffering'] = 'no'
          proxyRes.headers['cache-control'] = 'no-cache, no-transform'
        }
      },
    },
  }),
)

app.listen(PORT, '127.0.0.1', () => {
  console.log(
    `[api-proxy] http://127.0.0.1:${PORT}/enterprise/...  →  ${TARGET}/enterprise/...`,
  )
})
