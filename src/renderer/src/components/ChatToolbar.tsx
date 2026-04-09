import type { LlmModelOption } from '../api/client'

type Props = {
  models: LlmModelOption[]
  value: string
  onChange: (path: string) => void
  authToken: string
  apiKey: string
  onAuthTokenChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  disabled?: boolean
}

export function ChatToolbar({
  models,
  value,
  onChange,
  authToken,
  apiKey,
  onAuthTokenChange,
  onApiKeyChange,
  disabled,
}: Props) {
  const empty = models.length === 0

  const labelClass =
    'shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-200'

  const inputClass =
    'h-[2.125rem] w-[8.5rem] shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25 sm:w-[10rem]'

  const fieldClass = 'flex min-w-0 shrink-0 items-center gap-2'

  const selectClass =
    'h-[2.125rem] min-w-0 flex-1 cursor-pointer rounded-lg border border-zinc-200 bg-white py-0 pl-3 pr-8 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25'

  return (
    <div className="shrink-0 border-b border-zinc-200/90 bg-white/75 px-5 py-2.5 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-950/80 sm:px-8">
      <div className="flex min-w-0 flex-nowrap items-center gap-3 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <label className={fieldClass}>
          <span className={labelClass}>token</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="可选"
            className={inputClass}
            value={authToken}
            disabled={disabled}
            onChange={(e) => onAuthTokenChange(e.target.value)}
            aria-label="请求头 token"
          />
        </label>
        <label className={fieldClass}>
          <span className={labelClass}>api_key</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="可选"
            className={inputClass}
            value={apiKey}
            disabled={disabled}
            onChange={(e) => onApiKeyChange(e.target.value)}
            aria-label="请求头 api_key"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 items-center gap-2">
          <span className={labelClass}>模型</span>
          <select
            className={selectClass}
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
