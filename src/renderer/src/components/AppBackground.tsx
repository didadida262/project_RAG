/**
 * Full-viewport decorative layers. Light + dark variants.
 * Single perspective grid: oversized plane + seamless background-position scroll (infinite depth).
 */
export function AppBackground() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 -z-10 block overflow-hidden dark:hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200/90 via-sky-50/80 to-indigo-100/70" />
        <div className="absolute -left-[20%] -top-[30%] h-[75vmin] w-[75vmin] rounded-full bg-cyan-400/25 blur-[100px] animate-blob-1" />
        <div className="absolute -right-[15%] top-[20%] h-[65vmin] w-[65vmin] rounded-full bg-indigo-400/20 blur-[110px] animate-blob-2" />
        <div className="absolute bottom-[-25%] left-[25%] h-[70vmin] w-[70vmin] rounded-full bg-violet-400/18 blur-[120px] animate-blob-3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-5%,rgba(56,189,248,0.14),transparent_52%)]" />
        <div className="rag-pgrid">
          <div className="rag-pgrid-plane rag-pgrid-plane--light" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(248,250,252,0.75)_100%)]" />
      </div>

      <div
        className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0c1222] to-black" />
        <div className="absolute -left-[20%] -top-[30%] h-[75vmin] w-[75vmin] rounded-full bg-cyan-500/25 blur-[100px] animate-blob-1" />
        <div className="absolute -right-[15%] top-[20%] h-[65vmin] w-[65vmin] rounded-full bg-violet-600/20 blur-[110px] animate-blob-2" />
        <div className="absolute bottom-[-25%] left-[25%] h-[70vmin] w-[70vmin] rounded-full bg-fuchsia-600/15 blur-[120px] animate-blob-3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="rag-pgrid">
          <div className="rag-pgrid-plane rag-pgrid-plane--dark" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
      </div>
    </>
  )
}
