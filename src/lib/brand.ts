/** Jade League palette and scalable adaptation of the supplied hand-and-card reference. */
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
export const EMBLEM_PATHS = [
  {
    "d": "M45 159A74 74 0 1 1 151 170",
    "fill": "none",
    "stroke": "#36D6A0",
    "strokeWidth": "10",
    "strokeLinecap": "round"
  },
  {
    "d": "M115 16 164 32Q168 34 166 39L143 109Q142 113 137 111L91 96Z",
    "fill": "#102D29",
    "stroke": "#36D6A0",
    "strokeWidth": "6",
    "strokeLinejoin": "round"
  },
  {
    "d": "m138 38-19 31 16-5-8 23 28-34-17 6Z",
    "fill": "#36D6A0"
  },
  {
    "d": "m45 191 22-40-5-28 10-27 36-14q11-4 16 6l5 13 10 32q3 10-7 17l-19 15-14 45Z",
    "fill": "#F3F2E9",
    "stroke": "#102D29",
    "strokeWidth": "5",
    "strokeLinejoin": "round"
  },
  {
    "d": "m79 107 32-13q10-4 14 6l3 8-36 16m1-1 30-12q11-3 14 7l2 8-35 15m0 0 29-12q8-3 12 7l2 7-32 18-10 25",
    "fill": "#F3F2E9",
    "stroke": "#102D29",
    "strokeWidth": "5",
    "strokeLinecap": "round",
    "strokeLinejoin": "round"
  },
  {
    "d": "m78 110 13 31-12 25",
    "fill": "none",
    "stroke": "#102D29",
    "strokeWidth": "5",
    "strokeLinecap": "round"
  }
] as const;
