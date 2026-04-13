import type { LlmModelOption } from '../api/client'

type Props = {
  models: LlmModelOption[]
  value: string
  onChange: (path: string) => void
  /** LLM API 前缀，如 https://aiplatform.njsrd.com/llm/v1（可只填域名） */
  baseUrl: string
  apiKey: string
  /** 正在请求固定 model-services 列表（自动或手动） */
  modelsListLoading?: boolean
  enterpriseLoading?: boolean
  onLoadEnterpriseData: () => void
  onBaseUrlChange: (v: string) => void
  onApiKeyChange: (v: string) => void
  /** 请求体 `stream`，默认 true */
  streamEnabled?: boolean
  onStreamEnabledChange?: (enabled: boolean) => void
  disabled?: boolean
  /** bar：原顶部横条；sidebar：左侧栏纵向，与 baseUrl / api_key / 模型同宽 */
  layout?: 'bar' | 'sidebar'
}

export function ChatToolbar({
  models,
  value,
  onChange,
  baseUrl,
  apiKey,
  modelsListLoading = false,
  enterpriseLoading = false,
  onLoadEnterpriseData,
  onBaseUrlChange,
  onApiKeyChange,
  streamEnabled = true,
  onStreamEnabledChange,
  disabled,
  layout = 'bar',
}: Props) {
  const empty = models.length === 0
  const isSidebar = layout === 'sidebar'

  const labelClass =
    'shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-200'

  /** baseUrl / api_key / 模型 同宽：横条固定宽；侧栏通栏 */
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
      aria-label="拉取模型列表"
      title="根据 api_key 调用固定 model-services 接口拉取模型下拉数据"
    >
      {enterpriseLoading ? '开搞中…' : '开搞'}
    </button>
  )

  const baseUrlField = (
    <label className={fieldClass}>
      <span className={labelClass}>baseUrl</span>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://aiplatform.njsrd.com/llm/v1"
        className={inputClass}
        value={baseUrl}
        disabled={disabled}
        onChange={(e) => onBaseUrlChange(e.target.value)}
        aria-label="LLM API 前缀，须以 /llm/v1 结尾（可只填域名由程序补全）"
      />
    </label>
  )

  const apiKeyField = (
    <label className={fieldClass}>
      <span className={labelClass}>api_key</span>
      <input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="Bearer 密钥（sk-…）"
        className={inputClass}
        value={apiKey}
        disabled={disabled}
        onChange={(e) => onApiKeyChange(e.target.value)}
        aria-label="Authorization Bearer 密钥"
      />
    </label>
  )

  const streamToggleClass = isSidebar
    ? 'flex w-full min-w-0 cursor-pointer select-none items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white/60 px-2.5 py-2 dark:border-zinc-600/80 dark:bg-zinc-900/50'
    : 'flex min-w-0 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border border-zinc-200/80 bg-white/60 px-2.5 py-2 dark:border-zinc-600/80 dark:bg-zinc-900/50'

  const streamField = (
    <label className={streamToggleClass}>
      <span className={labelClass}>流式传输</span>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-zinc-300 text-cyan-600 accent-cyan-600 focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-500 dark:accent-emerald-400 dark:focus:ring-emerald-500/25"
        checked={streamEnabled}
        disabled={disabled}
        onChange={(e) => onStreamEnabledChange?.(e.target.checked)}
        aria-label="是否使用流式传输（请求体 stream 字段）"
      />
    </label>
  )

  const modelField = (
    <label className={fieldClass}>
      <span className={labelClass}>模型</span>
      <select
        className={compactSelectClass}
        value={empty ? '' : value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label="选择推理模型"
      >
        {empty ? (
          <option value="">
            {modelsListLoading || enterpriseLoading
              ? '模型列表加载中…'
              : '暂无模型（填写 api_key 后自动拉取）'}
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
            {baseUrlField}
            {apiKeyField}
            {modelField}
            {streamField}
            {loadButton}
          </>
        ) : (
          <>
            {loadButton}
            {baseUrlField}
            {apiKeyField}
            {modelField}
            {streamField}
          </>
        )}
      </div>
    </div>
  )
}
