/** Must match a redirect URL registered on the Discord application, exactly. */
export function redirectUriFor(origin: string): string {
  return `${origin}/api/auth/discord/callback`;
}

/**
 * Only same-site paths are followed after signing in, so a crafted link can't bounce
 * someone to another site carrying the trust of having just signed in here.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
