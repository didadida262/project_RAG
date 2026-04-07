import axios from 'axios'

const baseURL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''

export const api = axios.create({
  baseURL,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
})

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type ChatResponse = {
  reply: string
  warnings: string[]
  retrieved_chunks: number
  context_chars: number
}

export async function postChat(
  message: string,
  history: ChatMessage[],
): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/api/chat', {
    message,
    history,
    stream: false,
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
): Promise<void> {
  const url = `${baseURL}/api/chat/stream`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, stream: true }),
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
    llm: {
      ready: boolean
      error: string | null
      path_set: boolean
      loading?: boolean
    }
  }>('/api/status')
  return data
}
