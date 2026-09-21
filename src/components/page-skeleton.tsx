type Shape = "cards" | "stats" | "table" | "builder" | "decks";
export function PageSkeleton({ shape = "stats", label = "Loading page", header = true }: { shape?: Shape; label?: string; header?: boolean }) {
  const cards = <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="rounded-xl border border-line p-3"><div className="skeleton aspect-square" /><div className="skeleton mt-3 h-4 w-3/4" /><div className="skeleton mt-2 h-3 w-full" /></div>)}</div>;
  return <div role="status" aria-label={label}>
    <span className="sr-only">{label}…</span>
    <div aria-hidden="true">
      {header && <div className="mb-8 border-b border-line/60 pb-6"><div className="skeleton h-10 w-64 max-w-full" /><div className="skeleton mt-3 h-4 w-96 max-w-full" /></div>}
      {shape === "builder" ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"><div><div className="skeleton mb-6 h-28" />{cards}</div><div className="rounded-xl border border-line p-4"><div className="skeleton mb-4 h-8 w-2/3" /><div className="grid grid-cols-4 gap-2">{Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton aspect-square" />)}</div><div className="skeleton mt-6 h-24" /><div className="skeleton mt-4 h-12" /></div></div>
        : shape === "cards" ? <><div className="skeleton mb-6 h-24" />{cards}</>
        : shape === "decks" ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-60" />)}</div>
        : <>{shape === "stats" && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>}<div className="rounded-xl border border-line p-4"><div className="skeleton mb-6 h-8 w-1/3" />{Array.from({ length: 8 }, (_, i) => <div key={i} className="mb-3 grid grid-cols-[2fr_1fr_1fr] gap-6"><div className="skeleton h-7" /><div className="skeleton h-7" /><div className="skeleton h-7" /></div>)}</div></>}
    </div>
  </div>;
}
