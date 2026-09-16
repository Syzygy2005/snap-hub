import type { ZipEntry } from "./zip";

// Batch files and Notepad both want CRLF, and everything here stays plain ASCII for the
// same reason the tracker script does: Windows PowerShell 5.1 and cmd are fussy about it.
const crlf = (lines: string[]) => lines.join("\r\n") + "\r\n";

export const SCRIPT_NAME = "snaphub-tracker.ps1";
export const LAUNCHER_NAME = "Start Snap Hub Tracker.cmd";

const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

/**
 * The address the tracker should upload to. `request.url` carries whatever address the
 * server itself is bound to, not the one the visitor typed, so a proxy's forwarded headers
 * decide. Anything that isn't a plain scheme and host is ignored rather than written into
 * a quoted batch argument.
 */
export function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  const proto = first(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  const usable = !!host && /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) && /^https?$/.test(proto);
  return usable ? `${proto}://${host}` : url.origin;
}

/** The files the visitor unzips: the tracker, a launcher that already knows their key, and a readme. */
export function trackerBundle(opts: { site: string; key: string; name: string; script: Uint8Array }): ZipEntry[] {
  return [
    { name: SCRIPT_NAME, content: opts.script },
    {
      name: LAUNCHER_NAME,
      content: crlf([
        "@echo off",
        "title Snap Hub tracker",
        "REM This file holds your personal tracker key. Anyone you send it to could upload",
        "REM games as you. If you share it by mistake, make a new key on the Stats page.",
        `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0${SCRIPT_NAME}" -Site "${opts.site}" -Key "${opts.key}"`,
        "echo.",
        "echo The tracker has stopped. Run this file again to start it back up.",
        "pause",
      ]),
    },
    {
      name: "README.txt",
      content: crlf([
        "SNAP HUB TRACKER",
        "",
        `Recording games for: ${opts.name}`,
        "",
        "TO START",
        "  1. Keep both files together in the same folder.",
        `  2. Double-click "${LAUNCHER_NAME}".`,
        "  3. Leave the window open while you play.",
        "",
        "Windows may ask whether to run it, because it came from the internet. Choose Run.",
        "",
        "GOOD TO KNOW",
        "  Only games that finish while the window is open can be recorded. Marvel Snap keeps",
        "  just the most recent game on disk, so earlier ones cannot be added later.",
        "",
        "  The tracker reads the game's files and never changes them.",
        "",
        "  This folder holds your tracker key. Do not send it to anyone. You can delete the key",
        "  and every game it uploaded from the My stats page at any time.",
        "",
        `  Site: ${opts.site}`,
      ]),
    },
  ];
}
