import { ImageResponse } from "next/og";
import { BrandGlyph } from "@/components/brand";
import { BRAND } from "@/lib/brand";
export const size = {width:180,height:180};
export const contentType = "image/png";
export default function AppleIcon() { return new ImageResponse(<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:BRAND.cream}}><BrandGlyph size={156} color={BRAND.forest}/></div>,size); }
