import { ImageResponse } from "next/og";
import { BrandGlyph } from "@/components/brand";
export const size = {width:180,height:180};
export const contentType = "image/png";
export default function AppleIcon() { return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#102D29"}}><BrandGlyph size={156}/></div>,size); }
