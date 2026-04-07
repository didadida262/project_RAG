import { faCircleInfo, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { motion } from 'framer-motion'

type Props = {
  corpusCount: number
  llmReady: boolean
  llmHint?: string | null
  onToggleTheme: () => void
  themeIsDark: boolean
}

export function HeaderBar({
  corpusCount,
  llmReady,
  llmHint,
  onToggleTheme,
  themeIsDark,
}: Props) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="flex min-w-0 flex-col gap-0.5">
        <motion.h1
          className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Private RAG
        </motion.h1>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          语料块 {corpusCount} · {llmReady ? '模型已加载' : '模型未就绪'}
        </p>
        {llmHint ? (
          <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400/90">
            <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap break-words">{llmHint}</span>
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-zinc-700 shadow-sm transition hover:border-cyan-500/50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-cyan-500/40"
          aria-label={themeIsDark ? '切换到亮色' : '切换到暗色'}
        >
          <FontAwesomeIcon icon={themeIsDark ? faSun : faMoon} />
        </button>
      </div>
    </header>
  )
}
