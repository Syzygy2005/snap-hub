import type { Metadata } from "next";
import { MyStats } from "@/components/my-stats";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My Stats" };

export default function MyStatsPage() {
  return (
    <>
      <PageHeader title="My Stats" subtitle="Your tracked games: win rate, cube rate, decks and recent matches." />
      <MyStats />
    </>
  );
}
