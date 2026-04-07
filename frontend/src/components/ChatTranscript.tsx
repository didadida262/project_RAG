import { faRobot, faUser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { motion } from 'framer-motion'
import type { ChatMessage } from '../api/client'

type Props = {
  messages: ChatMessage[]
  warnings: string[]
  streaming: boolean
}

export function ChatTranscript({ messages, warnings, streaming }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {warnings.length > 0 ? (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200/90">
          {warnings.map((w, i) => (
            <p key={`${i}-${w.slice(0, 40)}`}>{w}</p>
          ))}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-dashed border-zinc-300/80 bg-zinc-50/50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              开始对话
            </p>
            <p>先导入 .txt / .md 语料，或直接提问测试流程。若未配置 GGUF，回答将不可用。</p>
          </div>
        ) : (
          <ul className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m, i) => (
              <motion.li
                key={`${i}-${m.role}-${m.content.slice(0, 12)}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs ${
                    m.role === 'user'
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
                  }`}
                >
                  <FontAwesomeIcon icon={m.role === 'user' ? faUser : faRobot} />
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'border-cyan-500/20 bg-cyan-500/5 text-zinc-900 dark:text-zinc-100'
                      : 'border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </motion.li>
            ))}
            {streaming ? (
              <li className="flex gap-3 text-xs text-zinc-500 dark:text-zinc-500">
                <span className="inline-flex gap-1">
                  <span className="animate-pulse">●</span>
                  <span className="animate-pulse delay-75">●</span>
                  <span className="animate-pulse delay-150">●</span>
                </span>
                生成中…
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  )
}
