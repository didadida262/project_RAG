import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchStatus,
  ingestFile,
  streamChat,
  type ChatMessage,
} from './api/client'
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
  const [llmHint, setLlmHint] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      setCorpusCount(s.chroma_documents)
      setLlmReady(s.llm.ready)
      setLlmHint(
        s.llm.ready
          ? null
          : s.llm.error ||
              (!s.llm.path_set
                ? '在 backend/.env 设置 GGUF_MODEL_PATH 后重启服务'
                : null),
      )
    } catch {
      setLlmHint('无法连接后端，请确认已启动 uvicorn（默认 8000）')
      setLlmReady(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const onPickFile = () => fileRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const r = await ingestFile(f)
      setCorpusCount(r.total)
      setWarnings([`已导入 ${f.name}，新增 ${r.chunks_added} 个块`])
    } catch (err) {
      setWarnings([
        err instanceof Error ? err.message : '导入失败',
      ])
    }
  }

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
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.markdown"
        className="hidden"
        onChange={onFileChange}
      />
      <HeaderBar
        corpusCount={corpusCount}
        llmReady={llmReady}
        llmHint={llmHint}
        onPickFile={onPickFile}
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
