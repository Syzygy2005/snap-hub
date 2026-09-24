"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SavedVariant, VariantStatus } from "@/lib/wiki/collection";
import { variantKey } from "@/lib/wiki/variant-key";
import { useVariantSelection,type Selection } from "./variant-selection";

type Tools = {
  signedIn: boolean; enabled: boolean; statuses: Record<string,VariantStatus>; busy: string[];
  /** False until a signed-in visitor's saved statuses have arrived. */
  ready: boolean; loadStatuses: ()=>void;
  save: (card:string,id:string,status:VariantStatus|null)=>Promise<void>;
  selected: Selection[]; toggle: (item:Selection)=>void;
};
const Context = createContext<Tools | null>(null);
/**
 * The server message when there is one, else the fallback. A proxy 502 or Next's HTML error
 * page is not JSON, and parsing it threw "Unexpected token '<'" into the status line.
 */
export async function errorMessage(response: Response, fallback: string) {
  try { const body = await response.json(); return typeof body?.error === "string" && body.error ? body.error : fallback; }
  catch { return fallback; }
}

export function VariantToolsProvider({ children, signedIn, enabled }: {children:React.ReactNode;signedIn:boolean;enabled:boolean}) {
  const [statuses,setStatuses] = useState<Record<string,VariantStatus>>({});
  const [ready,setReady] = useState(!signedIn);
  const requested = useRef(false);
  // The buttons stay disabled until this lands (`ready`), so no click can race it.
  const loadStatuses = useCallback(() => {
    if (!signedIn || requested.current) return;
    requested.current = true;
    fetch("/api/collection").then(r => r.ok ? r.json() : []).then((rows: SavedVariant[]) => {
      if (Array.isArray(rows)) setStatuses(Object.fromEntries(rows.map(v=>[variantKey(v.card_id,v.variant_id),v.status])));
      setReady(true);
    }).catch(() => {
      // Better usable than stuck: a save sets a status outright, so acting without the list
      // loses nothing, while leaving every button disabled for the visit would.
      setReady(true);
    });
  }, [signedIn]);
  const [busy,setBusy] = useState<string[]>([]);
  const [selected,setSelected] = useVariantSelection();
  const [message,setMessage] = useState("");
  const router=useRouter();
  const comparing=usePathname()==="/wiki/compare";
  async function save(card:string,id:string,status:VariantStatus|null) {
    const key=variantKey(card,id);setBusy(v=>[...v,key]);setMessage("");
    try {
      const response=await fetch("/api/collection",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({card,variant:id,status})});
      if (!response.ok) throw new Error(await errorMessage(response,"Couldn't save variant."));
      setStatuses(old=>{const next={...old};if(status)next[key]=status;else delete next[key];return next;});
      setMessage(status ? `Variant saved as ${status}.` : "Variant removed from your collection.");router.refresh();
    } catch(error) {setMessage(error instanceof Error ? error.message : "Couldn't save. Please try again.");}
    finally {setBusy(v=>v.filter(k=>k!==key));}
  }
  function toggle(item:Selection) {
    setSelected(old=>old.some(v=>v.key===item.key)?old.filter(v=>v.key!==item.key):old.length<2?[...old,item]:old);
  }
  return <Context.Provider value={{signedIn,enabled,statuses,busy,ready,loadStatuses,save,selected,toggle}}>
    {children}
    <p role="status" className="my-3 text-sm text-accent">{message}</p>
    {selected.length>0 && <aside aria-label="Variant comparison tray" className={(comparing?"mt-6":"fixed inset-x-4 bottom-3 z-30 mx-auto max-w-6xl")+" rounded-xl border border-accent/50 bg-bg p-3 shadow-xl"}>
      <div className="flex flex-wrap items-center gap-3"><strong className="text-sm">Compare {selected.length}/2</strong>
        <span className={comparing?"contents":"hidden sm:contents"}>{selected.map(v=><button key={v.key} onClick={()=>toggle(v)} aria-label={`Remove ${v.name} from comparison`} className="max-w-full truncate rounded border border-line px-3 py-2 text-xs">{v.name} ×</button>)}</span>
        {selected.length===2 && !comparing ? <Link className="rounded bg-jade px-4 py-2 text-sm font-bold text-forest" href={`/wiki/compare?${new URLSearchParams({a:selected[0].key,b:selected[1].key})}`}>Compare artwork →</Link> : selected.length<2 ? <span className="text-xs text-muted">Choose one more variant.</span> : null}
        <button onClick={()=>setSelected(()=>[])} className="text-xs underline">Clear selection</button>
      </div>
    </aside>}
  </Context.Provider>;
}
export function VariantActions({card,id,name,preview=false,missing=false}: {card:string;id:string;name:string;preview?:boolean;missing?:boolean}) {
  const ctx=useContext(Context);
  const load=ctx?.loadStatuses;
  useEffect(()=>{load?.();},[load]);
  if (!ctx) return null;
  // Disabled until the saved statuses arrive, so a click is never decided on a status not yet known.
  const key=variantKey(card,id),status=ctx.statuses[key],chosen=ctx.selected.some(v=>v.key===key),busy=ctx.busy.includes(key)||!ctx.ready;
  const button="min-h-10 rounded border border-line px-2 py-1 text-xs enabled:hover:border-accent aria-pressed:border-accent aria-pressed:text-accent disabled:opacity-40";
  return <div className="mt-3 flex flex-wrap gap-2">
    {!missing && <button type="button" aria-pressed={chosen} disabled={!chosen && ctx.selected.length===2} onClick={()=>ctx.toggle({key,name:`${name} #${id}`})} className={button}>{chosen?"Selected":"Compare"}</button>}
    {ctx.signedIn ? <>
      {!missing && <>{(!preview||status==="owned") && <button type="button" className={button} disabled={busy} aria-pressed={status==="owned"} onClick={()=>ctx.save(card,id,status==="owned"?null:"owned")}>Owned</button>}
        <button type="button" className={button} disabled={busy} aria-pressed={status==="wanted"} onClick={()=>ctx.save(card,id,status==="wanted"?null:"wanted")}>Wanted</button></>}
      {missing && status && <button className={button} disabled={busy} onClick={()=>ctx.save(card,id,null)}>Remove saved variant</button>}
    </> : ctx.enabled && <Link href="/wiki/my-collection" className="py-2 text-xs text-muted underline">Sign in to collect</Link>}
  </div>;
}
export function CopyComparison() {
  const [message,setMessage]=useState("");
  return <div className="my-4"><button className="rounded border border-line px-4 py-2 text-sm" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setMessage("Comparison link copied.");}catch{setMessage("Copy the address from your browser to share this comparison.");}}}>Copy comparison link</button><p role="status" className="mt-2 text-sm text-muted">{message}</p></div>;
}
