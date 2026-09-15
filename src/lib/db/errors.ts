// Turns database connection failures into a plain-English fix. Shown in the snapshot job's log on GitHub,
// which only people with CRON_SECRET can trigger. Connection strings are never echoed back.

export function describeDbError(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown; errno?: unknown };
  const code = typeof e?.code === "string" ? e.code : "";
  const raw = typeof e?.message === "string" ? e.message : String(err);
  const message = raw.replace(/postgres(ql)?:\/\/\S+/gi, "postgres://…");

  if (!process.env.DATABASE_URL && process.env.VERCEL) {
    return "DATABASE_URL isn't set in Vercel. Add it under Settings → Environment Variables, then redeploy.";
  }
  if (/invalid url/i.test(message) || code === "ERR_INVALID_URL") {
    return "DATABASE_URL isn't a valid address. Check the [YOUR-PASSWORD] part was fully replaced (no square brackets) and the password has no symbols.";
  }
  if (["ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"].includes(code)) {
    return `Can't find the database server (${code}). Use Supabase's "Transaction pooler" connection string (host ends in pooler.supabase.com, port 6543), not the direct connection.`;
  }
  if (["ECONNREFUSED", "ETIMEDOUT", "CONNECT_TIMEOUT", "ECONNRESET"].includes(code)) {
    return `The database didn't answer (${code}). Check the Supabase project isn't paused and that DATABASE_URL uses port 6543.`;
  }
  if (code === "28P01" || /password authentication failed/i.test(message)) {
    return "The database password in DATABASE_URL is wrong. Reset it in Supabase (Project Settings → Database), update DATABASE_URL in Vercel, then redeploy.";
  }
  if (/tenant or user not found/i.test(message)) {
    return 'Supabase doesn\'t recognise the user in DATABASE_URL. Copy the "Transaction pooler" string again; the user should look like postgres.abcdefghij.';
  }
  if (code === "3D000") {
    return "The database name in DATABASE_URL doesn't exist. It should end in /postgres.";
  }
  return `Unexpected error${code ? ` (${code})` : ""}: ${message.slice(0, 300)}`;
}
