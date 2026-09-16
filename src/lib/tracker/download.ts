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
        "",
        "REM Double-clicking this from inside the zip makes Windows run it from a temporary",
        "REM folder on its own, without the script beside it. Say so instead of letting",
        "REM PowerShell report a path the person never typed.",
        `if not exist "%~dp0${SCRIPT_NAME}" goto notunpacked`,
        "",
        `powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0${SCRIPT_NAME}" -Site "${opts.site}" -Key "${opts.key}"`,
        "echo.",
        "echo The tracker has stopped. Run this file again to start it back up.",
        "pause",
        "exit /b",
        "",
        ":notunpacked",
        "echo.",
        "echo   Snap Hub tracker",
        "echo.",
        `echo   ${SCRIPT_NAME} is not in this folder, so there is nothing to start.`,
        "echo.",
        "echo   This usually means the zip has not been unpacked yet, and Windows ran",
        "echo   this file from a temporary copy on its own.",
        "echo.",
        "echo   To fix it:",
        "echo     1. Find snap-hub-tracker.zip, usually in your Downloads folder.",
        'echo     2. Right-click it, choose "Extract All", then "Extract".',
        "echo     3. Open the folder that appears and run this file from in there.",
        "echo.",
        "pause",
        "exit /b 1",
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
        "  1. Unpack this zip first. Right-click it, choose \"Extract All\", then \"Extract\".",
        "     Running straight from inside the zip does not work: Windows copies out only",
        "     the one file you clicked and leaves the tracker behind.",
        `  2. Open the folder that appears and double-click "${LAUNCHER_NAME}".`,
        "  3. Leave the window open while you play.",
        "",
        "Keep both files together. Windows may ask whether to run it, because it came from",
        "the internet. Choose Run.",
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
