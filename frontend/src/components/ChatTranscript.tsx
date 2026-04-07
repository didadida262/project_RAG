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
      <div className="flex min-h-0 flex-1 flex-col">
        {messages.length === 0 ? (
          <div className="min-h-0 flex-1" aria-hidden />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
              <motion.li
                className="flex gap-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                  <FontAwesomeIcon icon={faRobot} />
                </div>
                <div className="flex max-w-[85%] items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
                  <span className="inline-flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400"
                        animate={{
                          y: [0, -5, 0],
                          opacity: [0.35, 1, 0.35],
                          scale: [0.92, 1, 0.92],
                        }}
                        transition={{
                          duration: 0.55,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.14,
                        }}
                      />
                    ))}
                  </span>
                  <motion.span
                    className="text-sm text-zinc-500 dark:text-zinc-400"
                    animate={{ opacity: [0.45, 1, 0.45] }}
                    transition={{
                      duration: 1.15,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  >
                    生成中…
                  </motion.span>
                </div>
              </motion.li>
            ) : null}
          </ul>
          </div>
        )}
      </div>
    </div>
  )
}
