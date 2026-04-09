import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { motion } from 'framer-motion'

type Props = {
  corpusCount: number
  onToggleTheme: () => void
  themeIsDark: boolean
}

export function HeaderBar({ corpusCount, onToggleTheme, themeIsDark }: Props) {
  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200/90 bg-white/80 px-3 py-4 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 sm:w-64">
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
        <h2 className="text-base font-semibold tracking-wide text-zinc-800 dark:text-zinc-50">
          基本信息
        </h2>
        <dl className="mt-3 space-y-3.5 text-sm leading-snug">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-100/90 px-2.5 py-2 dark:bg-zinc-800/90">
            <dt className="shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              语料块
            </dt>
            <dd className="font-mono text-base font-semibold tabular-nums text-cyan-700 dark:text-cyan-200">
              {corpusCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              检索
            </dt>
            <dd className="mt-1 text-[14px] font-medium leading-snug text-zinc-800 dark:text-zinc-100">
              Chroma 向量库 · 本地文档
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              推理
            </dt>
            <dd className="mt-1 text-[14px] font-medium leading-snug text-zinc-800 dark:text-zinc-100">
              本地 GGUF · 流式输出
            </dd>
          </div>
        </dl>
      </section>

      <div className="min-h-4 flex-1 shrink-0" aria-hidden />

      <div className="mt-auto flex justify-end border-t border-zinc-200/80 pt-4 dark:border-zinc-800/80">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 shadow-sm transition hover:border-cyan-500/50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-cyan-500/40"
          aria-label={themeIsDark ? '切换到亮色' : '切换到暗色'}
        >
          <FontAwesomeIcon icon={themeIsDark ? faSun : faMoon} className="text-sm" />
        </button>
      </div>
    </aside>
  )
}
