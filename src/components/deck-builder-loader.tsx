"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "./page-skeleton";
import type { ComponentProps } from "react";
import type { DeckBuilder } from "./deck-builder";

// The builder restores drafts from localStorage on first render, so it only renders in the browser.
const Builder = dynamic(() => import("./deck-builder").then((m) => m.DeckBuilder), {
  ssr: false,
  loading: () => <PageSkeleton shape="builder" label="Loading the deck builder" header={false} />,
});

export function DeckBuilderLoader(props: ComponentProps<typeof DeckBuilder>) {
  return <Builder {...props} />;
}
