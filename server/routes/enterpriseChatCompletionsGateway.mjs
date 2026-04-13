import { Readable } from 'node:stream'
import express from 'express'
import multer from 'multer'
import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  ENTERPRISE_CHAT_PATH,
  PUBLIC_API_TARGET,
} from '../config.mjs'
import {
  buildChatCompletionsFetchHeaders,
  buildLlmUpstreamFetchHeaders,
} from '../lib/upstreamHeaders.mjs'
import { asyncRoute } from '../middleware/asyncRoute.mjs'
import {
  DocumentExtractError,
  extractDocumentText,
} from '../services/documentExtract.mjs'

const SYSTEM_PREAMBLE =
  '你是文档分析助手。请严格基于下方「文档正文」回答用户问题；若文档中无依据请明确说明，不要编造。'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_UPLOAD_MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    if (ok) {
      cb(null, true)
      return
    }
    cb(
      new Error(
        '仅支持 application/pdf 或 Word .docx（application/vnd.openxmlformats-officedocument.wordprocessingml.document）',
      ),
    )
  },
})

const jsonParser = express.json({ limit: '4mb' })

function normalizeIncomingHeader(v) {
  if (Buffer.isBuffer(v)) return v.toString('utf8')
  if (Array.isArray(v)) return v.map(String).join(', ')
  return String(v ?? '')
}

