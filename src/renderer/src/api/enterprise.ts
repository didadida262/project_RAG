/**
 * 企业平台开放接口。
 * 默认请求本机 Express 反代（`server/index.mjs`，默认 8787），由服务端转发公网，避免浏览器 CORS。
 * 若设置 VITE_ENTERPRISE_API_URL 则直连该地址（需上游已允许跨域）。
 */

export type EnterpriseApiKeyOption = { label: string; value: string }

function getEnterpriseOrigin(): string {
  const direct = import.meta.env.VITE_ENTERPRISE_API_URL?.replace(/\/$/, '') ?? ''
  if (direct) return direct
  const proxy =
    import.meta.env.VITE_API_PROXY_URL?.replace(/\/$/, '') ??
    'http://127.0.0.1:8787'
  return proxy
}

function enterpriseUrl(pathWithQuery: string): string {
  const origin = getEnterpriseOrigin()
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`
  return origin ? `${origin}${path}` : path
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function extractRows(payload: unknown): unknown[] {
  if (payload == null) return []
  if (Array.isArray(payload)) return payload
  if (typeof payload !== 'object') return []
  const o = payload as Record<string, unknown>

  const inner = o.data !== undefined ? o.data : o
  if (Array.isArray(inner)) return inner
  if (typeof inner !== 'object' || inner === null) return []

  const box = inner as Record<string, unknown>
  const nests = ['records', 'list', 'rows', 'content', 'items', 'data']
  for (const k of nests) {
    const v = box[k]
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      const nested = v as Record<string, unknown>
      for (const nk of nests) {
        const arr = nested[nk]
        if (Array.isArray(arr)) return arr
      }
    }
  }
  return []
}

function maskSecret(s: string): string {
  if (s.length <= 8) return '••••'
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

function rowToApiKeyOption(row: unknown): EnterpriseApiKeyOption | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const value = pickStr(r, [
    'apiKey',
    'api_key',
    'key',
    'secretKey',
    'secret',
    'token',
    'value',
    'id',
  ])
  if (!value) return null
  const label =
    pickStr(r, ['name', 'label', 'title', 'keyName', 'remark', 'description']) ||
    maskSecret(value)
  return { label, value }
}

export type EnterpriseModelOption = {
  path: string
  label: string
  active: boolean
}

function rowToModelOption(row: unknown): EnterpriseModelOption | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const path = pickStr(r, [
    'modelPath',
    'path',
    'serviceId',
    'id',
    'modelId',
    'code',
    'modelCode',
    'uuid',
    /** 部分 model-services 仅返回 name，与 OpenAI model 字段一致 */
    'name',
    'model_name',
  ])
  if (!path) return null
  const label =
    pickStr(r, [
      'name',
      'modelName',
      'serviceName',
      'title',
      'label',
      'displayName',
    ]) || path
  return { path, label, active: false }
}

/**
 * 与平台 Web 一致：JWT 走 Authorization Bearer，密钥走 X-Api-Key（与 DevTools 一致，HTTP 下与 X-API-Key 等价）。
 * api-keys、model-services、chat/completions 三类请求均通过此函数组头。
 */
function authorizationBearer(token: string): string {
  const t = token.trim()
  if (!t) return ''
  return /^Bearer\s+/i.test(t) ? t : `Bearer ${t}`
}

function buildEnterpriseAuthHeaders(
  token: string,
  apiKey: string,
): Headers {
  const h = new Headers()
  /** 与平台 Web 默认 Accept 一致（走反代时 Referer/Cookie 由 server 注入） */
  h.set('Accept', 'application/json, text/plain, */*')
  const auth = authorizationBearer(token)
  if (auth) h.set('Authorization', auth)
  const k = apiKey.trim()
  if (k) {
    /** 与平台网页 / Apifox 一致（勿用 api_key 作头名） */
    h.set('X-Api-Key', k)
  }
  return h
}

function buildChatCompletionsHeaders(token: string, apiKey: string): Headers {
  const h = buildEnterpriseAuthHeaders(token, apiKey)
  h.set('Content-Type', 'application/json')
  /** OpenAI 兼容流式：SSE，逐块 data: {...} */
  h.set('Accept', 'text/event-stream')
  return h
}

export async function fetchEnterpriseApiKeys(
  token: string,
  apiKey: string,
): Promise<EnterpriseApiKeyOption[]> {
  const url = enterpriseUrl('/enterprise/api/api-keys?pageNum=1&pageSize=10')
  const res = await fetch(url, {
    method: 'GET',
    headers: buildEnterpriseAuthHeaders(token, apiKey),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `api-keys HTTP ${res.status}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    throw new Error('api-keys 返回非 JSON')
  }
  const rows = extractRows(json)
  const out: EnterpriseApiKeyOption[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const opt = rowToApiKeyOption(row)
    if (opt && !seen.has(opt.value)) {
      seen.add(opt.value)
      out.push(opt)
    }
  }
  return out
}

