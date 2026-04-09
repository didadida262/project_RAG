import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, LlmModelOption } from './api/client'
import {
  fetchEnterpriseApiKeys,
  fetchEnterpriseModelServices,
  streamEnterpriseChatCompletions,
  type EnterpriseApiKeyOption,
} from './api/enterprise'
import { AppBackground } from './components/AppBackground'
import { ChatToolbar } from './components/ChatToolbar'
import { ChatTranscript } from './components/ChatTranscript'
import { HeaderBar } from './components/HeaderBar'
import { InputBar } from './components/InputBar'
import { useTheme } from './providers/ThemeProvider'

const MODEL_PATH_STORAGE_KEY = 'private-rag-gguf-path'
const AUTH_TOKEN_STORAGE_KEY = 'private-rag-header-token'
const API_KEY_STORAGE_KEY = 'private-rag-header-api-key'

export default function App() {
  const { theme, toggle } = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>([])
  const [enterpriseApiKeys, setEnterpriseApiKeys] = useState<
    EnterpriseApiKeyOption[]
  >([])
  const [selectedModelPath, setSelectedModelPath] = useState('')
  const [authToken, setAuthToken] = useState('')
  /** 最近一次点击「开搞」时采用的 JWT，用于列表与对话请求头 */
  const [committedToken, setCommittedToken] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [enterpriseLoading, setEnterpriseLoading] = useState(false)
  const streamAbortRef = useRef<AbortController | null>(null)

  const enterprisePickEnabled = committedToken.trim().length > 0

  const apiKeySelectOptions = useMemo(() => {
    if (!enterprisePickEnabled) {
      return [{ label: '请先填写 token 并点击开搞', value: '' }]
    }
    const head = { label: '可选', value: '' }
    const rest = [...enterpriseApiKeys]
    const trimmed = apiKey.trim()
    if (trimmed && !rest.some((o) => o.value === apiKey)) {
      return [head, { label: '当前已保存', value: apiKey }, ...rest]
    }
    return [head, ...rest]
  }, [enterprisePickEnabled, enterpriseApiKeys, apiKey])

  useEffect(() => {
    try {
      setAuthToken(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? '')
      setApiKey(localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
    } catch {
      /* ignore */
    }
  }, [])

  const applyEnterpriseListResults = useCallback(
    (
      kRes: PromiseSettledResult<EnterpriseApiKeyOption[]>,
      mRes: PromiseSettledResult<LlmModelOption[]>,
    ) => {
      if (kRes.status === 'fulfilled') {
        const keys = kRes.value
        setEnterpriseApiKeys(keys)
        setApiKey((prev) => {
          if (keys.length === 0) {
            try {
              localStorage.removeItem(API_KEY_STORAGE_KEY)
            } catch {
              /* ignore */
            }
            return ''
          }
          let next = ''
          if (prev && keys.some((o) => o.value === prev)) {
            next = prev
          } else {
            try {
              const stored = localStorage.getItem(API_KEY_STORAGE_KEY)
              if (stored && keys.some((o) => o.value === stored)) {
                next = stored
              }
            } catch {
              /* ignore */
            }
            if (!next) next = keys[0].value
          }
          try {
            if (next) localStorage.setItem(API_KEY_STORAGE_KEY, next)
            else localStorage.removeItem(API_KEY_STORAGE_KEY)
          } catch {
            /* ignore */
          }
          return next
        })
      } else {
        setEnterpriseApiKeys([])
      }
      if (mRes.status === 'fulfilled') {
        const models = mRes.value
        setLlmModels(models)
        setSelectedModelPath((prev) => {
          if (models.length === 0) {
            try {
              localStorage.removeItem(MODEL_PATH_STORAGE_KEY)
            } catch {
              /* ignore */
            }
            return ''
          }
          let next = ''
          if (prev && models.some((m) => m.path === prev)) {
            next = prev
          } else {
            try {
              const stored = localStorage.getItem(MODEL_PATH_STORAGE_KEY)
              if (stored && models.some((m) => m.path === stored)) {
                next = stored
              }
            } catch {
              /* ignore */
            }
            if (!next) next = models[0].path
          }
          try {
            if (next) localStorage.setItem(MODEL_PATH_STORAGE_KEY, next)
            else localStorage.removeItem(MODEL_PATH_STORAGE_KEY)
          } catch {
            /* ignore */
          }
          return next
        })
      } else {
        setLlmModels([])
      }
    },
    [],
  )

  const loadEnterpriseLists = useCallback(
    async (token: string, key: string) => {
      const t = token.trim()
      if (!t) {
        setEnterpriseApiKeys([])
        setLlmModels([])
        return
      }
      const [kRes, mRes] = await Promise.allSettled([
        fetchEnterpriseApiKeys(t, key),
        fetchEnterpriseModelServices(t, key),
      ])
      applyEnterpriseListResults(kRes, mRes)
    },
    [applyEnterpriseListResults],
  )

  const handleLoadEnterpriseData = useCallback(async () => {
    const t = authToken.trim()
    if (!t) {
      setWarnings((w) => [...w, '请先填写 token，再点击「开搞」拉取 api_key 与模型列表'])
      return
    }
    setCommittedToken(t)
    setEnterpriseLoading(true)
    setWarnings([])
    try {
      await loadEnterpriseLists(t, apiKey)
    } finally {
      setEnterpriseLoading(false)
    }
  }, [authToken, apiKey, loadEnterpriseLists])

  const handleTokenBlur = useCallback(() => {
    const t = authToken.trim()
    if (!t) {
      setCommittedToken('')
      setEnterpriseApiKeys([])
      setLlmModels([])
      setApiKey('')
      setSelectedModelPath('')
      try {
        localStorage.removeItem(API_KEY_STORAGE_KEY)
        localStorage.removeItem(MODEL_PATH_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [authToken])

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
        if (!selectedModelPath.trim()) {
          throw new Error(
            '请先点击「开搞」拉取模型列表，并在「模型」中选择一项',
          )
        }
        const jwt = committedToken.trim()
        if (!jwt) {
          throw new Error('请先填写 token 并点击「开搞」，再发起对话')
        }
        if (!apiKey.trim()) {
          throw new Error('请先在 api_key 中选择密钥（将以 X-Api-Key 请求头发送）')
        }
        await streamEnterpriseChatCompletions(
          committedToken,
          apiKey,
          {
            model: selectedModelPath,
            messages: [...history, { role: 'user', content: text }],
            signal: ac.signal,
            onToken: (t) => {
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
          },
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
      }
    },
    [selectedModelPath, committedToken, apiKey],
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
      <HeaderBar onToggleTheme={toggle} themeIsDark={theme === 'dark'}>
        <ChatToolbar
          layout="sidebar"
          models={llmModels}
          value={selectedModelPath}
          disabled={streaming}
          authToken={authToken}
          apiKey={apiKey}
          apiKeyOptions={apiKeySelectOptions}
          enterprisePickEnabled={enterprisePickEnabled}
          enterpriseLoading={enterpriseLoading}
          onLoadEnterpriseData={handleLoadEnterpriseData}
          onTokenBlur={handleTokenBlur}
          onAuthTokenChange={(v) => {
            setAuthToken(v)
            try {
              localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, v)
            } catch {
              /* ignore */
            }
          }}
          onApiKeyChange={(v) => {
            setApiKey(v)
            try {
              localStorage.setItem(API_KEY_STORAGE_KEY, v)
            } catch {
              /* ignore */
            }
          }}
          onChange={(path) => {
            setSelectedModelPath(path)
            try {
              localStorage.setItem(MODEL_PATH_STORAGE_KEY, path)
            } catch {
              /* ignore */
            }
          }}
        />
      </HeaderBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