/** @param {string} s */
function isSafeHttpOrigin(s) {
  if (typeof s !== 'string' || !s.trim()) return false
  try {
    const u = new URL(s.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function llmBaseFromReq(req) {
  const raw = req.headers['x-llm-base-url']
  if (raw == null) return ''
  return normalizeIncomingHeader(raw).trim().replace(/\/$/, '')
}

/**
 * `X-Llm-Base-Url` 为 API 前缀，须以 `/llm/v1` 结尾；上游会话地址为 `{prefix}/chat/completions`。
 * 兼容旧客户端只传域名时仍拼 `/llm/v1/chat/completions`。
 */
function resolveLlmUpstreamChatUrl(llmBase) {
  const normalized = String(llmBase || '').trim().replace(/\/$/, '')
  const full = '/llm/v1/chat/completions'
  if (normalized.endsWith(full)) return normalized
  if (normalized.endsWith('/llm/v1')) {
    return `${normalized}/chat/completions`
  }
  return `${normalized}/llm/v1/chat/completions`
}

function buildDocSystemContent(text, truncated) {
  return [
    SYSTEM_PREAMBLE,
    '',
    '--- 文档正文 ---',
    text,
    '--- 文档正文结束 ---',
    truncated ? '（正文已截断）' : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * `POST /enterprise/api/v1/chat/completions`。
 *
 * - 无 `X-Llm-Base-Url`：`application/json` 或 multipart 转发到配置中的企业平台路径。
 * - 带 `X-Llm-Base-Url`（合法 http(s)，且为 `…/llm/v1` API 前缀）：转发到 `{prefix}/chat/completions`，请求头仅透传 `Authorization`（Bearer）。
 *
 * - `application/json`：原样转发上游（普通对话）。
 * - `multipart/form-data`：仅在本机读 file（PDF/DOCX），把全文写入首条 `messages` 的 `system.content`，
 *   再与表单里的 `messages`（JSON 字符串）拼接，**向上游只发 JSON**（无文件）。
 *
 * multipart 字段：`file`、`model`、`messages`（JSON 数组字符串）、`stream`（可选）。
 */
export function registerEnterpriseChatCompletionsGateway(app) {
  app.post(
    '/enterprise/api/v1/chat/completions',
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '')
      if (ct.includes('multipart/form-data')) {
        upload.single('file')(req, res, next)
        return
      }
      jsonParser(req, res, next)
    },
    asyncRoute(async (req, res) => {
      const ct = String(req.headers['content-type'] || '')
      const isMultipart = ct.includes('multipart/form-data')

      const llmBase = llmBaseFromReq(req)
      if (req.headers['x-llm-base-url'] != null && !isSafeHttpOrigin(llmBase)) {
        res.status(400).json({
          error: {
            code: 'BAD_LLM_BASE',
            message:
              'X-Llm-Base-Url 须为合法 http(s) 地址，例如 https://aiplatform.njsrd.com/llm/v1',
          },
        })
        return
      }

      const useExternalLlm = Boolean(llmBase)
      const url = useExternalLlm
        ? resolveLlmUpstreamChatUrl(llmBase)
        : `${PUBLIC_API_TARGET}${ENTERPRISE_CHAT_PATH}`
      const ac = new AbortController()
      req.on('close', () => ac.abort())

      /** @type {Record<string, unknown>} */
      let upstreamBody

      if (isMultipart) {
        const file = req.file
        if (!file?.buffer) {
          res.status(400).json({
            error: {
              code: 'NO_FILE',
              message:
                'multipart 须含 file（PDF/DOCX）。文件仅在本机解析；上游 chat/completions 只收 JSON。',
            },
          })
          return
        }

        let messages
        try {
          messages = JSON.parse(String(req.body?.messages ?? 'null'))
        } catch {
          res.status(400).json({
            error: {
              code: 'BAD_MESSAGES',
              message: 'messages 须为合法 JSON 数组字符串',
            },
          })
          return
        }
        if (!Array.isArray(messages)) {
          res.status(400).json({
            error: { code: 'BAD_MESSAGES', message: 'messages 须为数组' },
          })
          return
        }

        const model = String(req.body?.model ?? '').trim()
        if (!model) {
          res.status(400).json({
            error: { code: 'NO_MODEL', message: '缺少 model' },
          })
          return
        }
        if (/[\r\n\0]/.test(model) || model.length > 2048) {
          res.status(400).json({
            error: { code: 'INVALID_MODEL', message: 'model 不合法' },
          })
          return
        }

        let stream = true
        if (req.body?.stream != null) {
          stream = String(req.body.stream).toLowerCase() !== 'false'
        }

        try {
          const extracted = await extractDocumentText(
            file.buffer,
            file.originalname,
            file.mimetype,
          )
          const docSystem = buildDocSystemContent(
            extracted.text,
            extracted.truncated,
          )
          upstreamBody = {
            model,
            messages: [{ role: 'system', content: docSystem }, ...messages],
            stream,
          }
        } catch (e) {
          if (e instanceof DocumentExtractError) {
            res.status(400).json({
              error: { code: e.code, message: e.message },
            })
            return
          }
          throw e
        }
      } else {
        if (!req.body || typeof req.body !== 'object') {
          res.status(400).json({
            error: { message: 'JSON 请求体无效' },
          })
          return
        }
        upstreamBody = req.body
      }

      const headers = useExternalLlm
        ? buildLlmUpstreamFetchHeaders(req.headers)
        : buildChatCompletionsFetchHeaders(req.headers)
      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(upstreamBody),
        signal: ac.signal,
      })

      if (!upstream.ok) {
        const t = await upstream.text().catch(() => '')
        res.status(upstream.status)
        const ect = upstream.headers.get('content-type')
        if (ect) res.setHeader('Content-Type', ect)
        res.send(t || JSON.stringify({ error: { message: `HTTP ${upstream.status}` } }))
        return
      }

      res.status(upstream.status)
      const uct = String(upstream.headers.get('content-type') || '')
      if (uct) res.setHeader('Content-Type', uct)
      if (uct.includes('text/event-stream')) {
        res.setHeader('Cache-Control', 'no-cache, no-transform')
        res.setHeader('X-Accel-Buffering', 'no')
      }
      res.setHeader('Access-Control-Allow-Origin', '*')

      if (!upstream.body) {
        const t = await upstream.text().catch(() => '')
        res.status(502).send(t)
        return
      }

      const nodeStream = Readable.fromWeb(upstream.body)
      res.on('close', () => {
        ac.abort()
        nodeStream.destroy()
      })
      nodeStream.pipe(res)
    }),
  )
}
