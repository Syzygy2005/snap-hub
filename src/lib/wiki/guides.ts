/** Authored summaries, separate from hourly card imports. Review sources when rules change. */
export interface GuideSection {
  id: string;
  title: string;
  text: string;
  aliases?: string[];
  source?: { title: string; url: string };
}
export interface WikiGuide {
  slug: string;
  title: string;
  summary: string;
  reviewed: string;
  sections: GuideSection[];
  related: { title: string; href: string }[];
}
const official = (title: string, path: string) => ({ title, url: `https://marvelsnap.com/${path}/` });
const support = (title: string, path: string) => ({ title, url: `https://marvelsnap.helpshift.com/hc/en/3-marvel-snap/faq/${path}/` });
const snapping = support("Official snapping guide", "28-what-is-snapping");
const retreating = support("Official retreat guide", "29-what-does-retreating-do");
const priority = support("Official reveal-order guide", "38-whose-cards-are-revealed-first-during-a-turn");
const winning = support("Official win conditions", "90-how-do-i-win-a-match");
const activate = official("Activate explained", "our-first-brand-new-ability-activate");
const keywords = support("May 2026 keyword updates", "596-may-19---ota");
const packs = official("Snap Packs explained", "snap-packs-are-here");

export const WIKI_GUIDES: WikiGuide[] = [
  {
    slug: "basics", title: "How to play", summary: "Turns, locations, reveal order, snapping and knowing when to retreat.", reviewed: "2026-09-22",
    sections: [
      { id:"winning", title:"Win locations, not just total Power", text:"In a standard game, aim to finish ahead at two of the three locations. If each player wins one and the third is tied, total Power breaks the tie. Equal totals leave the game tied. A huge lead in one lane does not beat two lost lanes.", source:winning },
      { id:"turns", title:"The shape of a turn", text:"Standard SNAP uses a 12-card deck and normally lasts six turns. Both players plan their plays before cards reveal. Spend Energy to play cards, usually starting with one Energy and gaining one more maximum Energy each turn. Locations reveal over the first three turns, and each side normally has room for four cards at a location. Card and location effects can change these rules.", source:official("Official game introduction", "how-to-play") },
      { id:"priority", title:"Reveal order and priority", text:"Priority is the community name for revealing first. The player currently ahead on the board usually has it; look for the highlighted player name to check before committing a play. Your own cards reveal in the order you played them. An effect that removes an enemy card may work differently before and after that card reveals.", aliases:["initiative","reveal first"], source:priority },
      { id:"snapping", title:"Snapping and cube stakes", text:"A snap raises the stakes. Each player can snap once, and reaching the final showdown doubles the stakes again. In a normal game, a showdown is worth 2 cubes with no snaps, 4 with one snap and 8 with both. Read the cube display for the current stake and the next increase.", source:snapping },
      { id:"retreating", title:"Retreating is part of the game", text:"Retreat Now leaves immediately at the displayed retreat cost. Retreat Later waits to see whether the opponent also leaves; if both retreat, the game is a tie. Leaving before another stakes increase can save cubes. Winning more games is not automatically climbing faster: the size of your wins and losses matters too.", source:retreating },
      { id:"reading-effects", title:"Read the current card text", text:"On Reveal happens when a card reveals. Ongoing describes a continuing effect. Activate is queued by you on a later turn after the card has resolved, normally once per game. Conditions and timing still matter: check the current card and location pages when an interaction surprises you.", source:activate },
      { id:"first-deck", title:"Build around a plan", text:"Start with a way to win two locations and enough affordable cards to use your early turns. Ask what each card contributes: Power, a combo, disruption or flexibility. Use the deck builder to check your Energy curve, then adjust after playing. A deck code shares a list; it does not grant cards you do not own." },
    ],
    related:[{title:"SNAP terminology",href:"/wiki/terminology"},{title:"Choose a game mode",href:"/wiki/game-modes"},{title:"Build a deck",href:"/decks/builder"}],
  },
  {
    slug:"game-modes", title:"Game modes", summary:"Ranked, Conquest, Friendly Battle and the changing rules of limited-time events.", reviewed:"2026-09-22",
    sections:[
      {id:"ranked",title:"Ranked and Infinite",text:"The regular ladder uses cubes to track progress toward Infinite. After Infinite, the leaderboard follows Snap Points and rank. Snap Hub preserves the official top 1,000 and its history; it does not contain every player. The September 2026 update also introduced cubes toward Infinite on free limited-time event reward tracks.",aliases:["ladder","snap points","infinite"],source:official("September 2026 progression update","patch-notes-september-15-2026")},
      {id:"conquest",title:"Conquest",text:"Face the same opponent over several rounds with a locked deck. Each player begins with 10 health; the stakes determine damage to the loser. Reduce the opponent to zero to win the battle. Conquest runs add ticket tiers and medals, so surviving the whole battle matters more than winning every round.",source:official("Conquest and Battle Mode","conquer-the-game-with-conquest-a-new-way-to-play-and-win")},
      {id:"friendly-battle",title:"Friendly Battle",text:"Challenge someone using a battle code. The health-based, multiple-round format is useful for practice and friendly competition. You learn the opponent’s deck as rounds continue, and snapping affects the battle’s health stakes.",aliases:["battle mode","friend challenge"],source:official("Battle Mode format","conquer-the-game-with-conquest-a-new-way-to-play-and-win")},
      {id:"limited-time",title:"Limited-time modes: check the current event",text:"The entries below describe known formats, not a live schedule. Availability, bans, missions, entry costs and rewards can change each time a mode returns. Read its in-game rules and event announcement before building a deck or spending event currency.",aliases:["ltgm","events"],source:official("Official event announcements","category/events")},
      {id:"high-voltage",title:"High Voltage",text:"A three-turn format with extra Energy from an Arc Reactor and no snapping. It rewards fast combinations and big plays rather than cube management.",source:official("High Voltage introduction","new-limited-time-mode-high-voltage")},
      {id:"overdrive",title:"High Voltage: Overdrive",text:"A four-turn remix with charged cards added to the deck. Playing charged cards powers a Reactor effect, changing what is possible each match. It is a distinct format from the original High Voltage.",source:official("Overdrive rules","high-voltage-overdrive")},
      {id:"sanctum-showdown",title:"Sanctum Showdown",text:"Control locations to earn points over successive turns, racing to the target score. The Sanctum location adds a special scoring focus. Event remixes can adjust the pace, so use the active event’s scoring display.",source:official("Sanctum Showdown introduction","new-limited-time-mode-sanctum-showdown")},
      {id:"grand-arena",title:"Grand Arena",text:"Choose a Champion with a companion Skill and a themed deck. Prebuilt decks let players try the format without owning every card. The Champion and Skill begin in hand, opening lines of play that are different from Ranked.",source:official("Grand Arena introduction","new-limited-time-mode-grand-arena")},
      {id:"grand-arena-showdown",title:"Grand Arena: Showdown",text:"A crossover combining Champion-led decks with Sanctum-style location scoring. Treat it as its own ruleset rather than assuming either original mode’s win conditions.",source:support("Grand Arena: Showdown rules","636-limited-time-game-mode---grand-arena-showdown")},
      {id:"deadpools-diner",title:"Deadpool’s Diner",text:"Wager Bubs in place of cubes. Table stakes and automatic increases change the risk of staying in a match. Regeneration, shops and reward tracks have changed between events; check the current version before playing.",source:official("Deadpool’s Diner introduction","deadpools-diner")},
      {id:"team-clash",title:"Team Clash",text:"Pick a team with a shared ability and mode-specific versions of core characters. A fixed core and customizable slots shape your deck. Team Clash card text can differ from the same character’s standard card.",source:official("Team Clash introduction","new-limited-time-game-mode-team-clash")},
      {id:"draft",title:"Draft",text:"Build a deck from offered choices, then develop it between matches with additional cards, Augments or stat boosts. The introductory format starts with ten cards and aims for five wins before two losses. It tests adapting to the choices offered, rather than bringing a finished collection deck.",aliases:["augments"],source:official("Draft introduction","limited-time-game-mode-marvel-snap-draft")},
    ],
    related:[{title:"Learn the basics",href:"/wiki/basics"},{title:"Infinite leaderboard",href:"/leaderboard"},{title:"Game news",href:"/news"}],
  },
  {
    slug:"terminology",title:"SNAP terminology",summary:"A glossary of card mechanics, deck shorthand and words players use in chat.",reviewed:"2026-09-22",
    sections:[
      {id:"activate",title:"Activate",text:"An ability you queue after its card has resolved on an earlier turn, normally once per game. Its place in your action order matters.",source:activate},
      {id:"archetype",title:"Archetype",text:"A family of decks with a shared plan or core cards, such as Destroy, Discard, Move or Bounce. An archetype is not one fixed list."},
      {id:"bounce",title:"Bounce",text:"A deck plan that returns cards from play to hand so they can be played again, often to repeat effects or build Power."},
      {id:"cl",title:"CL — Collection Level",text:"The progression track advanced by upgrading cards. CL is separate from Ranked progress.",aliases:["collection level"]},
      {id:"cube-rate",title:"Cube rate",text:"Average net cubes per game. Losing several small games and winning a large one can produce a positive cube rate even with a lower win rate."},
      {id:"curve",title:"Curve",text:"The spread of Energy costs in a deck. Playing on curve means making good use of the Energy available on successive turns.",aliases:["energy curve","mana curve"]},
      {id:"destroy",title:"Destroy",text:"Remove a card from play through a destroy effect. This is different from discarding it from hand, returning it to hand or transforming it."},
      {id:"discard",title:"Discard",text:"Remove a card from hand through a discard effect. Cards can care about being discarded, or about which cards were discarded earlier."},
      {id:"draw",title:"Draw",text:"Take a card from your deck into your hand. Adding or creating a card in hand is a different action; follow the wording of the effect."},
      {id:"empowered",title:"Empowered",text:"A permanent increase to a card’s Power. Ongoing Power adjustments do not count; setting Power to a higher value does.",source:keywords},
      {id:"lane",title:"Lane",text:"Community shorthand for one of the board’s locations."},
      {id:"meta",title:"Meta",text:"The decks and strategies common in a player population at a given time. A popular deck is not guaranteed to be the best choice for your collection or opponents."},
      {id:"move",title:"Move / Moveable",text:"Move changes a card’s location. Moveable identifies a card you may move while planning plays, subject to the limits written on the card or effect.",source:keywords},
      {id:"on-reveal",title:"On Reveal",text:"An ability that resolves when a card reveals, subject to effects that prevent or repeat it. It is not a continuous bonus."},
      {id:"ongoing",title:"Ongoing",text:"A continuing ability while its conditions apply. Not every repeated or conditional ability is Ongoing; look for the actual keyword."},
      {id:"ota",title:"OTA / balance update",text:"Over-the-air updates adjust game balance outside a full client patch. Use the current card text and official balance notes when comparing older guides.",aliases:["over the air","patch"]},
      {id:"priority",title:"Priority / prio",text:"Revealing first in a turn. Check the highlighted name to see who has it before planning effects that depend on reveal order.",aliases:["initiative"],source:priority},
      {id:"ramp",title:"Ramp",text:"A strategy that gains extra Energy earlier than normal to play expensive cards sooner."},
      {id:"retreat",title:"Retreat",text:"Leave a game at the displayed retreat cost instead of risking the next stakes increase. Retreat Later can result in a tie if the opponent also retreats.",source:retreating},
      {id:"snap",title:"Snap / resnap",text:"A snap raises the stakes. Resnap is the community term for snapping back after your opponent has already snapped.",source:snapping},
      {id:"tech",title:"Tech card",text:"A card chosen to counter a particular threat or strategy. Its value depends on the opponents and situations you actually face."},
      {id:"tempo",title:"Tempo",text:"The immediate pressure or board advantage a play creates, often contrasted with saving resources for a bigger later turn."},
      {id:"tokens",title:"Tokens: cards or currency?",text:"A token card is a community term for a card created by another effect, such as a Rock. Collector’s Tokens are a separate shop currency."},
      {id:"variant",title:"Variant / split",text:"A variant is alternate card artwork. A split adds cosmetic presentation options after an Infinity upgrade. Neither changes the card’s gameplay stats."},
      {id:"win-condition",title:"Win condition",text:"The combination of cards, Power or board states your deck relies on to win. Ask whether it is still possible before accepting a snap."},
      {id:"zoo",title:"Zoo",text:"A deck that spreads many low-Cost cards across the board and boosts them together."},
    ],
    related:[{title:"Rules and timing",href:"/wiki/basics"},{title:"Look up current card text",href:"/wiki/cards"},{title:"Collection and cosmetics",href:"/wiki/collection"}],
  },
  {
    slug:"collection",title:"Collection & cosmetics",summary:"Card series, upgrades, currencies, variants and splits—what changes gameplay and what changes appearance.",reviewed:"2026-09-22",
    sections:[
      {id:"upgrades",title:"Upgrades and Collection Level",text:"Upgrading a card uses Credits and character Boosters to improve its presentation and advance Collection Level. Upgrading does not increase the card’s Power or reduce its Energy cost. Collection progression and Ranked progression are separate.",source:official("Collection progression","collection-level-evolution")},
      {id:"series",title:"Series are collection groups",text:"A card’s Series describes its acquisition group, not its strength or cosmetic rarity. A lower-Series card can be central to a strong deck. Read the current Series on the card’s reference page rather than assuming an older guide still applies."},
      {id:"packs",title:"Snap Packs and card acquisition",text:"Snap Packs group cards into acquisition pools, including Seasonal and Collector’s Packs. Pack contents, odds and eligibility are shown in the game. Use those current details when deciding how to spend Tokens; an old Spotlight Cache guide may describe a retired system.",source:packs},
      {id:"currencies",title:"Credits, Boosters, Gold and Tokens",text:"Credits and Boosters are used for upgrades. Gold and Collector’s Tokens are shop resources with different offers. Event currencies belong to their event’s reward system. Before spending, check what an offer grants, which currency it uses and when it expires.",source:packs},
      {id:"variants",title:"Variants and artist credits",text:"Variants change a card’s artwork while keeping the same gameplay identity. Our gallery uses the source’s rarity and acquisition labels and credits sketch, ink and color separately. An artist credit is not automatically the name of a variant series. Released status does not guarantee a variant is currently for sale."},
      {id:"splits",title:"Infinity splits and Custom Cards",text:"Splits and Custom Cards let you change a card’s visual treatment. Artwork, finishes, borders and effects are cosmetic; they do not create a stronger version of the card. Character Mastery has its own cosmetic rewards, and the available options can change with updates.",source:official("September 2026 cosmetic updates","patch-notes-september-15-2026")},
      {id:"albums",title:"Albums and collection goals",text:"Albums reward collecting their specified items. Check the exact requirements in the game: another variant of the same character may not qualify. Treat album completion as a collection goal, separate from the cards needed to build a deck."},
      {id:"wiki-data",title:"How to read this wiki",text:"Card stats, locations and variant catalogs come from hourly reference checks. Observed changes start when Snap Hub began tracking them. Official patch mentions and historical card records are separate sources. Guide pages are edited by hand and carry a review date; they are not updated by the hourly imports."},
    ],
    related:[{title:"Browse variants by artist",href:"/wiki/variants"},{title:"Card library",href:"/wiki/cards"},{title:"Patch history",href:"/wiki/history"}],
  },
];

export function guideBySlug(slug: string) { return WIKI_GUIDES.find(g => g.slug === slug); }
export function searchGuides(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return WIKI_GUIDES.flatMap(g => {
    const page = { title:g.title, description:g.summary, href:`/wiki/${g.slug}` };
    const sections = g.sections.filter(s => `${s.title} ${s.text} ${s.aliases?.join(" ") ?? ""}`.toLowerCase().includes(q))
      .map(s => ({title:s.title, description:`${g.title} · ${s.text}`, href:`/wiki/${g.slug}#${s.id}`}));
    return `${g.title} ${g.summary}`.toLowerCase().includes(q) ? [page,...sections] : sections;
  }).sort((a,b) => Number(b.title.toLowerCase()===q)-Number(a.title.toLowerCase()===q));
}
