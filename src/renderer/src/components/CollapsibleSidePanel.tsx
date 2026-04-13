import { useId, type ReactNode } from 'react'

const cardClass =
  'w-full shrink-0 rounded-xl border border-zinc-200/90 bg-zinc-50/95 p-3 shadow-sm ring-1 ring-zinc-900/[0.03] dark:border-zinc-700/90 dark:bg-zinc-900/75 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] dark:ring-white/[0.04]'

type Props = {
  title: string
  /** 含字号与渐变等，用于标题 `h2` */
  titleClassName: string
  expanded: boolean
  onToggle: () => void
  /** `aria-label` 与无障碍区域名 */
  ariaLabel: string
  children: ReactNode
}

export function CollapsibleSidePanel({
  title,
  titleClassName,
  expanded,
  onToggle,
  ariaLabel,
  children,
}: Props) {
  const contentId = useId()

  return (
    <div className={cardClass} role="region" aria-label={ariaLabel}>
      <button
        type="button"
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg py-0.5 pl-0 pr-0 text-left outline-none transition hover:bg-zinc-100/70 focus-visible:ring-2 focus-visible:ring-cyan-500/30 dark:hover:bg-zinc-800/40 dark:focus-visible:ring-emerald-500/25"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <h2
          className={`min-w-0 shrink truncate text-left text-sm font-semibold tracking-wide ${titleClassName}`}
        >
          {title}
        </h2>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
          <span
            className={`inline-block text-[10px] leading-none text-zinc-400 transition-transform duration-300 ease-out motion-reduce:transition-none dark:text-zinc-500 ${expanded ? 'rotate-180' : 'rotate-0'}`}
            aria-hidden
          >
            ▼
          </span>
          {expanded ? '收起' : '展开'}
        </span>
      </button>
      <div
        className={`mt-2 grid w-full min-h-0 overflow-hidden transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none motion-reduce:duration-0 ${
          expanded ? '[grid-template-rows:1fr]' : '[grid-template-rows:0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={contentId}
            className={`flex w-full min-w-0 flex-col gap-3 pt-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            inert={expanded ? undefined : true}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
