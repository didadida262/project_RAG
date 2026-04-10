import type { LlmModelOption } from '../api/client'

export type ApiKeySelectOption = { label: string; value: string }

type Props = {
  models: LlmModelOption[]
  value: string
  onChange: (path: string) => void
  authToken: string
  apiKey: string
  apiKeyOptions: ApiKeySelectOption[]
  /** 已成功点击「开搞」且当时 token 非空，才解锁 api_key / 模型下拉 */
  enterprisePickEnabled: boolean
  enterpriseLoading?: boolean
  onLoadEnterpriseData: () => void
  onTokenBlur: () => void
  onAuthTokenChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  disabled?: boolean
  /** bar：原顶部横条；sidebar：左侧栏纵向，与 api_key / 模型同宽 */
  layout?: 'bar' | 'sidebar'
}

export function ChatToolbar({
  models,
  value,
  onChange,
  authToken,
  apiKey,
  apiKeyOptions,
  enterprisePickEnabled,
  enterpriseLoading = false,
  onLoadEnterpriseData,
  onTokenBlur,
  onAuthTokenChange,
  onApiKeyChange,
  disabled,
  layout = 'bar',
}: Props) {
  const empty = models.length === 0
  const pickLocked = !enterprisePickEnabled
  const isSidebar = layout === 'sidebar'

  const labelClass =
    'shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-200'

  /** token / api_key / 模型 同宽：横条固定宽；侧栏通栏 */
  const controlWidthClass = isSidebar
    ? 'h-[2.125rem] w-full min-w-0 shrink-0'
    : 'h-[2.125rem] w-[8.5rem] shrink-0 sm:w-[10rem]'

  const inputClass = `${controlWidthClass} rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25`

  const fieldClass = isSidebar
    ? 'flex w-full min-w-0 flex-col gap-1.5'
    : 'flex min-w-0 shrink-0 items-center gap-2'

  const compactSelectClass = `${controlWidthClass} cursor-pointer rounded-lg border border-zinc-200 bg-white py-0 pl-2.5 pr-7 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/25`

  const loadBtnClass = isSidebar
    ? 'h-[2.125rem] w-full shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-medium text-cyan-800 shadow-sm outline-none transition hover:bg-cyan-500/15 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15 dark:focus-visible:ring-emerald-500/35'
    : 'h-[2.125rem] min-w-[3.25rem] shrink-0 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-medium text-cyan-800 shadow-sm outline-none transition hover:bg-cyan-500/15 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15 dark:focus-visible:ring-emerald-500/35'

  const outerClass = isSidebar
    ? 'w-full shrink-0'
    : 'shrink-0 border-b border-zinc-200/90 bg-white/75 px-5 py-2.5 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-950/80 sm:px-8'

  const innerClass = isSidebar
    ? 'flex w-full min-w-0 flex-col gap-3'
    : 'flex min-w-0 flex-wrap items-center gap-3 pb-0.5 sm:flex-nowrap sm:overflow-x-auto sm:[-ms-overflow-style:none] sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden'

  const loadButton = (
    <button
      type="button"
      className={loadBtnClass}
      disabled={disabled || enterpriseLoading}
      onClick={() => onLoadEnterpriseData()}
      aria-label="拉取 api_key 与模型列表"
      title="根据当前 token（与 api_key）请求企业接口（开搞）"
    >
      {enterpriseLoading ? '开搞中…' : '开搞'}
    </button>
  )

  const tokenField = (
    <label className={fieldClass}>
      <span className={labelClass}>token</span>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="可选"
        className={inputClass}
        value={authToken}
        disabled={disabled}
        onChange={(e) => onAuthTokenChange(e.target.value)}
        onBlur={onTokenBlur}
        aria-label="请求头 token"
      />
    </label>
  )

  const apiKeyField = (
    <label className={fieldClass}>
      <span className={labelClass}>api_key</span>
      <select
        className={compactSelectClass}
        value={
          pickLocked
            ? ''
            : apiKeyOptions.some((o) => o.value === apiKey)
              ? apiKey
              : (apiKeyOptions[0]?.value ?? '')
        }
        disabled={disabled || pickLocked}
        onChange={(e) => onApiKeyChange(e.target.value)}
        aria-label="请求头 api_key"
      >
        {apiKeyOptions.map((o) => (
          <option key={`${o.label}:${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )

  const modelField = (
    <label className={fieldClass}>
      <span className={labelClass}>模型</span>
      <select
        className={compactSelectClass}
        value={pickLocked || empty ? '' : value}
        disabled={disabled || pickLocked || empty}
        onChange={(e) => onChange(e.target.value)}
        aria-label="选择推理模型"
      >
        {pickLocked ? (
          <option value="">填写 token 后点击「开搞」获取模型</option>
        ) : empty ? (
          <option value="">
            未获取到模型列表（检查 token / 企业接口）
          </option>
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
  )

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        {isSidebar ? (
          <>
            {tokenField}
            {apiKeyField}
            {modelField}
            {loadButton}
          </>
        ) : (
          <>
            {loadButton}
            {tokenField}
            {apiKeyField}
            {modelField}
          </>
        )}
      </div>
    </div>
  )
}
