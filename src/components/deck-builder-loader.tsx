"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { DeckBuilder } from "./deck-builder";

// The builder restores drafts from localStorage on first render, so it only renders in the browser.
const Builder = dynamic(() => import("./deck-builder").then((m) => m.DeckBuilder), {
  ssr: false,
  loading: () => (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" aria-busy="true">
      <div className="h-[60vh] animate-pulse rounded-xl border border-line bg-surface/60" />
      <div className="h-[60vh] animate-pulse rounded-xl border border-line bg-surface/60" />
    </div>
  ),
});

export function DeckBuilderLoader(props: ComponentProps<typeof DeckBuilder>) {
  return <Builder {...props} />;
}
