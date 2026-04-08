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
  const tagLabel = llmLoading
    ? '模型加载中…'
    : llmReady
      ? '模型已加载'
      : '模型未就绪'

  const tagClass = llmLoading
    ? 'border-amber-400/70 bg-amber-500/20 text-amber-900 shadow-[0_0_16px_rgba(245,158,11,0.45)] ring-2 ring-amber-400/35 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100 dark:shadow-[0_0_18px_rgba(251,191,36,0.4)] dark:ring-amber-400/30'
    : llmReady
      ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-800 shadow-[0_0_18px_rgba(34,197,94,0.55),0_0_36px_rgba(34,197,94,0.25)] ring-2 ring-emerald-400/40 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-200 dark:shadow-[0_0_22px_rgba(52,211,153,0.5),0_0_44px_rgba(52,211,153,0.2)] dark:ring-emerald-400/35'
      : 'border-red-500/70 bg-red-500/15 text-red-800 shadow-[0_0_18px_rgba(239,68,68,0.55),0_0_36px_rgba(239,68,68,0.22)] ring-2 ring-red-500/40 dark:border-red-500/55 dark:bg-red-500/12 dark:text-red-200 dark:shadow-[0_0_22px_rgba(248,113,113,0.45),0_0_40px_rgba(248,113,113,0.18)] dark:ring-red-500/35'

  return (
    <aside className="flex max-h-screen min-h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200/90 bg-white/80 px-3 py-4 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 sm:w-64">
      <motion.h1
        className="w-full bg-gradient-to-br from-teal-600 via-violet-600 to-fuchsia-600 bg-clip-text text-center text-xl font-bold leading-[1.15] tracking-wide text-transparent sm:text-2xl dark:from-cyan-200 dark:via-violet-300 dark:to-fuchsia-300 dark:[filter:drop-shadow(0_0_24px_rgba(34,211,238,0.35))]"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        Private RAG
      </motion.h1>

      <div
        className="mt-4 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600"
        aria-hidden
      />

      <section className="pt-4">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
          基本信息
        </h2>
        <dl className="mt-3 space-y-3.5 text-sm leading-snug">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100/90 px-2.5 py-2 dark:bg-zinc-900/70">
            <dt className="shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              语料块
            </dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">
              {corpusCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              检索
            </dt>
            <dd className="mt-1 text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              Chroma 向量库 · 本地文档
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              推理
            </dt>
            <dd className="mt-1 text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              本地 GGUF · 流式输出
            </dd>
          </div>
        </dl>
      </section>

      {llmHint ? (
        <p className="mt-4 flex items-start gap-1.5 border-t border-zinc-200/80 pt-4 text-xs leading-relaxed text-amber-700 dark:border-zinc-800/80 dark:text-amber-400/95">
          <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap break-words">{llmHint}</span>
        </p>
      ) : null}

      <div className="min-h-4 flex-1 shrink-0" aria-hidden />

      <div className="mt-auto border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
        <div className="flex items-stretch gap-2">
          <motion.span
            layout
            className={`flex min-w-0 flex-1 items-center justify-center rounded-full border px-2 py-2 text-center text-[10px] font-bold uppercase leading-tight tracking-wider sm:text-[11px] ${tagClass}`}
            animate={
              llmLoading
                ? { opacity: [1, 0.75, 1], scale: [1, 0.99, 1] }
                : { opacity: 1, scale: 1 }
            }
            transition={
              llmLoading
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          >
            <span className="truncate">{tagLabel}</span>
          </motion.span>
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm transition hover:border-cyan-500/50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-cyan-500/40"
            aria-label={themeIsDark ? '切换到亮色' : '切换到暗色'}
          >
            <FontAwesomeIcon icon={themeIsDark ? faSun : faMoon} className="text-sm" />
          </button>
        </div>
      </div>
    </aside>
  )
}
