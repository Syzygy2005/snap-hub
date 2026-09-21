import { EMBLEM_PATHS } from "@/lib/brand";
/** Scalable adaptation of the hand-and-card mark in the supplied Jade League guide. */
export function BrandGlyph({size = 80}: {size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 200 220" aria-hidden="true">{EMBLEM_PATHS.map((path,index) => <path key={index} {...path} />)}</svg>;
}
export function BrandLogo() {
  return <span className="flex items-center gap-2" aria-hidden="true"><BrandGlyph size={44} /><span className="flex flex-col"><span className="font-display text-[27px] font-extrabold italic leading-[.95] tracking-[-.075em] text-ink">SNAP</span><span className="mt-1 text-center text-[10px] font-bold leading-none tracking-[.48em] text-accent">HUB</span></span></span>;
}
