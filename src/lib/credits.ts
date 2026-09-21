// Everything Snap Hub is built on or learned from. Shown on /credits; keep README.md's Credits in sync.
// Snap Hub doesn't include code from the community projects below; they showed what data exists and how it's shaped.

export interface Credit {
  name: string;
  url: string;
  by?: string;
  note: string;
}

export const INSPIRATION: Credit[] = [
  {
    name: "Better Snap Leaderboard",
    by: "JaydenScottL",
    url: "https://github.com/JaydenScottL/bettersnaplb",
    note: "The starting point for this site. Showed where the official Infinite leaderboard data lives and what a better board could look like.",
  },
  {
    name: "Untapped.gg for Marvel Snap",
    url: "https://snap.untapped.gg",
    note: "The model for the stats: win rate, cube rate, meta share, and drawn/played win rates per card.",
  },
  {
    name: "Marvel Snap Zone deck builder",
    url: "https://marvelsnapzone.com/deck-builder/",
    note: "The model for the deck builder: card filters, energy curve and shareable deck codes.",
  },
];

export const DATA: Credit[] = [
  { name: "Official MARVEL SNAP patch notes", by: "Second Dinner", url: "https://marvelsnap.com/news/", note: "The historical patch-article index links to official sources; it records mentions, not inferred balance changes." },
  { name: "SNAP.FAN card history", url: "https://snap.fan/cards/history/2026/", note: "Historical card stats and effect versions, fetched per card and cached daily; coverage and dates reflect the source." },
  {
    name: "MARVEL SNAP Infinite leaderboard",
    by: "Second Dinner / Nuverse",
    url: "https://marvelsnap.com/infiniteleaderboard/",
    note: "The public leaderboard every snapshot on this site comes from.",
  },
  {
    name: "Marvel Snap Zone card and location databases",
    url: "https://marvelsnapzone.com/cards/",
    note: "Card names, costs, power, abilities, location effects, rarity and artwork used across the site.",
  },
];

export const RESEARCH: Credit[] = [
  {
    name: "Marvel Snap Tracker",
    by: "Razviar (Marvel Snap Zone)",
    url: "https://github.com/Razviar/marvelsnaptracker",
    note: "Its published field map (marvelsnap.pro parsing metadata) is how the Snap Hub tracker knows where results, cubes and decks sit in GameState.json.",
  },
  {
    name: "Helper for Marvel Snap",
    by: "johnvictorfs",
    url: "https://github.com/johnvictorfs/helper-for-marvel-snap",
    note: "Showed how GameState.json, PlayState.json and CollectionState.json fit together. (GPL-3.0)",
  },
  {
    name: "snapscripts",
    by: "snaptools2023",
    url: "https://github.com/snaptools2023/snapscripts",
    note: "Reading decks from CollectionState.json and turning them into importable deck codes. (MIT)",
  },
  {
    name: "Snap Extract",
    by: "switchfire6",
    url: "https://github.com/switchfire6/snap-extract",
    note: "Confirmed the game's state files are UTF-8 with a byte-order mark. (MIT)",
  },
  {
    name: "marvelsnapdeck",
    by: "barkingloudly",
    url: "https://github.com/barkingloudly/marvelsnapdeck",
    note: "Reference for the original base64 JSON deck code format. (MIT)",
  },
  {
    name: "marvel-snap-deckstrings",
    by: "9j",
    url: "https://github.com/9j/marvel-snap-deckstrings",
    note: "Another reference implementation of deck code encoding.",
  },
  {
    name: "DeckCodes.chat",
    url: "https://deckcodes.chat/about",
    note: "Explained the newer short deck code format (card IDs without vowels plus their length).",
  },
];

export const TOOLS: Credit[] = [
  { name: "parse5", url: "https://github.com/inikulin/parse5", note: "Safe HTML parsing for historical card tables (MIT)" },
  { name: "Next.js", url: "https://nextjs.org", note: "Web framework (MIT)" },
  { name: "React", url: "https://react.dev", note: "UI library (MIT)" },
  { name: "Tailwind CSS", url: "https://tailwindcss.com", note: "Styling (MIT)" },
  { name: "PGlite", url: "https://pglite.dev", note: "Postgres for local development (Apache-2.0)" },
  { name: "postgres.js", url: "https://github.com/porsager/postgres", note: "Database driver (Unlicense)" },
  { name: "sharp", url: "https://sharp.pixelplumbing.com", note: "Cutting the logo files out of the brand sheet (Apache-2.0)" },
  { name: "Vitest", url: "https://vitest.dev", note: "Tests (MIT)" },
  { name: "Playwright", url: "https://playwright.dev", note: "Browser regression tests (Apache-2.0)" },
  { name: "jsdom", url: "https://github.com/jsdom/jsdom", note: "Component interaction tests (MIT)" },
  { name: "Manrope & Inter", url: "https://fonts.google.com", note: "Fonts via Google Fonts (SIL Open Font License)" },
  { name: "Vercel, Supabase & GitHub Actions", url: "https://vercel.com", note: "Hosting, database and the 30-minute snapshot job" },
  {
    name: "Claude Code",
    by: "Anthropic",
    url: "https://claude.com/claude-code",
    note: "This site was vibe-coded: most of the code was written with Claude.",
  },
  {
    name: "ChatGPT",
    by: "OpenAI",
    url: "https://chatgpt.com",
    note: "Used to generate the Snap Hub logo and brand sheet.",
  },
];
