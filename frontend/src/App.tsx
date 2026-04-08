import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchStatus,
  streamChat,
  type ChatMessage,
  type LlmModelOption,
} from './api/client'
import { AppBackground } from './components/AppBackground'
import { ChatToolbar } from './components/ChatToolbar'
import { ChatTranscript } from './components/ChatTranscript'
import { HeaderBar } from './components/HeaderBar'
import { InputBar } from './components/InputBar'
import { useTheme } from './providers/ThemeProvider'

const MODEL_PATH_STORAGE_KEY = 'private-rag-gguf-path'

export default function App() {
  const { theme, toggle } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [corpusCount, setCorpusCount] = useState(0)
  const [llmReady, setLlmReady] = useState(false)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmHint, setLlmHint] = useState<string | null>(null)
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>([])
  const [selectedModelPath, setSelectedModelPath] = useState('')
  const streamAbortRef = useRef<AbortController | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      setCorpusCount(s.chroma_documents)
      setLlmReady(s.llm.ready)
      setLlmLoading(Boolean(s.llm.loading))
      const models = s.llm_models ?? []
      setLlmModels(models)
      setSelectedModelPath((prev) => {
        if (models.length === 0) return ''
        if (prev && models.some((m) => m.path === prev)) return prev
        try {
          const stored = localStorage.getItem(MODEL_PATH_STORAGE_KEY)
          if (stored && models.some((m) => m.path === stored)) return stored
        } catch {
          /* ignore */
        }
        return models.find((m) => m.active)?.path ?? models[0].path
      })
      const parts: string[] = []
      if (s.embedding_error) parts.push(s.embedding_error)
      if (s.llm.loading) {
        parts.push(
          'GGUF 正在后台载入内存（大文件可能要几分钟），状态会自动刷新；完成显示「模型已加载」后即可对话。',
        )
      } else if (!s.llm.ready) {
        parts.push(
          s.llm.error ||
            (!s.llm.path_set
              ? '在 backend/.env 设置 GGUF_MODEL_PATH 后重启服务'
              : ''),
        )
      }
      setLlmHint(parts.filter(Boolean).join('\n') || null)
    } catch {
      setLlmHint(
        '无法连接后端：请另开终端运行 ./run-backend.sh（默认 8000）。',
      )
      setLlmReady(false)
      setLlmLoading(false)
      setLlmModels([])
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    const intervalMs = llmLoading || !llmReady ? 3000 : 60_000
    const id = window.setInterval(() => void refreshStatus(), intervalMs)
    return () => window.clearInterval(id)
  }, [refreshStatus, llmReady, llmLoading])

  const stopStream = useCallback(() => {
    streamAbortRef.current?.abort()
  }, [])

  const runStream = useCallback(
    async (text: string, history: ChatMessage[]) => {
      setStreaming(true)
      setWarnings([])
      let assistant = ''
      const ac = new AbortController()
      streamAbortRef.current = ac

      try {
        await streamChat(
          text,
          history,
          (meta) => setWarnings(meta.warnings),
          (t) => {
            assistant += t
            setMessages((m) => {
              const next = [...m]
              const last = next[next.length - 1]
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: assistant }
              }
              return next
            })
          },
          ac.signal,
          selectedModelPath || undefined,
        )
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError'
        if (aborted) {
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last?.role === 'assistant') {
              const cur = last.content.trim()
              next[next.length - 1] = {
                ...last,
                content: cur ? `${cur}\n\n（已停止生成）` : '（已停止生成）',
              }
            }
            return next
          })
        } else {
          const msg = e instanceof Error ? e.message : '请求失败'
          setWarnings((w) => [...w, msg])
          setMessages((m) => {
            const next = [...m]
            const last = next[next.length - 1]
            if (last?.role === 'assistant' && !last.content) {
              next[next.length - 1] = {
                role: 'assistant',
                content: `（错误）${msg}`,
              }
            }
            return next
          })
        }
      } finally {
        streamAbortRef.current = null
        setStreaming(false)
        void refreshStatus()
      }
    },
    [refreshStatus, selectedModelPath],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const history = [...messages]
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ])
    await runStream(text, history)
  }, [input, streaming, messages, runStream])

  const regenerateAt = useCallback(
    async (assistantIndex: number) => {
      if (streaming) return
      const m = messages
      if (m[assistantIndex]?.role !== 'assistant') return
      const userPair = m[assistantIndex - 1]
      if (!userPair || userPair.role !== 'user') return
      const history = m.slice(0, assistantIndex - 1)
      const text = userPair.content
      setMessages([...m.slice(0, assistantIndex), { role: 'assistant', content: '' }])
      await runStream(text, history)
    },
    [streaming, messages, runStream],
  )

  const submitUserEdit = useCallback(
    async (userIndex: number, newText: string) => {
      const text = newText.trim()
      if (!text || streaming) return
      const history = messages.slice(0, userIndex)
      setMessages([
        ...messages.slice(0, userIndex),
        { role: 'user', content: text },
        { role: 'assistant', content: '' },
      ])
      await runStream(text, history)
    },
    [streaming, messages, runStream],
  )

  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 flex-row overflow-hidden bg-transparent text-zinc-900 dark:text-zinc-100">
      <AppBackground />
      <HeaderBar
        corpusCount={corpusCount}
        llmReady={llmReady}
        llmLoading={llmLoading}
        llmHint={llmHint}
        onToggleTheme={toggle}
        themeIsDark={theme === 'dark'}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatToolbar
          models={llmModels}
          value={selectedModelPath}
          disabled={streaming}
          onChange={(path) => {
            setSelectedModelPath(path)
            try {
              localStorage.setItem(MODEL_PATH_STORAGE_KEY, path)
            } catch {
              /* ignore */
            }
          }}
        />
        <ChatTranscript
          messages={messages}
          warnings={warnings}
          streaming={streaming}
          onRegenerate={regenerateAt}
          onUserEditSubmit={submitUserEdit}
        />
        <InputBar
          value={input}
          onChange={setInput}
          onSubmit={send}
          streaming={streaming}
          onStop={stopStream}
        />
      </div>
    </div>
  )
}
