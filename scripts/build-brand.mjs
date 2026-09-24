// Regenerate SVG exports from the same geometry used by the header and social previews.
// Node 24 can import this TypeScript data module directly.
import { mkdirSync, writeFileSync } from "node:fs";
import { BRAND, EMBLEM_PATHS } from "../src/lib/brand.ts";
const paths = EMBLEM_PATHS.map(path => `<path ${Object.entries(path).map(([key,value]) => `${key.replace(/[A-Z]/g, char => "-" + char.toLowerCase())}="${value}"`).join(" ")}/>`).join("\n");
mkdirSync("public/brand", {recursive:true});
writeFileSync("public/brand/emblem.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">${paths}</svg>\n`);
writeFileSync("src/app/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="52" fill="${BRAND.cream}"/><g transform="translate(20 10)">${paths}</g></svg>\n`);
console.log("Updated emblem and app icon. Next renders the Apple and Open Graph images from the shared BrandGlyph.");
