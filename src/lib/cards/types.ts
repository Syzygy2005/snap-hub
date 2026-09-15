export interface Card {
  defId: string;
  name: string;
  cost: number;
  power: number;
  /** Plain text with <span>Keyword</span> markers. Render with <AbilityText>, never as HTML. */
  ability: string;
  art: string;
  series: string;
  tags: string[];
  deckable: boolean;
}

export const DECK_SIZE = 12;
