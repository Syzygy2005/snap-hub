import { locationRate } from "@/lib/wiki/location-rates";

export async function LocationRate({ id }: { id: string }) {
  const rate = await locationRate(id);
  if (!rate) return null;
  const percent = rate.percent > 0 && rate.percent < 0.1 ? "<0.1%" : rate.percent.toFixed(1) + "%";
  return <div>
    <dt className="text-muted">Observed appearance · 30 days</dt>
    <dd className="mt-1">
      <strong className="num text-xl text-accent">{percent}</strong>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Seen in {rate.games.toLocaleString("en-US")} of {rate.totalGames.toLocaleString("en-US")} tracked Ranked and Conquest games.
        {" "}Source: <a href={rate.url} className="text-accent underline">SnapVault</a> · refreshed hourly.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">Observed games, not base spawn odds. Events and location-changing effects can affect this rate.</p>
    </dd>
  </div>;
}
