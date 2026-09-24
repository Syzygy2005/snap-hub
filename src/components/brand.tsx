import { BRAND, EMBLEM_PATHS, WORDMARK } from "@/lib/brand";
/** Scalable adaptation of the hand-and-card mark in the supplied Jade League guide. */
export function BrandGlyph({size = 80}: {size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 200 220" aria-hidden="true">{EMBLEM_PATHS.map((path,index) => <path key={index} {...path} />)}</svg>;
}
export function BrandLogo() {
  return <span className="inline-flex items-center gap-1.5" aria-hidden="true"><BrandGlyph size={44} /><BrandWordmark className="h-auto w-[88px] sm:w-[104px]" /></span>;
}

export function BrandWordmark({ className }: { className?: string }) {
  return <svg width={WORDMARK.width} height={WORDMARK.height} viewBox={WORDMARK.viewBox} className={className} aria-hidden="true" focusable="false">
    <g transform={WORDMARK.snapTransform} fill="currentColor" fillRule="evenodd">{WORDMARK.snap.map((d, index) => <path key={index} d={d} />)}</g>
    <g fill="currentColor" fillRule="evenodd">{WORDMARK.hub.map((d, index) => <path key={index} d={d} />)}</g>
    <path d={WORDMARK.rules} fill={BRAND.jade} />
  </svg>;
}
