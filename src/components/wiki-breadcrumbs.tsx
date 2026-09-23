"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIKI_CRUMBS as labels } from "@/lib/wiki/sections";
export function WikiBreadcrumbs() {
  const path=usePathname().split("/").filter(Boolean);
  if(path.length<2)return null;
  return <nav aria-label="Breadcrumb" className="mb-5"><ol className="flex flex-wrap gap-2 text-xs text-muted">{path.map((part,i)=>{let name=part;try{name=decodeURIComponent(part);}catch{}return <li key={i} className="break-all">{i>0 && <span aria-hidden="true" className="mr-2">/</span>}{i===path.length-1?<span aria-current="page">{labels[part] || name}</span>:<Link className="underline" href={"/"+path.slice(0,i+1).join("/")}>{labels[part] || name}</Link>}</li>;})}</ol></nav>;
}
