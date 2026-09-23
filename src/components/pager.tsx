import Link from "next/link";
import { pageHref, type Filters } from "@/lib/wiki/filter";

/** Previous / Next for a paginated list, keeping the page's filters in both links. */
export function Pager({ base, sp, page, pages, label }: { base: string; sp: Filters; page: number; pages: number; label: string }) {
  return (
    <nav aria-label={label} className="my-8 flex justify-between text-sm text-accent">
      {page > 1 ? <Link href={pageHref(base, sp, page - 1)}>← Previous</Link> : <span />}
      {page < pages && <Link href={pageHref(base, sp, page + 1)}>Next →</Link>}
    </nav>
  );
}
