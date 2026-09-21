import { ImageResponse } from "next/og";
import { BrandGlyph } from "@/components/brand";
export const size = {width:1200,height:630};
export const contentType = "image/png";
export const alt = "Snap Hub — Build. Track. Compete.";
export default function OpenGraphImage() {
  return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",background:"#102D29",color:"#F3F2E9",padding:64,alignItems:"center",justifyContent:"space-between"}}>
    <div style={{display:"flex",flexDirection:"column",width:740}}><div style={{display:"flex",fontSize:28,color:"#36D6A0",letterSpacing:8}}>SNAP HUB</div><div style={{display:"flex",fontSize:84,fontWeight:800,lineHeight:1.05,marginTop:28}}>Build. Track. Compete.</div><div style={{display:"flex",fontSize:28,color:"#A8D0B5",marginTop:32}}>Your next winning deck starts here.</div><div style={{display:"flex",fontSize:22,marginTop:56,color:"#36D6A0"}}>DECKS / LEADERBOARDS / CARD WIKI</div></div>
    <BrandGlyph size={280}/>
  </div>,size);
}
