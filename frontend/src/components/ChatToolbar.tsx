import type { LlmModelOption } from '../api/client'

type Props = {
  models: LlmModelOption[]
  value: string
  onChange: (path: string) => void
  disabled?: boolean
}

export function ChatToolbar({ models, value, onChange, disabled }: Props) {
  const empty = models.length === 0

  return (
    <div className="shrink-0 border-b border-zinc-200/90 bg-white/75 px-5 py-2.5 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/55 sm:px-8">
      <div className="flex w-full flex-wrap items-center justify-start gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-300">模型</span>
          <select
            className="min-w-0 cursor-pointer rounded-lg border border-zinc-200 bg-white py-1.5 pl-3 pr-8 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25 sm:min-w-[14rem]"
            value={empty ? '' : value}
            disabled={disabled || empty}
            onChange={(e) => onChange(e.target.value)}
            aria-label="选择推理模型"
          >
            {empty ? (
              <option value="">未配置 GGUF（请设置 GGUF_MODEL_PATH）</option>
            ) : (
              models.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.label}
                  {m.active ? ' · 已加载' : ''}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
    </div>
  )
}
