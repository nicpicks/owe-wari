#!/usr/bin/env node
// Generates PNG icons from /public/icon.svg using sharp
// Usage: node scripts/generate-icons.js

import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'icon.svg')
const outDir = join(root, 'public', 'icons')

mkdirSync(outDir, { recursive: true })

const svgBuffer = readFileSync(svgPath)

const icons = [
  { name: 'icon-192.png', size: 192, padding: 0 },
  { name: 'icon-512.png', size: 512, padding: 0 },
  { name: 'apple-touch-icon.png', size: 180, padding: 0 },
  // Maskable: symbol sits within the "safe area" (innermost ~80% of the icon)
  // We render the SVG smaller and place it on a dark background
  { name: 'icon-maskable-192.png', size: 192, padding: 0, maskable: true },
]

for (const icon of icons) {
  if (icon.maskable) {
    // For maskable: render SVG at 76% of the output size, centered on dark bg
    const innerSize = Math.round(icon.size * 0.76)
    const offset = Math.round((icon.size - innerSize) / 2)

    const inner = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer()

    await sharp({
      create: {
        width: icon.size,
        height: icon.size,
        channels: 4,
        background: { r: 11, g: 11, b: 11, alpha: 1 },
      },
    })
      .composite([{ input: inner, top: offset, left: offset }])
      .png()
      .toFile(join(outDir, icon.name))

    console.log(`✓ ${icon.name} (${icon.size}×${icon.size}, maskable)`)
  } else {
    await sharp(svgBuffer).resize(icon.size, icon.size).png().toFile(join(outDir, icon.name))
    console.log(`✓ ${icon.name} (${icon.size}×${icon.size})`)
  }
}

console.log('Done — icons written to public/icons/')
