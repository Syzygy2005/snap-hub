"use client";
import { useState } from "react";
import Link from "next/link";
export function WishlistSharing({initialToken}: {initialToken:string|null}) {
  const [token,setToken]=useState(initialToken),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function change(enabled:boolean) {
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/collection/share",{method:enabled?"POST":"DELETE"});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setToken(data.token);setMessage(enabled?"Wishlist sharing enabled.":"Sharing disabled. The old link no longer works.");
    } catch(error) {setMessage(error instanceof Error?error.message:"Couldn't update sharing.");}
    finally {setBusy(false);}
  }
  return <section aria-labelledby="share-heading" className="mb-8 rounded-xl border border-line bg-surface p-5">
    <h2 id="share-heading" className="font-bold">Share your wishlist</h2>
    <p className="my-3 text-sm text-muted">Anyone with the link can see your display name and Wanted variants. Your Owned list stays private. The link updates as you change your wishlist.</p>
    <div className="flex flex-wrap items-center gap-4">
      {token ? <><Link href={`/wishlists/${token}`} className="text-sm text-accent underline">View shared wishlist</Link><button className="rounded border border-line px-3 py-2 text-sm" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/wishlists/${token}`);setMessage("Wishlist link copied.");}catch{setMessage("Copy unavailable. Open the shared wishlist and copy its address.");}}}>Copy wishlist link</button><button disabled={busy} onClick={()=>change(false)} className="py-2 text-sm underline disabled:opacity-40">Disable sharing</button></>:
      <button disabled={busy} onClick={()=>change(true)} className="rounded bg-accent px-4 py-2 text-sm font-bold text-bg disabled:opacity-40">Enable share link</button>}
    </div><p role="status" className="mt-3 text-sm text-accent">{message}</p>
  </section>;
}
export function CopyComparison() {
  const [message,setMessage]=useState("");
  return <div className="my-4"><button className="rounded border border-line px-4 py-2 text-sm" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setMessage("Comparison link copied.");}catch{setMessage("Copy the address from your browser to share this comparison.");}}}>Copy comparison link</button><p role="status" className="mt-2 text-sm text-muted">{message}</p></div>;
}
