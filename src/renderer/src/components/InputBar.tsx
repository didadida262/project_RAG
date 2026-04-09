import { faArrowUp, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  streaming: boolean
  onStop: () => void
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  streaming,
  onStop,
}: Props) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const wasStreaming = useRef(false)

  const submit = useCallback(() => {
    if (streaming || !value.trim()) return
    onSubmit()
  }, [streaming, onSubmit, value])

  useEffect(() => {
    const el = ta.current
    if (!el) return
    // Reset height so scrollHeight reflects content only (avoids oversized box + top-aligned text)
    el.style.height = '0px'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 200)}px`
  }, [value])

  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      ta.current?.focus({ preventScroll: true })
    }
    wasStreaming.current = streaming
  }, [streaming])

  return (
    <div className="shrink-0 bg-transparent px-5 pb-4 pt-2 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex min-h-[42px] items-center gap-2 rounded-[22px] border border-zinc-200/90 bg-white/85 px-3 py-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 dark:border-zinc-500/60 dark:bg-zinc-700/95 dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)] focus-within:border-cyan-400/65 focus-within:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35),0_0_0_1px_rgba(34,211,238,0.45),0_0_24px_-4px_rgba(34,211,238,0.28)] dark:focus-within:border-cyan-400/55 dark:focus-within:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(34,211,238,0.55),0_0_32px_-6px_rgba(34,211,238,0.38),0_0_56px_-12px_rgba(34,211,238,0.12)]">
          <textarea
            ref={ta}
            rows={1}
            value={value}
            disabled={streaming}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="有问题，尽管问"
            className="block max-h-[200px] min-h-8 w-0 flex-1 resize-none bg-transparent py-1 pl-1 text-[16px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-300"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm transition hover:bg-zinc-100 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              aria-label="停止生成"
            >
              <FontAwesomeIcon icon={faSquare} className="text-[9px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-600 dark:disabled:text-zinc-400"
              aria-label="发送"
            >
              <FontAwesomeIcon icon={faArrowUp} className="text-xs" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
