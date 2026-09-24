import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/ui";
import { DATA, INSPIRATION, RESEARCH, TOOLS, type Credit } from "@/lib/credits";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Credits" };

export default function CreditsPage() {
  return (
    <>
      <PageHeader
        title="Credits"
        subtitle={`${SITE_NAME} stands on other people's work. Here's everyone it learned from and runs on.`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Inspiration" items={INSPIRATION} />
        <Section title="Data" items={DATA} />
        <Section
          title="Research"
          items={RESEARCH}
          intro={`${SITE_NAME} doesn't copy code from these projects. They showed what data exists and how it's shaped, which saved a lot of guessing.`}
        />
        <Section title="Built with" items={TOOLS} />
      </div>

      <Panel title="Legal" className="mt-6">
        <div className="space-y-2 p-4 text-sm text-muted">
          <p>
            {SITE_NAME} is a non-commercial fan project. It is not affiliated with, endorsed by or sponsored by Marvel, Second
            Dinner or Nuverse.
          </p>
          <p>
            MARVEL SNAP is a trademark of its owners. Marvel characters and all card art are © Marvel.
            Card data and images are shown for reference and belong to their respective owners.
          </p>
          <p>If you own something shown here and want it credited differently or removed, get in touch and it will be fixed.</p>
        </div>
      </Panel>
    </>
  );
}

function Section({ title, items, intro }: { title: string; items: Credit[]; intro?: string }) {
  return (
    <Panel title={title}>
      {intro && <p className="border-b border-line px-4 py-3 text-sm text-muted">{intro}</p>}
      <ul>
        {items.map((c) => (
          <li key={c.url + c.name} className="border-t border-line/60 px-4 py-3 first:border-t-0">
            <a href={c.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-accent">
              {c.name}
            </a>
            {c.by && <span className="text-sm text-faint"> · {c.by}</span>}
            <p className="mt-0.5 text-sm text-muted">{c.note}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
