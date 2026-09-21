"use client";
import { useState } from "react";
export function WikiArt({ name, art, featured = false }: { name: string; art: string; featured?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative">
    {art && !failed ? /* eslint-disable-next-line @next/next/no-img-element */
      <img src={art} alt={name} onError={() => setFailed(true)} loading={featured ? "eager" : "lazy"} decoding="async" draggable={false} className="aspect-square w-full object-contain" />
      : <div className="flex aspect-square items-center justify-center p-8 text-center text-muted" role="img" aria-label={`${name}: artwork unavailable`}>Artwork unavailable</div>}
  </div>;
}
