import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="pt-10">
      <EmptyState title="Nothing here">
        That page, player or deck doesn&apos;t exist.{" "}
        <Link href="/" className="text-accent hover:underline">
          Back home
        </Link>
      </EmptyState>
    </div>
  );
}
