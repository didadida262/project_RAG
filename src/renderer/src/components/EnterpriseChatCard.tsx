import type { LlmModelOption } from '../api/client'

type Props = {
  apikey: string
  token: string
  models: LlmModelOption[]
  selectedModel: string
  modelsLoading?: boolean
  onApikeyChange: (v: string) => void
  onTokenChange: (v: string) => void
  onModelChange: (path: string) => void
  onGo: () => void
  disabled?: boolean
}

export function EnterpriseChatCard({
  apikey,
  token,
  models,
  selectedModel,
  modelsLoading = false,
  onApikeyChange,
  onTokenChange,
  onModelChange,
  onGo,
  disabled,
}: Props) {
  const labelClass =
    'shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-200'
  const controlWidthClass =
    'h-[2.125rem] w-full min-w-0 shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25'
  const fieldClass = 'flex w-full min-w-0 flex-col gap-1.5'
  const empty = models.length === 0
  const compactSelectClass = `${controlWidthClass} cursor-pointer py-0 pl-2.5 pr-7 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25`
  const loadBtnClass =
    'h-[2.125rem] w-full shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-medium text-cyan-800 shadow-sm outline-none transition hover:bg-cyan-500/15 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15 dark:focus-visible:ring-emerald-500/35'

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <label className={fieldClass}>
        <span className={labelClass}>apikey</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          className={controlWidthClass}
          value={apikey}
          disabled={disabled}
          onChange={(e) => onApikeyChange(e.target.value)}
          aria-label="X-Api-Key"
        />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>token</span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="JWT 或 Bearer …"
          className={controlWidthClass}
          value={token}
          disabled={disabled}
          onChange={(e) => onTokenChange(e.target.value)}
          aria-label="Authorization"
        />
      </label>
      <label className={fieldClass}>
        <span className={labelClass}>模型</span>
        <select
          className={compactSelectClass}
          value={empty ? '' : selectedModel}
          disabled={disabled}
          onChange={(e) => onModelChange(e.target.value)}
          aria-label="企业平台模型"
        >
          {empty ? (
            <option value="">
              {modelsLoading
                ? '加载中…'
                : '请在操作面板2填写 api_key 以加载模型'}
            </option>
          ) : (
            models.map((m) => (
              <option key={m.path} value={m.path}>
                {m.label}
              </option>
            ))
          )}
        </select>
      </label>
      <button
        type="button"
        className={loadBtnClass}
        disabled={disabled}
        onClick={() => onGo()}
        aria-label="启用企业固定地址会话"
        title="启用企业固定地址会话（与操作面板2 互斥）；使用当前 apikey、token 与上方所选模型，请求 58.222.41.68 chat/completions"
      >
        开搞
      </button>
    </div>
  )
}
