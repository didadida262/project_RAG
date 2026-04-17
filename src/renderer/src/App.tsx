import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, LlmModelOption } from './api/client'
import {
  fetchLlmModels,
  streamEnterpriseFixedChat,
  streamLlmChatCompletions,
  streamLlmChatCompletionsWithDocument,
} from './api/enterprise'
import { AppBackground } from './components/AppBackground'
import { ChatToolbar } from './components/ChatToolbar'
import { CollapsibleSidePanel } from './components/CollapsibleSidePanel'
import { EnterpriseChatCard } from './components/EnterpriseChatCard'
import { ChatTranscript } from './components/ChatTranscript'
import { HeaderBar } from './components/HeaderBar'
import { InputBar } from './components/InputBar'
const MODEL_PATH_STORAGE_KEY = 'private-rag-gguf-path'
const API_KEY_STORAGE_KEY = 'private-rag-header-api-key'
const BASE_URL_STORAGE_KEY = 'private-rag-llm-base-url'
const CHAT_STREAM_STORAGE_KEY = 'private-rag-llm-chat-stream'
/** 历史版本曾持久化 token，启动时清掉，避免用户以为「被记住」 */
const LEGACY_AUTH_TOKEN_STORAGE_KEY = 'private-rag-header-token'

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [llmModels, setLlmModels] = useState<LlmModelOption[]>([])
  const [selectedModelPath, setSelectedModelPath] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [enterpriseLoading, setEnterpriseLoading] = useState(false)
  const [modelsListLoading, setModelsListLoading] = useState(false)
  /** 请求体 `stream` 字段，默认开启流式 */
  const [chatStreamEnabled, setChatStreamEnabled] = useState(true)
  const streamAbortRef = useRef<AbortController | null>(null)
  const [attachedDocument, setAttachedDocument] = useState<File | null>(null)

  /** 「操作面板1」：开搞后用于 58.222.41.68 chat/completions */
  const [entApikey, setEntApikey] = useState('')
  const [entToken, setEntToken] = useState('')
  const [entSelectedModel, setEntSelectedModel] = useState('')
  const [entSessionActive, setEntSessionActive] = useState(false)
  const [entCommitApikey, setEntCommitApikey] = useState('')
  const [entCommitToken, setEntCommitToken] = useState('')
  /** 侧栏折叠：默认展开操作面板1 */
  const [enterprisePanelExpanded, setEnterprisePanelExpanded] = useState(true)
  const [directPanelExpanded, setDirectPanelExpanded] = useState(false)

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY)
      setBaseUrl(localStorage.getItem(BASE_URL_STORAGE_KEY) ?? '')
      setApiKey(localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
      const streamStored = localStorage.getItem(CHAT_STREAM_STORAGE_KEY)
      setChatStreamEnabled(streamStored !== '0')
    } catch {
      /* ignore */
    }
  }, [])

  const applyModelListResult = useCallback(
    (mRes: PromiseSettledResult<LlmModelOption[]>) => {
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
        setSelectedModelPath('')
        try {
          localStorage.removeItem(MODEL_PATH_STORAGE_KEY)
        } catch {
          /* ignore */
        }
      }
    },
    [],
  )

  const loadLlmModels = useCallback(
    async (key: string) => {
      const mRes = await Promise.allSettled([fetchLlmModels(key.trim())])
      applyModelListResult(mRes[0])
    },
    [applyModelListResult],
  )

  /** api_key 非空时自动拉取固定 model-services 列表（防抖），与 baseUrl 无关 */
  useEffect(() => {
    const key = apiKey.trim()
    if (!key) {
      setLlmModels([])
      setSelectedModelPath('')
      setModelsListLoading(false)
      try {
        localStorage.removeItem(MODEL_PATH_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    const id = window.setTimeout(() => {
      setModelsListLoading(true)
      void loadLlmModels(apiKey).finally(() => {
        setModelsListLoading(false)
      })
    }, 400)
    return () => {
      window.clearTimeout(id)
    }
  }, [apiKey, loadLlmModels])

  /** 操作面板1 模型下拉与面板2 共用 `llmModels`，选中项在列表变化时自动校正 */
  useEffect(() => {
    if (llmModels.length === 0) {
      setEntSelectedModel('')
      return
    }
    setEntSelectedModel((prev) => {
      if (prev && llmModels.some((m) => m.path === prev)) return prev
      if (
        selectedModelPath &&
        llmModels.some((m) => m.path === selectedModelPath)
      ) {
        return selectedModelPath
      }
      return llmModels[0].path
    })
  }, [llmModels, selectedModelPath])

  /** 操作面板2「开搞」：关闭企业会话，校验直连配置后刷新模型列表 */
  const handleDirectPanelGo = useCallback(async () => {
    setWarnings([])
    const bu = baseUrl.trim()
    const key = apiKey.trim()
    const model = selectedModelPath.trim()
    if (!bu) {
      setWarnings((w) => [...w, '请在操作面板2填写 baseUrl'])
      return
    }
    if (!key) {
      setWarnings((w) => [...w, '请在操作面板2填写 api_key'])
      return
    }
    if (
      llmModels.length === 0 ||
      !model ||
      !llmModels.some((m) => m.path === model)
    ) {
      setWarnings((w) => [
        ...w,
        '请等待模型列表加载完成并在「模型」中选择一项。',
      ])
      return
    }
    setEntSessionActive(false)
    setEnterpriseLoading(true)
    try {
      await loadLlmModels(apiKey)
      setWarnings(['已激活操作面板2：直连会话，后续消息将使用 baseUrl + api_key。'])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '刷新模型列表失败'
      setWarnings([msg])
    } finally {
      setEnterpriseLoading(false)
    }
  }, [
    baseUrl,
    apiKey,
    selectedModelPath,
    llmModels,
    loadLlmModels,
  ])

  const handleEnterprisePanelGo = useCallback(() => {
    const k = entApikey.trim()
    const t = entToken.trim()
    if (!k) {
      setWarnings((w) => [...w, '请在操作面板1填写 apikey'])
      return
    }
    if (!t) {
      setWarnings((w) => [...w, '请在操作面板1填写 token'])
      return
    }
    const model = entSelectedModel.trim()
    if (
      llmModels.length === 0 ||
      !model ||
      !llmModels.some((m) => m.path === model)
    ) {
      setWarnings((w) => [
        ...w,
        '请先在操作面板2填写 api_key 并等待模型列表加载后，在此选择模型。',
      ])
      return
    }
    setEntCommitApikey(k)
    setEntCommitToken(t)
    setEntSessionActive(true)
    setWarnings([
      '已激活操作面板1：企业固定地址会话，后续消息将请求企业 chat/completions。',
    ])
  }, [entApikey, entToken, entSelectedModel, llmModels])

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
        const useEnt =
          entSessionActive &&
          Boolean(entCommitApikey && entCommitToken && entSelectedModel.trim())

        if (useEnt) {
          await streamEnterpriseFixedChat(entCommitApikey, entCommitToken, {
            model: entSelectedModel.trim(),
            messages: [...history, { role: 'user', content: text }],
            stream: chatStreamEnabled,
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
          })
        } else {
          if (!baseUrl.trim()) {
            throw new Error(
              '请填写 baseUrl（API 前缀，如 https://aiplatform.njsrd.com/llm/v1）',
            )
          }
          if (!selectedModelPath.trim()) {
            throw new Error(
              '请填写 api_key 并等待模型列表加载后，在「模型」中选择一项',
            )
          }
          if (!apiKey.trim()) {
            throw new Error('请填写 api_key（将使用 Authorization: Bearer 发送）')
          }
          await streamLlmChatCompletions(
            baseUrl,
            apiKey,
            {
              model: selectedModelPath,
              messages: [...history, { role: 'user', content: text }],
              stream: chatStreamEnabled,
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
        }
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
    [
      selectedModelPath,
      baseUrl,
      apiKey,
      chatStreamEnabled,
      entSessionActive,
      entCommitApikey,
      entCommitToken,
      entSelectedModel,
    ],
  )

  const runDocumentStream = useCallback(
    async (question: string, file: File, history: ChatMessage[]) => {
      setStreaming(true)
      setWarnings([])
      let assistant = ''
      const ac = new AbortController()
      streamAbortRef.current = ac

      try {
        const useEnt =
          entSessionActive &&
          Boolean(entCommitApikey && entCommitToken && entSelectedModel.trim())
        if (useEnt) {
          throw new Error(
            '操作面板1会话不支持附件，请使用操作面板2（baseUrl + api_key）发送带文件消息。',
          )
        }
        if (!baseUrl.trim()) {
          throw new Error(
            '请填写 baseUrl（如 https://aiplatform.njsrd.com/llm/v1；附件经本机转发到 …/chat/completions）',
          )
        }
        if (!selectedModelPath.trim()) {
          throw new Error(
            '请填写 api_key 并等待模型列表加载后，在「模型」中选择一项',
          )
        }
        if (!apiKey.trim()) {
          throw new Error('请填写 api_key（将使用 Authorization: Bearer 发送）')
        }
        const messages = [
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: question },
        ]
        await streamLlmChatCompletionsWithDocument(
          baseUrl,
          apiKey,
          {
            model: selectedModelPath,
            messages,
            file,
            stream: chatStreamEnabled,
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
    [
      selectedModelPath,
      baseUrl,
      apiKey,
      chatStreamEnabled,
      entSessionActive,
      entCommitApikey,
      entCommitToken,
      entSelectedModel,
    ],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    const useEnt =
      entSessionActive &&
      Boolean(entCommitApikey && entCommitToken && entSelectedModel.trim())
    if (useEnt && attachedDocument) {
      setWarnings((w) => [
        ...w,
        '操作面板1会话不支持附件，请移除附件或改用操作面板2。',
      ])
      return
    }
    setInput('')
    const history = [...messages]
    const doc = attachedDocument
    if (doc) {
      setAttachedDocument(null)
      const userLabel = `【附件：${doc.name}】\n\n${text}`
      setMessages((m) => [
        ...m,
        { role: 'user', content: userLabel },
        { role: 'assistant', content: '' },
      ])
      await runDocumentStream(text, doc, history)
      return
    }
    setMessages((m) => [
      ...m,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ])
    await runStream(text, history)
  }, [
    input,
    streaming,
    messages,
    runStream,
    attachedDocument,
    runDocumentStream,
    entSessionActive,
    entCommitApikey,
    entCommitToken,
    entSelectedModel,
  ])

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

  const handleFilesChosen = useCallback(
    async (files: File[]) => {
      const f = files[0]
      if (!f) return
      if (files.length > 1) {
        setWarnings((w) => [
          ...w,
          `一次仅支持 1 个附件，已忽略除「${f.name}」外的 ${files.length - 1} 个文件。`,
        ])
      }

      const textExts = new Set([
        'txt',
        'md',
        'csv',
        'json',
        'log',
        'xml',
        'html',
        'htm',
        'tsv',
      ])
      const maxBytes = 4 * 1024 * 1024
      const serverMaxHint = 15 * 1024 * 1024

      const ext = f.name.includes('.')
        ? f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase()
        : ''
      const isPdf = ext === 'pdf' || f.type === 'application/pdf'
      const isDocx =
        ext === 'docx' ||
        f.type ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      if (isPdf || isDocx) {
        if (f.size > serverMaxHint) {
          setWarnings((w) => [
            ...w,
            `「${f.name}」超过本机服务默认上限（约 15MB），请压缩或拆分后再传。`,
          ])
          return
        }
        setAttachedDocument(f)
        return
      }

      if (f.size > maxBytes) {
        setWarnings((w) => [...w, `「${f.name}」超过 4MB，未读入。`])
        return
      }
      const looksText =
        f.type.startsWith('text/') || textExts.has(ext) || ext === ''
      if (looksText) {
        try {
          const t = await f.text()
          const block = `--- ${f.name} ---\n${t}`
          setInput((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block))
        } catch {
          setWarnings((w) => [...w, `无法读取「${f.name}」。`])
        }
        return
      }
      setWarnings((w) => [
        ...w,
        `「${f.name}」：请使用纯文本，或 PDF / Word（.docx）作为附件。`,
      ])
    },
    [],
  )

  return (
    <div className="relative flex h-dvh max-h-dvh min-h-0 flex-row overflow-hidden bg-transparent text-zinc-900 dark:text-zinc-100">
      <AppBackground />
      <HeaderBar>
        <CollapsibleSidePanel
          title="操作面板1"
          titleClassName="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-violet-300 dark:to-fuchsia-300"
          expanded={enterprisePanelExpanded}
          onToggle={() => setEnterprisePanelExpanded((v) => !v)}
          ariaLabel="操作面板1"
        >
          <EnterpriseChatCard
            apikey={entApikey}
            token={entToken}
            models={llmModels}
            selectedModel={entSelectedModel}
            modelsLoading={modelsListLoading}
            onApikeyChange={setEntApikey}
            onTokenChange={setEntToken}
            onModelChange={setEntSelectedModel}
            onGo={handleEnterprisePanelGo}
          />
        </CollapsibleSidePanel>
        <CollapsibleSidePanel
          title="操作面板2"
          titleClassName="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent dark:from-cyan-400 dark:to-fuchsia-400"
          expanded={directPanelExpanded}
          onToggle={() => setDirectPanelExpanded((v) => !v)}
          ariaLabel="操作面板2"
        >
          <ChatToolbar
            layout="sidebar"
            models={llmModels}
            value={selectedModelPath}
            baseUrl={baseUrl}
            apiKey={apiKey}
            modelsListLoading={modelsListLoading}
            enterpriseLoading={enterpriseLoading}
            onGo={handleDirectPanelGo}
            onBaseUrlChange={(v) => {
              setBaseUrl(v)
              try {
                localStorage.setItem(BASE_URL_STORAGE_KEY, v)
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
            streamEnabled={chatStreamEnabled}
            onStreamEnabledChange={(v) => {
              setChatStreamEnabled(v)
              try {
                localStorage.setItem(CHAT_STREAM_STORAGE_KEY, v ? '1' : '0')
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
        </CollapsibleSidePanel>
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
          onFilesChosen={handleFilesChosen}
          attachedDocumentName={attachedDocument?.name ?? null}
          onClearAttachedDocument={() => setAttachedDocument(null)}
        />
      </div>
    </div>
  )
}
