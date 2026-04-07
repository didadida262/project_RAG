import { faCircleInfo, faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { motion } from 'framer-motion'

type Props = {
  corpusCount: number
  llmReady: boolean
  llmLoading?: boolean
  llmHint?: string | null
  onToggleTheme: () => void
  themeIsDark: boolean
}

export function HeaderBar({
  corpusCount,
  llmReady,
  llmLoading = false,
  llmHint,
  onToggleTheme,
  themeIsDark,
}: Props) {
  const tagLabel = llmReady
    ? '模型已加载'
    : llmLoading
      ? '模型加载中…'
      : '模型未就绪'

  const tagClass =
    llmReady
      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-800 shadow-[0_0_18px_rgba(34,197,94,0.55),0_0_36px_rgba(34,197,94,0.25)] ring-2 ring-emerald-400/40 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200 dark:shadow-[0_0_22px_rgba(52,211,153,0.5),0_0_44px_rgba(52,211,153,0.2)] dark:ring-emerald-400/35'
      : llmLoading
        ? 'border-amber-400/70 bg-amber-500/20 text-amber-900 shadow-[0_0_16px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/35 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100 dark:shadow-[0_0_18px_rgba(251,191,36,0.4)] dark:ring-amber-400/30'
        : 'border-red-500/70 bg-red-500/15 text-red-800 shadow-[0_0_18px_rgba(239,68,68,0.55),0_0_36px_rgba(239,68,68,0.22)] ring-2 ring-red-500/40 dark:border-red-500/55 dark:bg-red-500/12 dark:text-red-200 dark:shadow-[0_0_22px_rgba(248,113,113,0.45),0_0_40px_rgba(248,113,113,0.18)] dark:ring-red-500/35'

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/90 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="flex min-w-0 flex-col gap-1">
        <motion.h1
          className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Private RAG
        </motion.h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            语料块 <span className="font-mono font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{corpusCount}</span>
          </span>
          <motion.span
            layout
            className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${tagClass}`}
            animate={
              llmLoading
                ? { opacity: [1, 0.72, 1], scale: [1, 0.98, 1] }
                : { opacity: 1, scale: 1 }
            }
            transition={
              llmLoading
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          >
            {tagLabel}
          </motion.span>
        </div>
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
