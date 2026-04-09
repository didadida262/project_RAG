import {
  faArrowUp,
  faPaperclip,
  faPlus,
  faSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  streaming: boolean
  onStop: () => void
  /** 用户通过「上传文件」选中的文件（由上层决定如何读入/提示） */
  onFilesChosen?: (files: File[]) => void
}

export function InputBar({
  value,
  onChange,
  onSubmit,
  streaming,
  onStop,
  onFilesChosen,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const wasStreaming = useRef(false)

  const submit = useCallback(() => {
    if (streaming || !value.trim()) return
    onSubmit()
  }, [streaming, onSubmit, value])

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 200)}px`
  }, [value])

  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      ta.current?.focus({ preventScroll: true })
    }
    wasStreaming.current = streaming
  }, [streaming])

  useEffect(() => {
    if (!menuOpen) return
    const onDocDown = (e: MouseEvent) => {
      if (shellRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const openUpload = () => {
    fileInputRef.current?.click()
    setMenuOpen(false)
  }

  const pillClass =
    'flex min-h-[46px] items-center gap-1 rounded-[28px] border border-zinc-200/90 bg-white/85 px-2 py-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 dark:border-zinc-500/60 dark:bg-zinc-800/90 dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.12)] focus-within:border-cyan-400/65 focus-within:shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35),0_0_0_1px_rgba(34,211,238,0.45),0_0_24px_-4px_rgba(34,211,238,0.28)] dark:focus-within:border-cyan-400/55 dark:focus-within:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(34,211,238,0.55),0_0_32px_-6px_rgba(34,211,238,0.38)]'

  const attachBtnClass =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-zinc-600/70 disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="shrink-0 bg-transparent px-5 pb-4 pt-2 sm:px-8">
      <div ref={shellRef} className="relative mx-auto w-full max-w-3xl">
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          multiple
          onChange={(e) => {
            const { files } = e.target
            if (files?.length && onFilesChosen) {
              onFilesChosen(Array.from(files))
            }
            e.target.value = ''
          }}
        />

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              key="attach-menu"
              role="menu"
              className="absolute bottom-[calc(100%+10px)] left-0 z-20 min-w-[220px] origin-bottom-left overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 py-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-zinc-600/80 dark:bg-zinc-900/95 dark:shadow-[0_20px_56px_-12px_rgba(0,0,0,0.65)]"
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 32,
                mass: 0.85,
              }}
            >
              <motion.button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-100/90 dark:text-zinc-100 dark:hover:bg-zinc-800/90"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04, type: 'spring', stiffness: 380, damping: 28 }}
                onClick={openUpload}
              >
                <FontAwesomeIcon
                  icon={faPaperclip}
                  className="w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
                />
                上传文件
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={pillClass}>
          <motion.button
            type="button"
            className={attachBtnClass}
            disabled={streaming}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={menuOpen ? '关闭附件菜单' : '打开附件菜单'}
            onClick={() => setMenuOpen((o) => !o)}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? 'x' : 'plus'}
                initial={{ opacity: 0, scale: 0.75, rotate: menuOpen ? -45 : 45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className="inline-flex"
              >
                <FontAwesomeIcon
                  icon={menuOpen ? faXmark : faPlus}
                  className="text-base"
                />
              </motion.span>
            </AnimatePresence>
          </motion.button>
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
            className="block max-h-[200px] min-h-8 w-0 flex-1 resize-none bg-transparent py-1.5 pl-0.5 pr-1 text-[16px] leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-60 dark:text-zinc-50 dark:placeholder:text-zinc-400"
          />
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm transition hover:bg-zinc-100 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              aria-label="停止生成"
            >
              <FontAwesomeIcon icon={faSquare} className="text-[9px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!value.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-600 dark:disabled:text-zinc-400"
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
