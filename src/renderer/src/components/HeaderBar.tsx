import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

type Props = {
  /** 侧栏底部区域：开搞 / baseUrl / api_key / 模型 */
  children?: ReactNode
}

export function HeaderBar({ children }: Props) {
  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200/90 bg-white/80 px-3 py-4 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 sm:w-72">
      <motion.h1
        className="w-full bg-gradient-to-br from-teal-600 via-violet-600 to-fuchsia-600 bg-clip-text text-center text-xl font-bold leading-[1.15] tracking-wide text-transparent sm:text-2xl dark:from-cyan-200 dark:via-violet-300 dark:to-fuchsia-300 dark:[filter:drop-shadow(0_0_24px_rgba(34,211,238,0.35))]"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      >
        Skynet
      </motion.h1>

      <div
        className="mt-4 h-px w-full shrink-0 bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600"
        aria-hidden
      />

      <div className="min-h-0 min-w-0 flex-1" aria-hidden />

      <div
        className="mt-auto shrink-0 rounded-xl border border-zinc-200/90 bg-zinc-50/95 p-3 shadow-sm ring-1 ring-zinc-900/[0.03] dark:border-zinc-700/90 dark:bg-zinc-900/75 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] dark:ring-white/[0.04]"
        role="region"
        aria-label="操作面板"
      >
        <h2 className="mb-2.5 shrink-0 bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-left text-sm font-semibold tracking-wide text-transparent dark:from-cyan-400 dark:to-fuchsia-400">
          操作面板
        </h2>
        {children}
      </div>
    </aside>
  )
}
