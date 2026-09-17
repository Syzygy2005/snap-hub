import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ui";
import { CHANGELOG } from "@/lib/changelog";
import { formatReleaseDate } from "@/components/changelog-date";

export const metadata: Metadata = { title: "What's new" };

export default function ChangelogPage() {
  return (
    <>
      <PageHeader title="What's new" subtitle="Changes to Snap Hub, newest first." />

      <div className="space-y-6">
        {CHANGELOG.map((release) => (
          <Panel key={release.date} title={formatReleaseDate(release.date)}>
            <ul className="divide-y divide-line/60">
              {release.changes.map((change) => (
                <li key={change.title} className="px-4 py-3">
                  <p className="font-medium">{change.title}</p>
                  {change.detail && <p className="mt-1 text-sm text-muted">{change.detail}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
