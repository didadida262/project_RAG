import { SITE_ORIGIN } from '../config.mjs'

/**
 * 将浏览器/客户端传入的鉴权头与平台 Web 一致地补全，供直连上游 fetch 使用。
 * 与 `createProxyMiddleware` 的 `proxyReq` 逻辑保持对齐。
 */
export function buildEnterpriseAuthHeadersForFetch(incomingHeaders) {
  const h = new Headers()
  h.set('Accept', 'application/json, text/plain, */*')

  const rawAuth = incomingHeaders.authorization ?? incomingHeaders.Authorization
  if (rawAuth != null) {
    const v = normalizeHeaderValue(rawAuth)
    if (v) h.set('Authorization', v)
  } else {
    const token = incomingHeaders.token ?? incomingHeaders.Token
    if (token != null) {
      const v = normalizeHeaderValue(token).trim()
      if (v) {
        h.set(
          'Authorization',
          /^Bearer\s/i.test(v) ? v : `Bearer ${v}`,
        )
      }
    }
  }

  const apiKey =
    incomingHeaders['x-api-key'] ??
    incomingHeaders['X-Api-Key'] ??
    incomingHeaders['X-API-Key']
  if (apiKey != null) {
    const v = normalizeHeaderValue(apiKey).trim()
    if (v) h.set('X-Api-Key', v)
  }

  h.set('Referer', `${SITE_ORIGIN}/enterprise/ai-chat`)

  const extra = process.env.PUBLIC_ENTERPRISE_COOKIE?.trim()
  if (extra) {
    const cur = incomingHeaders.cookie ?? incomingHeaders.Cookie
    const curStr = cur != null ? normalizeHeaderValue(cur).trim() : ''
    h.set('Cookie', curStr ? `${curStr}; ${extra}` : extra)
  }

  return h
}

export function buildChatCompletionsFetchHeaders(incomingHeaders) {
  const h = buildEnterpriseAuthHeadersForFetch(incomingHeaders)
  h.set('Content-Type', 'application/json')
  h.set('Accept', 'text/event-stream')
  return h
}

function normalizeHeaderValue(v) {
  if (Buffer.isBuffer(v)) return v.toString('utf8')
  if (Array.isArray(v)) return v.map(String).join(', ')
  return String(v ?? '')
}
