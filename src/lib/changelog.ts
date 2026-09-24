/**
 * What changed on the site, newest first, in the words a player would use rather than the
 * words the commit used. Dates are the day the change landed on main.
 */
export interface Release {
  /** ISO date, rendered in UTC so it reads the same everywhere. */
  date: string;
  changes: { title: string; detail?: string }[];
}

export const CHANGELOG: Release[] = [
  {
    date: "2026-09-24",
    changes: [
      {
        title: "Card art stops going missing",
        detail:
          "Art on the card library, the location atlas and the wiki's featured picks sometimes showed \"Artwork unavailable\" because the site hosting it turned some requests away. Snap Hub now fetches each image once and serves it itself, so it loads the same every time.",
      },
      {
        title: "Guides checked against the official rules",
        detail:
          "How to play now gives the exact rule for who reveals first: more locations won, then more total Power, then a coin flip. Sanctum Showdown now says the Sanctum moves each turn.",
      },
    ],
  },
  {
    date: "2026-09-23",
    changes: [
      {
        title: "Wiki fixes: better related cards, working artist pages",
        detail:
          "Keep exploring on a card page no longer treats \"remove\" as a Move card or \"withdraw\" as Draw, and it now points to the Bounce and Zoo guides when a card fits them. Artists with only unreleased previews open on those previews instead of an empty gallery. Card pages show their stats straight away while variants load, and one failed section no longer takes the whole page down. Save and share errors read as plain messages.",
      },
      { title: "A wiki worth getting lost in", detail: "Daily artwork spotlights, artist galleries, side-by-side variant comparisons and connected card discoveries bring the collection to life. Sign in to mark variants Owned or Wanted and optionally share a revocable wishlist link. Six archetype guides help you plan your next game." },
      {
        title: "Battle mode stays out of your ranked numbers",
        detail:
          "Battle mode games were counted in win rate and cube rate as though they were ranked. They are still recorded, but your stats and the community stats now leave them out, the same way friendly games always have been.",
      },
    ],
  },
  {
    date: "2026-09-22",
    changes: [
      { title: "A wiki for the whole game", detail: "Browse variants across all cards and filter by sketch, ink or color artist. New guides cover game modes, SNAP terminology, getting started and collection cosmetics, with links to official rules." },
      { title: "One search for Snap Hub", detail: "The header now finds cards, locations, variant artists, wiki guides, players and public decks, grouped so each kind of result is easy to find." },
      {
        title: "See which locations you actually win",
        detail:
          "My Stats now has a Locations panel: how often each location turned up, how often you won it, and the average power you committed there. Each game's board marks the locations you won too. A location counts as won only when the game said so, and the game never says a location was lost, so everything else covers losing it and tying it alike.",
      },
      {
        title: "Cards you played are yours again",
        detail:
          "Your played and drawn cards were read from a log that covers both players, so your opponent's cards were mixed into yours on every game, along with a placeholder the game uses for an empty slot. Both now come from your own record of the match. Games uploaded before this keep the old lists.",
      },
      {
        title: "Credit for the games they walked away from",
        detail:
          "Your cube panel showed what retreating costs you. It now shows the other side: how often your opponent retreated and what that was worth. The tracker had been recording it all along.",
      },
      {
        title: "Retreat early and the board stops inventing locations",
        detail:
          "The second and third locations do not turn over until turns two and three. A game that ended before then still listed them, under the names the game uses internally, so a match you retreated from showed \"Reveal On 2\" beside a real location. A location nobody saw is now left blank.",
      },
      {
        title: "Your snaps are recorded again",
        detail:
          "Every game you snapped was stored as though you had not. The tracker looked for a field the game does not write, so win rate and cube rate for games where you raised the stakes were empty and those games counted as quiet ones instead. New uploads record it properly. Games uploaded before this cannot be corrected, because the file they came from is not kept.",
      },
      {
        title: "Card data keeps updating when a variant is delisted",
        detail:
          "When Marvel Snap Zone dropped the last variant of a single card, the whole hourly import was refused and every card kept its old name, cost, power and ability text. That card now keeps the variants already saved for it and the rest of the import goes through as normal. A collapse of the whole variant catalog is still refused.",
      },
      {
        title: "Patch note mentions name the right cards",
        detail:
          "Card pages listed official patch notes that only used the card's name as an ordinary word. The card called Random was credited with 55 of 139 articles, more than Thanos, because every patch note says \"a random card\" somewhere. Those are gone, and matching now respects capitals.",
      },
      {
        title: "Claiming a profile answers instead of erroring",
        detail:
          "Two people claiming the same profile at the same moment got a server error rather than a message saying it was taken. Both now get a clear answer.",
      },
      {
        title: "Faster card and location pages, lighter stats",
        detail:
          "Opening a card or location page read the whole reference table twice. It now reads the one entry. My Stats no longer sends every location name to your browser on each visit, and the tracker setup page stops polling once it has seen an upload.",
      },
      {
        title: "Games are never filed under your opponent",
        detail:
          "If a game file did not name your client, the tracker worked out who you were from your deck. On a game with an empty board, a turn one retreat for instance, that guess could land on your opponent, and the game and your display name were recorded against their account. Your uploads now stay on your own tracker key whenever the file does not say who you are.",
      },
    ],
  },
  {
    date: "2026-09-21",
    changes: [
      { title: "Explore card variants", detail: "Card wiki pages now include variant artwork, rarity and artist credits from Marvel Snap Zone. Released variants appear first, with unreleased previews tucked into their own section. The catalog updates with hourly card imports." },
      { title: "Location appearance rates with real data", detail: "Location pages now show observed 30-day appearance rates from SnapVault, with tracked-game counts and a source link. Missing data stays hidden instead of filling the facts panel with empty values." },
      { title: "Reliable reference imports and historical sources", detail: "Fixed the production database error blocking card and location refreshes. Wiki pages now include historical card stats and effects, reference facts, and links to official patch notes, separate from changes observed by Snap Hub." },
      { title: "A more balanced home page", detail: "Latest decks now sit below the compact Top 10, with larger card previews. Movers and updates keep their own sidebar without stretching the leaderboard into empty space." },
      { title: "Polish in every detail", detail: "Richer navigation, consistent page introductions, branded empty states, calmer tables, and shaped loading placeholders. Deck energy bars now glide as you add and remove cards, with reduced-motion support throughout." },
      { title: "Smoother motion and quicker navigation", detail: "Card artwork follows your mouse more smoothly, with gentler transitions throughout the site. Header dropdowns put wiki pages, leaderboard movers, deck tools, and stats options within easy reach on desktop and mobile." },
      { title: "The leaderboard loads reliably again", detail: "Fixed a freshness timestamp error that could crash the leaderboard and home page even while standings continued updating." },
      { title: "A fresh identity for Snap Hub", detail: "A forest and jade palette, clearer typography, and a new hand-and-card emblem bring the site together. Explore a redesigned home page and subtle card interactions, with full reduced-motion support." },
      { title: "Explore the card and location wiki", detail: "Search released cards and locations, inspect their effects, and add cards to your current deck draft." },
      { title: "Reference data stays up to date", detail: "Independent hourly checks refresh card stats, text and locations automatically. Failed imports keep the last good data, and the wiki shows freshness and observed balance changes." },
      {
        title: "Your private decks, on every device",
        detail: "Sign in to save and update private deck drafts on your account. Browser saves still work, and publishing a public or unlisted copy remains your choice.",
      },
      {
        title: "Know when your tracker is working",
        detail: "Setup now confirms the first upload, shows the last successful upload, and offers troubleshooting. Leaderboards show delayed source checks, and stats show upload freshness and small samples.",
      },
      {
        title: "Every destination fits on mobile",
        detail: "A mobile menu replaces the hidden scrolling links, with My Stats directly in navigation. Browser checks now cover the main journeys before changes ship.",
      },
      {
        title: "Clearer recovery when something goes wrong",
        detail:
          "Failed page loads now offer a retry, sign-out failures show a message instead of failing silently, and keyboard users can skip straight past the header to the page content.",
      },
      {
        title: "More reliable tracker stats",
        detail:
          "Repeat uploads now use the game's account identity even without an account header. Linking a key cannot overwrite another account's claim, My Stats shows failed refreshes and actions, and community counts clearly label tracker keys rather than players.",
      },
      {
        title: "Profile claims stay private until reviewed",
        detail:
          "Only you and admins can see a pending claim. A matching tracker name no longer confirms ownership: an admin must review it first. Earlier tracker confirmations now await that review too.",
      },
      {
        title: "The top ten reads like a leaderboard again",
        detail:
          "On a wide screen the numbers were spread across half a metre of empty table, and two rows stood taller than the rest. The columns now sit together, every row is the same height, and best rank and who is live show on the home page too.",
      },
      {
        title: "The board is the first thing you see on a phone",
        detail:
          "The banner repeated the logo already at the top of the screen and pushed the leaderboard two screens down. It is gone on phones, so the top ten is there when the page opens.",
      },
      {
        title: "See where your cubes actually go",
        detail:
          "My Stats now splits win rate and cube rate by who raised the stakes, and shows what a retreat costs you against what sitting through a loss costs. Your tracker was already recording all of it.",
      },
    ],
  },
  {
    date: "2026-09-20",
    changes: [
      {
        title: "Sharing Movers shows the actual climbers",
        detail:
          "Post a link to Movers in Discord or anywhere else and the preview names the five players who climbed most in the last day, instead of showing a logo.",
      },
      {
        title: "My Stats links to your leaderboard profile",
        detail: "Once you have claimed a profile, My Stats points at it. Until then it says where to go.",
      },
      {
        title: "Claim your leaderboard profile",
        detail:
          "Sign in and press \u201cThis is me\u201d on your player page. Run the tracker under the same name and it confirms itself, otherwise it stays private until an admin confirms it.",
      },
      {
        title: "Name changes are read off the board more carefully",
        detail:
          "A player dropping off the bottom of the board and a new one arriving look the same as somebody renaming, and were occasionally being treated as one person. That is now checked against how far a player can actually fall. Fewer name changes get spotted, and the ones that do are right.",
      },
      {
        title: "Match history shows the board again",
        detail:
          "The end of game board was coming back empty for every game, and the opponent's cards with it. Games recorded from now on have both. Older games keep what they had.",
      },
      {
        title: "Fixed the wrong \u201cnew name\u201d tag properly this time",
        detail:
          "Players were still being shown under a default name that was never theirs. A name only says who somebody is while one person is using it, so a name more than one player has used is no longer treated as anybody's in particular. The trade is that someone renaming away from a default name is not recognised at all, which beats pinning it on a stranger.",
      },
    ],
  },
  {
    date: "2026-09-18",
    changes: [
      {
        title: "Game news",
        detail:
          "Balance updates and patches now have a page of their own at /news, with a link to the official post for each one. Changes to this site stay on What's new.",
      },
      {
        title: "The board updates every 10 minutes",
        detail:
          "It was every half hour. Checking more often also catches more name changes, because a rename is only recognisable while a player's points sit still.",
      },
      {
        title: "The leaderboard started over",
        detail:
          "Early tracking recorded some players under names that were never theirs, so the stored history was cleared and rebuilt from the official board. Ranks and points came back with the next snapshot. Point changes and Movers build up again from here.",
      },
      {
        title: "Fixed a wrong \u201cnew name\u201d tag",
        detail:
          "Dozens of players share the default name, and one of them dropping off the board was being read as a rename and pinned on whoever arrived next. Both sides are now checked against the whole board before anything is recorded.",
      },
    ],
  },
  {
    date: "2026-09-17",
    changes: [
      {
        title: "Decks with a bad name can be fixed rather than lost",
        detail: "Reported decks can now be renamed or removed.",
      },
      {
        title: "Players who change their name keep their history",
        detail:
          "A rename used to look like one player vanishing and a stranger appearing at a similar rank. The board now spots it, tags them as a new name, and their profile lists what they were called before.",
      },
      {
        title: "Decks show who posted them",
        detail:
          "Share a deck while signed in and it carries your name. Two people sharing the same twelve cards under the same name now get a deck each instead of landing on one.",
      },
      {
        title: "Your stats follow your account",
        detail:
          "Add your tracker key to your account once and your games are there on any browser you sign in to, instead of living in one browser's storage.",
      },
      {
        title: "Sign in with Discord",
        detail: "No password to pick and none stored here. Only your name and avatar are read.",
      },
    ],
  },
  {
    date: "2026-09-16",
    changes: [
      {
        title: "The tracker is a zip you double-click",
        detail:
          "No more opening PowerShell and pasting a command. Your key is already in it, so there is nothing to type.",
      },
      {
        title: "See how the board ended",
        detail: "Every tracked game in My stats can show the three locations as they stood when it finished.",
      },
      {
        title: "Keep decks private, or share them unlisted",
        detail:
          "The builder saves as many decks as you like in your browser, privately. Sharing now asks whether to list the deck publicly or hand you a link that stays off the Decks page.",
      },
      {
        title: "Search decks by name or by the cards in them",
        detail: "Filter the Decks page down to decks containing the cards you pick.",
      },
      {
        title: "The leaderboard says Live instead of guessing minutes",
        detail:
          "The board refreshes every half hour, so it now marks players who moved in the newest update and rounds everything else to hours, days and weeks.",
      },
      {
        title: "Fixed the page zooming on iPhone",
        detail: "Tapping a search box no longer zooms the page in and leaves it there.",
      },
    ],
  },
];

export const latestRelease = (): Release | undefined => CHANGELOG[0];
