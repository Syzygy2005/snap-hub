// Trigger a snapshot on a running server: `npm run snapshot` (local) or
// `SITE_URL=https://your-site.vercel.app CRON_SECRET=... npm run snapshot`.
const base = process.env.SITE_URL ?? "http://localhost:3100";
const headers = process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {};
const endpoint = process.argv.includes("--cards") || process.argv.includes("--reference") ? "reference" : "snapshot";

const res = await fetch(`${base}/api/cron/${endpoint}`, { headers });
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
