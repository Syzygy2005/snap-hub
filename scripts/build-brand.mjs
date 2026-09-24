// Regenerate SVG exports from the same geometry used by the header and social previews.
// Node 24 can import this TypeScript data module directly.
import { mkdirSync, writeFileSync } from "node:fs";
import { BRAND, EMBLEM_PATHS, EMBLEM_VIEWBOX, WORDMARK } from "../src/lib/brand.ts";
import { renderBrandGuide } from "./render-brand-guide.mjs";
const emblemPaths = color => EMBLEM_PATHS.map(path => `<path ${Object.entries(path).map(([key,value]) => `${key.replace(/[A-Z]/g, char => "-" + char.toLowerCase())}="${value === "currentColor" ? color : value}"`).join(" ")}/>`).join("\n");
const paths = emblemPaths(BRAND.forest);
mkdirSync("public/brand", {recursive:true});
writeFileSync("public/brand/emblem.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${EMBLEM_VIEWBOX}" role="img" aria-label="Snap Hub split card and jade ring">${paths}</svg>\n`);
writeFileSync("public/brand/emblem-dark.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${EMBLEM_VIEWBOX}" role="img" aria-label="Snap Hub split card and jade ring">${emblemPaths(BRAND.cream)}</svg>\n`);
const wordmark = `<g transform="${WORDMARK.snapTransform}" fill="${BRAND.forest}" fill-rule="evenodd">${WORDMARK.snap.map(d => `<path d="${d}"/>`).join("")}</g><g fill="${BRAND.forest}" fill-rule="evenodd">${WORDMARK.hub.map(d => `<path d="${d}"/>`).join("")}</g><path d="${WORDMARK.rules}" fill="${BRAND.jade}"/>`;
writeFileSync("public/brand/wordmark.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK.viewBox}" role="img" aria-label="Snap Hub">${wordmark}</svg>\n`);
writeFileSync("src/app/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="52" fill="${BRAND.cream}"/><g transform="translate(20 20)">${paths}</g></svg>\n`);
mkdirSync("brand", {recursive:true});
writeFileSync("brand/brand-guide.svg", renderBrandGuide({BRAND, WORDMARK, EMBLEM_PATHS, EMBLEM_VIEWBOX}));
console.log("Updated light/dark emblems, wordmark, app icon and visual brand guide. Next renders the Apple and Open Graph images from the shared BrandGlyph.");
