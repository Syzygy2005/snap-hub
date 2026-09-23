"use client";
import { useSyncExternalStore } from "react";
import { parseVariantKey } from "@/lib/wiki/variant-key";
export type Selection={key:string;name:string};
const STORAGE="snaphub:variant-compare",EVENT="snaphub:variant-compare-change";
const empty:Selection[]=[];
let snapshot:Selection[]=empty,lastRaw:string|null=null;
function read() {
  try {
    const raw=sessionStorage.getItem(STORAGE);
    if(raw!==lastRaw){
      lastRaw=raw;
      const parsed:unknown=JSON.parse(raw || "[]");
      snapshot=Array.isArray(parsed)?parsed.filter((v):v is Selection=>!!v&&typeof v.key==="string"&&!!parseVariantKey(v.key)&&typeof v.name==="string"&&v.name.length<=400).filter((v,i,all)=>all.findIndex(other=>other.key===v.key)===i).slice(0,2):empty;
    }
  }catch{/* Storage can be disabled; the in-memory tray still works. */}
  return snapshot;
}
function subscribe(listener:()=>void){window.addEventListener(EVENT,listener);window.addEventListener("storage",listener);return ()=>{window.removeEventListener(EVENT,listener);window.removeEventListener("storage",listener);};}
export function useVariantSelection(){
  const selected=useSyncExternalStore(subscribe,read,()=>empty);
  function setSelected(update:(old:Selection[])=>Selection[]){
    snapshot=update(read());
    try {lastRaw=JSON.stringify(snapshot);sessionStorage.setItem(STORAGE,lastRaw);}catch{}
    window.dispatchEvent(new Event(EVENT));
  }
  return [selected,setSelected] as const;
}
