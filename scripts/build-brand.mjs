// Cuts the web assets out of brand/brand-sheet.png: `node scripts/build-brand.mjs`
// If you get full-resolution logo files later, replace the outputs in public/brand directly.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SHEET = "brand/brand-sheet.png";
const BG = { r: 10, g: 10, b: 15, alpha: 1 }; // #0A0A0F, "Background Dark" from the brand sheet

mkdirSync("public/brand", { recursive: true });

async function raw(region) {
  const { data, info } = await sharp(SHEET).extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

const toPng = ({ data, width, height }) => sharp(data, { raw: { width, height, channels: 4 } }).png();
const maxc = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]);

// Make the dark background around the artwork transparent, leaving dark areas enclosed by the art alone.
function clearOuterBackground(img, threshold = 48) {
  const { data, width, height } = img;
  const outside = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const p = y * width + x;
    if (!outside[p] && maxc(data, p * 4) < threshold) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    if (outside[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % width;
    const y = (p - x) / width;
    const edge =
      (x > 0 && outside[p - 1]) || (x < width - 1 && outside[p + 1]) || (y > 0 && outside[p - width]) || (y < height - 1 && outside[p + width]);
    if (edge) data[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (maxc(data, i) - 20) / 70)));
  }
  return img;
}

// Light text on a dark background: opacity follows brightness.
function keyLightOnDark(img, low = 50, high = 120) {
  const { data } = img;
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.min(1, Math.max(0, (maxc(data, i) - low) / (high - low)));
    data[i + 3] = Math.round(255 * a);
  }
  return img;
}

// Gauntlet icon (from the "Icon Only" tile)
const icon = clearOuterBackground(await raw({ left: 727, top: 445, width: 160, height: 160 }));
await toPng(icon).toFile("public/brand/icon.png");
await toPng(icon).toFile("src/app/icon.png");

const iconPng = await toPng(icon).toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
  .composite([{ input: await sharp(iconPng).resize(152, 152).toBuffer(), gravity: "center" }])
  .png()
  .toFile("src/app/apple-icon.png");

// "SNAP HUB" wordmark without the tagline
const wordmark = keyLightOnDark(await raw({ left: 476, top: 119, width: 460, height: 138 }));
await toPng(wordmark).toFile("public/brand/wordmark.png");

// Desktop banner (the bottom rows of the sheet section are a divider line)
const banner = sharp(SHEET).extract({ left: 0, top: 0, width: 1312, height: 348 });
await banner.clone().webp({ quality: 88 }).toFile("public/brand/banner.webp");

// Link preview image, 1200x630
const bannerForOg = await banner.clone().resize({ width: 1200 }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 4, background: BG } })
  .composite([{ input: bannerForOg, gravity: "center" }])
  .png()
  .toFile("src/app/opengraph-image.png");

console.log("Brand assets written to public/brand and src/app");
