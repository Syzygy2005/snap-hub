import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { authorizeUrl, avatarUrl, exchangeCode, newState, pkce, type DiscordConfig } from "./discord";
import { redirectUriFor, safeReturnTo } from "./urls";

const config: DiscordConfig = {
  clientId: "client-1",
  clientSecret: "secret-1",
  tokenUrl: "https://stub.test/token",
  userUrl: "https://stub.test/user",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("pkce", () => {
  it("challenges with the sha256 of the verifier, base64url", () => {
    const { verifier, challenge } = pkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(verifier).not.toBe(challenge);
    expect(verifier).toMatch(/^[\w-]+$/);
  });

  it("is different every time, as is the state", () => {
    expect(pkce().verifier).not.toBe(pkce().verifier);
    expect(newState()).not.toBe(newState());
  });
});

describe("authorizeUrl", () => {
  const url = new URL(authorizeUrl(config, { redirectUri: "https://snap-hub.test/cb", state: "st", challenge: "ch" }));

  it("asks only for identify", () => {
    expect(url.searchParams.get("scope")).toBe("identify");
  });

  it("carries the client, redirect, state and PKCE challenge", () => {
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("https://snap-hub.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("never puts the client secret in a URL the browser sees", () => {
    expect(url.toString()).not.toContain("secret-1");
  });

  it("leaves prompt alone, so Discord always shows its consent screen", () => {
    expect(url.searchParams.get("prompt")).toBeNull();
  });
});

describe("exchangeCode", () => {
  it("posts the code with the verifier, then reads the profile with the token", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/token")) return json({ access_token: "tok-1" });
      return json({ id: "42", username: "noah", avatar: "abc" });
    });

    const res = await exchangeCode(
      { ...config, fetch: fetchStub as unknown as typeof fetch },
      { code: "code-1", verifier: "ver-1", redirectUri: "https://snap-hub.test/cb" },
    );

    expect(res).toEqual({ ok: true, user: { id: "42", username: "noah", avatar: "abc" } });
    const body = new URLSearchParams(String(calls[0].init?.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier")).toBe("ver-1");
    expect(body.get("client_secret")).toBe("secret-1");
    expect((calls[1].init?.headers as Record<string, string>).authorization).toBe("Bearer tok-1");
  });

  it("gives up when Discord rejects the code", async () => {
    const fetchStub = vi.fn(async () => json({ error: "invalid_grant" }, 400));
    const res = await exchangeCode(
      { ...config, fetch: fetchStub as unknown as typeof fetch },
      { code: "bad", verifier: "v", redirectUri: "r" },
    );
    expect(res).toMatchObject({ ok: false });
  });

  it("gives up when the token response has no token", async () => {
    const fetchStub = vi.fn(async () => json({ token_type: "Bearer" }));
    const res = await exchangeCode(
      { ...config, fetch: fetchStub as unknown as typeof fetch },
      { code: "c", verifier: "v", redirectUri: "r" },
    );
    expect(res).toMatchObject({ ok: false });
  });

  it("gives up when Discord can't be reached at all", async () => {
    const fetchStub = vi.fn(async () => {
      throw new Error("offline");
    });
    const res = await exchangeCode(
      { ...config, fetch: fetchStub as unknown as typeof fetch },
      { code: "c", verifier: "v", redirectUri: "r" },
    );
    expect(res).toEqual({ ok: false, error: "Could not reach Discord" });
  });

  it("falls back when a profile arrives without a usable name or avatar", async () => {
    const fetchStub = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/token") ? json({ access_token: "t" }) : json({ id: "9", username: "", avatar: null }),
    );
    const res = await exchangeCode(
      { ...config, fetch: fetchStub as unknown as typeof fetch },
      { code: "c", verifier: "v", redirectUri: "r" },
    );
    expect(res).toEqual({ ok: true, user: { id: "9", username: "Someone", avatar: null } });
  });
});

describe("urls", () => {
  it("builds the callback the Discord app has to have registered", () => {
    expect(redirectUriFor("https://snap-hub.test")).toBe("https://snap-hub.test/api/auth/discord/callback");
  });

  it("only follows same-site paths after signing in", () => {
    expect(safeReturnTo("/decks")).toBe("/decks");
    expect(safeReturnTo("//evil.com")).toBe("/");
    expect(safeReturnTo("https://evil.com")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
    expect(safeReturnTo("")).toBe("/");
  });

  it("builds an avatar URL only when there is one", () => {
    expect(avatarUrl("42", "abc")).toContain("/avatars/42/abc.png");
    expect(avatarUrl("42", null)).toBeNull();
  });
});
