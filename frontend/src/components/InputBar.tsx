import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled: boolean
}

export function InputBar({ value, onChange, onSubmit, disabled }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null)

  const submit = useCallback(() => {
    if (disabled || !value.trim()) return
    onSubmit()
  }, [disabled, onSubmit, value])

  return (
    <div className="shrink-0 border-t border-zinc-200/90 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={ta}
          rows={2}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          className="min-h-[3rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 shadow-inner outline-none ring-cyan-500/30 placeholder:text-zinc-400 focus:border-cyan-500/50 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-cyan-500/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 dark:from-cyan-600 dark:to-cyan-700"
          aria-label="发送"
        >
          <FontAwesomeIcon icon={faPaperPlane} />
        </button>
      </div>
    </div>
  )
}
