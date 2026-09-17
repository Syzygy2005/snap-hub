import { cleanEnv } from "@/lib/env";
import type { Account } from "./session";

/**
 * Who can moderate, by Discord id, from ADMIN_DISCORD_IDS (comma separated).
 *
 * Config rather than a column on accounts: there is no bootstrap problem, nobody can grant
 * themselves the flag by reaching the database, and taking it away is a redeploy rather than
 * remembering the right UPDATE. cleanEnv has already stripped spaces and stray characters.
 */
export function adminIds(): string[] {
  return (cleanEnv("ADMIN_DISCORD_IDS") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdmin(account: Pick<Account, "discordId"> | null | undefined): boolean {
  if (!account) return false;
  const ids = adminIds();
  return ids.length > 0 && ids.includes(account.discordId);
}