export async function fetchEnterpriseModelServices(
  token: string,
  apiKey: string,
): Promise<EnterpriseModelOption[]> {
  const url = enterpriseUrl(
    '/enterprise/api/model-services?pageNum=1&pageSize=200',
  )
  const res = await fetch(url, {
    method: 'GET',
    headers: buildEnterpriseAuthHeaders(token, apiKey),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `model-services HTTP ${res.status}`)
  }
  let json: unknown
  try {
    json = JSON.parse(text) as unknown
  } catch {
    throw new Error('model-services 返回非 JSON')
  }
  const rows = extractRows(json)
  const out: EnterpriseModelOption[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const opt = rowToModelOption(row)
    if (opt && !seen.has(opt.path)) {
      seen.add(opt.path)
      out.push(opt)
    }
  }
  return out
}

export type EnterpriseChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * OpenAI 兼容流式对话。
 *
 * POST `{origin}/enterprise/api/v1/chat/completions`，body `{ model, messages, stream: true }`。
 * 请求头：`Authorization: Bearer <JWT>`、`X-Api-Key: <下拉选的 sk-...>`、`Content-Type: application/json`、`Accept: text/event-stream`。
 * 响应：SSE，`data:` 行 JSON 里 `choices[0].delta.content`（或 `reasoning_content`）拼成正文。
 */
export async function streamEnterpriseChatCompletions(
  token: string,
  apiKey: string,
  params: {
    model: string
    messages: EnterpriseChatMessage[]
    signal?: AbortSignal
    onToken: (text: string) => void
  },
): Promise<void> {
  const { model, messages, signal, onToken } = params
  if (!apiKey.trim()) {
    throw new Error('请先在 api_key 下拉中选择一项（请求头使用 X-Api-Key）')
  }
  const url = enterpriseUrl('/enterprise/api/v1/chat/completions')
  const res = await fetch(url, {
    method: 'POST',
    headers: buildChatCompletionsHeaders(token, apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `chat/completions HTTP ${res.status}`)
  }

  const resBody = res.body
  if (!resBody) {
    const text = await res.text().catch(() => '')
    if (!text.trim()) throw new Error('响应无正文')
    let j: unknown
    try {
      j = JSON.parse(text)
    } catch {
      throw new Error(text)
    }
    const o = j as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
    }
    if (o.error?.message) throw new Error(o.error.message)
    const c = o.choices?.[0]?.message?.content
    if (typeof c === 'string' && c) {
      onToken(c)
      return
    }
    throw new Error(text)
  }

  const reader = resBody.getReader()
  const decoder = new TextDecoder()
  let carry = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    carry += decoder.decode(value, { stream: true })
    const lines = carry.split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      if (!data) continue
      let json: Record<string, unknown>
      try {
        json = JSON.parse(data) as Record<string, unknown>
      } catch {
        continue
      }
      const errObj = json.error as { message?: string } | undefined
      if (errObj && typeof errObj.message === 'string') {
        throw new Error(errObj.message)
      }
      const choices = json.choices as
        | Array<{
            delta?: {
              content?: string
              reasoning_content?: string
            }
          }>
        | undefined
      const delta = choices?.[0]?.delta
      const piece = delta?.content ?? delta?.reasoning_content
      if (typeof piece === 'string' && piece.length > 0) onToken(piece)
    }
  }

  if (carry.trim()) {
    const trimmed = carry.trim()
    if (trimmed.startsWith('data:')) {
      const data = trimmed.slice(5).trim()
      if (data && data !== '[DONE]') {
        try {
          const json = JSON.parse(data) as Record<string, unknown>
          const choices = json.choices as
            | Array<{ delta?: { content?: string } }>
            | undefined
          const piece = choices?.[0]?.delta?.content
          if (typeof piece === 'string' && piece) onToken(piece)
        } catch {
          /* ignore */
        }
      }
    }
  }
}
