import cors from 'cors'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import multer from 'multer'
import { PUBLIC_API_TARGET, SITE_ORIGIN } from './config.mjs'
import { registerEnterpriseChatCompletionsGateway } from './routes/enterpriseChatCompletionsGateway.mjs'

/**
 * @returns {import('express').Express}
 */
export function createApp() {
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
        'X-Llm-Base-Url',
        'token',
        'api_key',
        'Accept',
        'X-Request-Id',
      ],
      exposedHeaders: ['Content-Type', 'X-Request-Id'],
    }),
  )

  app.get('/health', (_req, res) => {
    res.json({ ok: true, target: PUBLIC_API_TARGET })
  })

  /**
   * 与会话同一路径：POST /enterprise/api/v1/chat/completions
   *（JSON 透传 | multipart 仅本机解析文档后拼进 messages 再 JSON 上游）。
   */
  registerEnterpriseChatCompletionsGateway(app)

  /**
   * 必须挂在根路径 + pathFilter，不能 app.use('/enterprise', proxy)。
   * Express 5 子挂载会把 req.url 裁成 /api/...，上游会收到错误路径导致 nginx 500。
   */
  app.use(
    createProxyMiddleware({
      pathFilter: '/enterprise',
      target: PUBLIC_API_TARGET,
      changeOrigin: true,
      proxyTimeout: 0,
      timeout: 0,
      on: {
        proxyReq(proxyReq) {
          const auth = proxyReq.getHeader('authorization')
          if (!auth) {
            const raw =
              proxyReq.getHeader('token') ?? proxyReq.getHeader('Token')
            if (raw != null) {
              const v = (
                Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw)
              ).trim()
              if (v) {
                const bearer = /^Bearer\s/i.test(v) ? v : `Bearer ${v}`
                proxyReq.setHeader('Authorization', bearer)
              }
            }
          }
          proxyReq.removeHeader('token')
          proxyReq.removeHeader('Token')

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

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err)
      return
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: {
            code: 'FILE_TOO_LARGE',
            message: '文件超过服务器大小限制，请压缩、拆分或调高 DOCUMENT_UPLOAD_MAX_BYTES',
          },
        })
        return
      }
      res.status(400).json({
        error: { code: err.code, message: err.message },
      })
      return
    }
    const msg = err instanceof Error ? err.message : '服务器错误'
    if (
      msg.includes('仅支持 application/pdf') ||
      msg.includes('application/vnd.openxmlformats')
    ) {
      res.status(400).json({
        error: { code: 'UNSUPPORTED_TYPE', message: msg },
      })
      return
    }
    console.error('[server]', req.method, req.path, msg)
    res.status(500).json({
      error: { code: 'INTERNAL', message: msg },
    })
  })

  return app
}
