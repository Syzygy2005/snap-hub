/** Jade League palette and the approved split-card emblem inside an open jade ring. */
export const BRAND = { forest: "#102D29", jade: "#36D6A0", cream: "#F3F2E9", surface: "#19413A", muted: "#A8D0B5" } as const;
/** Outlined lettering keeps the lockup's alignment independent of fonts and tracking. */
export const WORDMARK = {
  viewBox: "0 0 276 104",
  width: 276,
  height: 104,
  snapTransform: "translate(11 2) skewX(-10)",
  snap: [
    "M14 0H63L54 14H23L18 19V22H42L55 35V45L42 58H0L9 44H34L39 39V36H15L2 23V13Z",
    "M68 58V0H83L112 32V0H128V58H113L84 26V58Z",
    "M132 58L155 0H178L201 58H183L179 47H151L147 58ZM156 34H174L165 12Z",
    "M207 58V0H247L264 17V31L247 46H224V58ZM224 14V32H241L247 26V20L241 14Z",
  ],
  hub: [
    "M78 79H84V87H96V79H102V100H96V93H84V100H78Z",
    "M123 79H129V94H141V79H147V95L142 100H128L123 95Z",
    "M168 79H189L195 85V88L192 90L195 92V95L190 100H168ZM174 84V87H187L189 85.5L187 84ZM174 92V95H187L189 93.5L187 92Z",
  ],
  rules: "M0 87H60V92H0ZM216 87H276V92H216Z",
} as const;
export const EMBLEM_VIEWBOX = "0 0 200 200";
const CARD_TRANSFORM = "translate(100 100) scale(.70) translate(-103 -100) rotate(12 103 100)";
export const EMBLEM_PATHS = [
  {
    "d": "M49 157A76 76 0 1 1 154 155",
    "fill": "none",
    "stroke": BRAND.jade,
    "strokeWidth": "11",
    "strokeLinecap": "round"
  },
  // Two silhouettes leave the lightning cut transparent on every surface.
  {
    "d": "M61 24H109.044444L67 110H94L59.166667 174.166667L46 161V39ZM141.75 24H145L160 39V161L145 176H90.85L126 100H99Z",
    "fill": "currentColor",
    "transform": CARD_TRANSFORM
  },
  {
    "d": "M145 24L160 39V78H149V44L133 28Z",
    "fill": BRAND.jade,
    "transform": CARD_TRANSFORM
  }
] as const;
