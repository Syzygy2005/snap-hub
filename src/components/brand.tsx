import { BRAND, EMBLEM_PATHS, EMBLEM_VIEWBOX, WORDMARK } from "@/lib/brand";
/** Theme-aware split card and jade ring; explicit color supports static image renders. */
export function BrandGlyph({size = 80, color}: {size?: number; color?: string}) {
  return <svg width={size} height={size} viewBox={EMBLEM_VIEWBOX} className="text-ink" aria-hidden="true" focusable="false">{EMBLEM_PATHS.map((path,index) => <path key={index} {...path} fill={path.fill === "currentColor" && color ? color : path.fill} />)}</svg>;
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
