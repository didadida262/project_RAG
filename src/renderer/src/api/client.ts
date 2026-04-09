import axios from 'axios'

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.electronAPI?.apiBaseUrl) {
    return window.electronAPI.apiBaseUrl.replace(/\/$/, '')
  }
  return import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''
}

const baseURL = getApiBaseUrl()

/** 由界面同步；空字符串则不发送对应头 */
let requestToken = ''
let requestApiKey = ''

export function setAuthCredentials(token: string, apiKey: string) {
  requestToken = token.trim()
  requestApiKey = apiKey.trim()
}

function authHeaderPairs(): Record<string, string> {
  const h: Record<string, string> = {}
  if (requestToken) h.token = requestToken
  if (requestApiKey) h.api_key = requestApiKey
  return h
}

export const api = axios.create({
  baseURL,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const headers = config.headers
  if (requestToken) headers.set('token', requestToken)
  else headers.delete('token')
  if (requestApiKey) headers.set('api_key', requestApiKey)
  else headers.delete('api_key')
  return config
})

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type LlmModelOption = {
  path: string
  label: string
  active: boolean
}

export type ChatResponse = {
  reply: string
  warnings: string[]
  retrieved_chunks: number
  context_chars: number
}

export async function postChat(
  message: string,
  history: ChatMessage[],
  modelPath?: string,
): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/api/chat', {
    message,
    history,
    stream: false,
    ...(modelPath ? { model_path: modelPath } : {}),
  })
  return data
}

export type StreamMeta = {
  type: 'meta'
  warnings: string[]
  retrieved_chunks: number
  context_chars: number
}

export type StreamToken = { type: 'token'; text: string }
export type StreamDone = { type: 'done' }
export type StreamError = { type: 'error'; detail: string }

export async function streamChat(
  message: string,
  history: ChatMessage[],
  onMeta: (m: StreamMeta) => void,
  onToken: (t: string) => void,
  signal?: AbortSignal,
  modelPath?: string,
): Promise<void> {
  const url = `${baseURL}/api/chat/stream`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaderPairs(),
    },
    body: JSON.stringify({
      message,
      history,
      stream: true,
      ...(modelPath ? { model_path: modelPath } : {}),
    }),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const parseBlock = (block: string) => {
    const line = block.trim()
    if (!line.startsWith('data:')) return
    const json = line.slice(5).trim()
    if (!json) return
    const data = JSON.parse(json) as
      | StreamMeta
      | StreamToken
      | StreamDone
      | StreamError
    if (data.type === 'meta') onMeta(data)
    else if (data.type === 'token') onToken(data.text)
    else if (data.type === 'error') throw new Error(data.detail)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const p of parts) {
      try {
        parseBlock(p)
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }
  if (buffer.trim()) {
    for (const p of buffer.split('\n\n')) {
      try {
        parseBlock(p)
      } catch (e) {
        if (e instanceof SyntaxError) continue
        throw e
      }
    }
  }
}

export async function fetchStatus() {
  const { data } = await api.get<{
    chroma_documents: number
    embedding_error?: string
    llm_models?: LlmModelOption[]
    llm: {
      ready: boolean
      error: string | null
      path_set: boolean
      loading?: boolean
    }
  }>('/api/status')
  return data
}
