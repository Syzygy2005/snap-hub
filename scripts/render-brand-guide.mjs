// A vector guide built from the production logo paths, so the identity never drifts.
export function renderBrandGuide({ BRAND, WORDMARK, EMBLEM_PATHS, EMBLEM_VIEWBOX }) {
  const { forest, cream, jade, surface, muted } = BRAND;
  const paths = color => EMBLEM_PATHS.map(path => `<path ${Object.entries(path).map(([key, value]) => `${key.replace(/[A-Z]/g, char => "-" + char.toLowerCase())}="${value === "currentColor" ? color : value}"`).join(" ")}/>`).join("");
  const emblem = (x, y, size, color) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${EMBLEM_VIEWBOX}">${paths(color)}</svg>`;
  const wordmark = (x, y, width, color) => `<svg x="${x}" y="${y}" width="${width}" height="${width * WORDMARK.height / WORDMARK.width}" viewBox="${WORDMARK.viewBox}"><g transform="${WORDMARK.snapTransform}" fill="${color}" fill-rule="evenodd">${WORDMARK.snap.map(d => `<path d="${d}"/>`).join("")}</g><g fill="${color}" fill-rule="evenodd">${WORDMARK.hub.map(d => `<path d="${d}"/>`).join("")}</g><path d="${WORDMARK.rules}" fill="${jade}"/></svg>`;
  const text = (x, y, value, size = 18, color = forest, weight = 400, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${value}</text>`;
  const rule = y => `<path d="M40 ${y}H1080" stroke="${forest}" stroke-opacity=".18"/>`;
  const section = (y, number, label, subtitle) => text(40, y, number + " /", 26, "#08664C", 700) + text(114, y, label, 26, forest, 700) + text(114, y + 29, subtitle, 17, "#52685C");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1580" viewBox="0 0 1120 1580" role="img" aria-labelledby="title desc">
<title id="title">Snap Hub visual brand guide</title><desc id="desc">The split-card emblem inside an open jade ring, the unchanged custom SNAP HUB wordmark, cream and forest applications, colour palette, typography, and small-size guidance.</desc>
<rect width="1120" height="1580" fill="${cream}"/>
<g font-family="Inter, Arial, sans-serif">
<rect width="1120" height="280" fill="${forest}"/>
${emblem(40, 39, 205, cream)}${wordmark(260, 98, 320, cream)}
<path d="M637 48V225" stroke="${cream}" stroke-opacity=".45"/>
${text(687, 93, "BUILD /", 32, cream, 400, 'letter-spacing="7"')}
${text(687, 140, "TRACK /", 32, cream, 400, 'letter-spacing="7"')}
${text(687, 187, "COMPETE", 32, cream, 400, 'letter-spacing="7"')}
${text(687, 225, "PLAY · COLLECT · IMPROVE · BELONG", 12, muted, 400, 'letter-spacing="1.6"')}
${section(326, "01", "LOGO SYSTEM", "A split card. A lightning cut. An open jade ring.")}
<rect x="40" y="382" width="510" height="216" rx="14" fill="${cream}" stroke="${forest}" stroke-opacity=".2"/>
${emblem(86, 397, 155, forest)}${wordmark(253, 435, 242, forest)}
${text(64, 575, "PRIMARY / CREAM", 13, forest, 700, 'letter-spacing="1.5"')}
<rect x="570" y="382" width="510" height="216" rx="14" fill="${forest}"/>
${emblem(616, 397, 155, cream)}${wordmark(783, 435, 242, cream)}
${text(594, 575, "REVERSE / FOREST", 13, cream, 700, 'letter-spacing="1.5"')}
${text(40, 630, "Keep the custom lettering intact. Scale the complete emblem uniformly; preserve the ring opening.", 18)}
${text(40, 657, "The lightning gap is transparent, so the actual surface shows through. Never fill it with a painted patch.", 18, "#52685C")}
${rule(686)}
${section(729, "02", "COLOUR PALETTE", "Cream leads. Forest gives contrast. Jade draws attention.")}
${[
  ["CREAM", cream, "Primary light surface"], ["JADE", jade, "Ring, accents, actions"],
  ["FOREST", forest, "Ink and dark canvas"], ["SURFACE", surface, "Dark-theme panels"],
  ["MUTED", muted, "Dark-theme support"],
].map(([name, color, usage], i) => {
  const x = 40 + i * 212;
  return `<rect x="${x}" y="785" width="192" height="76" rx="8" fill="${color}" stroke="${forest}" stroke-opacity=".2"/>` + text(x, 890, name, 15, forest, 700) + text(x, 914, color, 16) + text(x, 938, usage, 14, "#52685C");
}).join("")}
${rule(962)}
${section(1005, "03", "TYPOGRAPHY", "Manrope for headings. Inter for reading. Custom outlines for the logo.")}
${text(40, 1076, "HEADINGS / MANROPE BOLD", 13, "#52685C", 700, 'letter-spacing="1.4"')}
${text(40, 1125, "Build your next", 43, forest, 800, 'font-family="Manrope, Arial, sans-serif" letter-spacing="-1.5"')}
${text(40, 1173, "winning deck.", 43, forest, 800, 'font-family="Manrope, Arial, sans-serif" letter-spacing="-1.5"')}
<path d="M555 1060V1183" stroke="${forest}" stroke-opacity=".18"/>
${text(594, 1076, "BODY / INTER REGULAR", 13, "#52685C", 700, 'letter-spacing="1.4"')}
${text(594, 1116, "Explore decks, track your progress,", 24)}
${text(594, 1150, "and find your community.", 24)}
${text(594, 1180, "Use tabular numerals for scores and statistics.", 17, "#52685C")}
${rule(1210)}
${section(1253, "04", "SPACE &amp; SCALE", "Keep breathing room. Use the emblem alone when space is limited.")}
${emblem(40, 1335, 24, forest)}${text(40, 1400, "24 PX", 13, "#52685C", 700)}
${emblem(121, 1315, 44, forest)}${wordmark(171, 1317.4, 104, forest)}${text(121, 1400, "HEADER / 44 PX", 13, "#52685C", 700)}
<rect x="323" y="1301" width="94" height="94" rx="20" fill="${cream}" stroke="${forest}" stroke-opacity=".2"/>
${emblem(332, 1310, 76, forest)}${text(323, 1422, "APP / SOCIAL", 13, "#52685C", 700)}
${text(488, 1330, "Retain the viewBox padding and keep controls outside the ring.", 18)}
${text(488, 1362, "Use forest artwork on light surfaces and cream artwork on dark.", 18)}
${text(488, 1394, "Do not stretch, close the ring, rotate again or retype the wordmark.", 18)}
${rule(1450)}
${text(40, 1494, "Clear over complicated.", 22, forest, 700)}
${text(399, 1494, "Confident, never loud.", 22, forest, 700)}
${text(758, 1494, "Built around community.", 22, forest, 700)}
${text(40, 1537, "SNAP HUB / JADE LEAGUE / VISUAL BRAND GUIDE", 11, "#52685C", 400, 'letter-spacing="1.8"')}
${text(878, 1537, "UPDATED 2026-09-24", 11, "#52685C", 400, 'letter-spacing="1.3"')}
</g></svg>\n`;
}
