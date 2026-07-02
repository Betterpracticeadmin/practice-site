// One-shot: convert the bundled src/assets images to WebP at sane widths.
// Keeps originals untouched; JSX imports are switched to the .webp files.
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const A = path.join(__dirname, 'src', 'assets')

// [file, maxWidth, quality] — hero-action is used full-bleed → widest.
const JOBS = [
  ['engine-v10.jpg', 1600, 74],
  ['engine-porsche.jpg', 1600, 74],
  ['porsche-911-white.jpg', 1600, 76],
  ['rimac-motor.png', 1200, 82],      // logo/contain — keep alpha
  ['hero-action.jpg', 1920, 78],
  ['interior.jpg', 1600, 76],
  ['car-rear.jpg', 1600, 76],
  ['car-front.jpg', 1600, 76],
]

;(async () => {
  let before = 0, after = 0
  for (const [file, width, quality] of JOBS) {
    const src = path.join(A, file)
    const out = path.join(A, file.replace(/\.(jpe?g|png)$/i, '.webp'))
    const inB = fs.statSync(src).size
    await sharp(src)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toFile(out)
    const outB = fs.statSync(out).size
    before += inB; after += outB
    console.log(`${file.padEnd(24)} ${(inB / 1024).toFixed(0).padStart(5)} Ko -> ${(outB / 1024).toFixed(0).padStart(4)} Ko  (${path.basename(out)})`)
  }
  console.log('-'.repeat(56))
  console.log(`TOTAL ${(before / 1024).toFixed(0)} Ko -> ${(after / 1024).toFixed(0)} Ko  (-${(100 - after / before * 100).toFixed(0)}%)`)
})()
