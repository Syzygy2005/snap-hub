import { WikiTabs } from "@/components/wiki-reference";
export default function WikiLayout({children}: {children: React.ReactNode}) { return <section className="wiki"><WikiTabs />{children}</section>; }
