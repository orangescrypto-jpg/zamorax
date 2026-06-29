/**
 * scripts/generate-icons.mjs
 *
 * Generates icon-192.png and icon-512.png from public/icon.svg
 *
 * Run once:
 *   npm install sharp --save-dev
 *   node scripts/generate-icons.mjs
 *
 * Then commit the generated PNGs to public/
 */

import sharp from "sharp"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, "../public")

const sizes = [192, 512]

for (const size of sizes) {
  await sharp(path.join(publicDir, "icon.svg"))
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, `icon-${size}.png`))

  console.log(`✅ Generated icon-${size}.png`)
}

console.log("\n🎉 Done! Commit public/icon-192.png and public/icon-512.png")
