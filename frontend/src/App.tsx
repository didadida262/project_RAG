import { useCallback, useEffect, useState } from 'react'
import { fetchStatus, streamChat, type ChatMessage } from './api/client'
import { ChatTranscript } from './components/ChatTranscript'
import { HeaderBar } from './components/HeaderBar'
import { InputBar } from './components/InputBar'
import { useTheme } from './providers/ThemeProvider'

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

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      setCorpusCount(s.chroma_documents)
      setLlmReady(s.llm.ready)
      setLlmLoading(Boolean(s.llm.loading))
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
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
    const id = window.setInterval(() => void refreshStatus(), 2000)
    return () => window.clearInterval(id)
  }, [refreshStatus])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    const history = [...messages]
    setMessages((m) => [...m, { role: 'user', content: text }])
    setStreaming(true)
    setWarnings([])

    let assistant = ''
    setMessages((m) => [...m, { role: 'assistant', content: '' }])

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
      )
    } catch (e) {
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
    } finally {
      setStreaming(false)
      void refreshStatus()
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-100 via-white to-zinc-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100"
    >
      <HeaderBar
        corpusCount={corpusCount}
        llmReady={llmReady}
        llmLoading={llmLoading}
        llmHint={llmHint}
        onToggleTheme={toggle}
        themeIsDark={theme === 'dark'}
      />
      <ChatTranscript
        messages={messages}
        warnings={warnings}
        streaming={streaming}
      />
      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={send}
        disabled={streaming}
      />
    </div>
  )
}
