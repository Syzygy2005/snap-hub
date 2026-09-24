"use client";

import { useState } from "react";

export function CopyButton({
  text,
  label,
  primary = false,
}: {
  text: string;
  label: string;
  primary?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
      className={
        primary
          ? "rounded-lg bg-jade px-4 py-2 text-sm font-semibold text-forest hover:bg-jade-strong"
          : "rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:text-ink"
      }
    >
      {state === "copied" ? "Copied!" : state === "failed" ? "Copy blocked" : label}
    </button>
  );
}
