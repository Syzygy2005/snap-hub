import { afterEach, expect, it, vi } from "vitest";
import { syncReference } from "@/lib/wiki/sync";
import { GET } from "./route";
vi.mock("@/lib/wiki/sync",()=>({syncReference:vi.fn()}));
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();vi.mocked(syncReference).mockReset();});
it("requires a secret in production and reports partial failure as a failed job",async()=>{
  vi.stubEnv("NODE_ENV","production");vi.stubEnv("CRON_SECRET","");
  expect((await GET(new Request("http://localhost/api/cron/reference"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET","test-secret");
  expect((await GET(new Request("http://localhost/api/cron/reference"))).status).toBe(401);
  expect(syncReference).not.toHaveBeenCalled();
  vi.mocked(syncReference).mockResolvedValueOnce({total:120,deckable:120}).mockRejectedValueOnce(new Error("upstream failure"));
  vi.spyOn(console,"error").mockImplementation(()=>{});
  const req=()=>new Request("http://localhost/api/cron/reference",{headers:{authorization:"Bearer test-secret"}});
  const failed=await GET(req()); expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ok:false,cards:"fulfilled",locations:"rejected"});
  vi.mocked(syncReference).mockResolvedValue({total:120,deckable:120});
  const good=await GET(req());expect(good.status).toBe(200);expect(good.headers.get("cache-control")).toBe("no-store");
});
