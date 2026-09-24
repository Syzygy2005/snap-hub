"use client";
import { InteractiveArt } from "./interactive-art";
import { RetryImage } from "./retry-image";
import { artSrc } from "@/lib/art";

export function WikiArt({ name, art, featured = false }: { name: string; art: string; featured?: boolean }) {
  const box = "flex aspect-square items-center justify-center p-8 text-center text-muted";
  const unavailable = <div className={box} role="img" aria-label={`${name}: artwork unavailable`}>Artwork unavailable</div>;
  const image = <div className="relative">
    {art
      ? <RetryImage src={artSrc(art)} alt={name} eager={featured} className="aspect-square w-full object-contain"
          waiting={<div className={box} role="img" aria-label={`${name}: artwork loading`} />} fallback={unavailable} />
      : unavailable}
  </div>;
  return featured ? <InteractiveArt>{image}</InteractiveArt> : image;
}
