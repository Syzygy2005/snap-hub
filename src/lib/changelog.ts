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
    date: "2026-09-17",
    changes: [
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
