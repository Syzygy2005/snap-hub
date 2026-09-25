"use client";
import { useParams } from "next/navigation";
import { PageSkeleton } from "@/components/page-skeleton";
export default function Loading() {
  const { kind } = useParams<{ kind: string }>();
  return <PageSkeleton shape={kind === "cards" || kind === "locations" ? "cards" : "guide"} label="Loading wiki section" />;
}
