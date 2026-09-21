import archive from "./data/official-patches.json";
export const PATCH_ARCHIVE = archive;
export function officialMentions(kind: string, id: string) {
  return archive.notes.filter(note => note.mentions.some(entry => entry.kind === kind && entry.id === id));
}
