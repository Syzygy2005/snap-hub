import { isRegion, type Region } from "@/lib/config";
import { listRegionsWithData, listSeasons } from "./queries";

type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** A parameter that can repeat, like ?card=Thanos&card=AntMan. */
export function paramList(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  if (Array.isArray(v)) return v.filter(Boolean);
  return v ? [v] : [];
}

/** Resolve ?season= and ?region= against what we actually have stored. */
export async function resolveBoardParams(sp: SearchParams) {
  const regionParam = param(sp, "region");
  const region: Region = isRegion(regionParam) ? regionParam : "global";
  const [seasons, regions] = await Promise.all([listSeasons(region), listRegionsWithData()]);
  const seasonParam = param(sp, "season");
  const season = seasonParam && seasons.includes(seasonParam) ? seasonParam : seasons[0];
  return { region, season, seasons, regions };
}

export function boardHref(path: string, params: { season?: string; region?: Region; [k: string]: string | undefined }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && !(k === "region" && v === "global")) q.set(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
