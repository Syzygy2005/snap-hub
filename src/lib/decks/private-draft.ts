/** Recovery copies belong to one signed-in account and one private draft, never the public builder. */
export interface PrivateDraftRecovery { name: string; deck: string[]; sourceUpdatedAt: string }

const keyFor = (owner: number, id: string) => `snaphub:private-draft:${owner}:${id}`;

export function readPrivateDraft(owner: number, id: string): PrivateDraftRecovery | null {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(owner, id)) ?? "null");
    if (!value || typeof value.name !== "string" || typeof value.sourceUpdatedAt !== "string"
      || !Array.isArray(value.deck) || !value.deck.every((card: unknown) => typeof card === "string")) return null;
    return { name: value.name, deck: value.deck, sourceUpdatedAt: value.sourceUpdatedAt };
  } catch { return null; }
}

/** False asks the builder to protect unsaved edits with the browser's reload warning. */
export function writePrivateDraft(owner: number, id: string, draft: PrivateDraftRecovery | null): boolean {
  try {
    if (draft) localStorage.setItem(keyFor(owner, id), JSON.stringify(draft));
    else localStorage.removeItem(keyFor(owner, id));
    return true;
  } catch { return false; }
}
