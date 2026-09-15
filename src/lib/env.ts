/**
 * Reads a secret-style environment variable. Values pasted on a phone often pick up trailing spaces,
 * line breaks or invisible characters, none of which belong in a URL, token or password here,
 * so only printable ASCII (no spaces) is kept.
 */
export function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const cleaned = [...raw].filter((ch) => ch > " " && ch <= "~").join("");
  return cleaned || undefined;
}
