// Generates build/icon.ico from the design system's own colours, so the icon
// cannot drift from the palette and needs no binary asset in review.
//
//   node scripts/make-icon.mjs
//
// The mark is a forest-green rounded square with a single off-white check:
// legible down to 16 px, where anything more detailed turns to mud.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GREEN = [45, 106, 79]
const CREAM = [250, 249, 247]

const SIZES = [256, 128, 64, 48, 32, 16]
const SAMPLES = 4

/** Distance from a point to a line segment, in normalised units. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Signed distance to a rounded square centred in the unit box. */
function roundedSquareDistance(x, y, half, radius) {
  const dx = Math.abs(x - 0.5) - (half - radius)
  const dy = Math.abs(y - 0.5) - (half - radius)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

/** Coverage of the two shapes at one normalised point, 0..1 each. */
function sample(x, y) {
  const plate = roundedSquareDistance(x, y, 0.5, 0.22) <= 0 ? 1 : 0

  const stroke = 0.075
  const check = Math.min(
    segmentDistance(x, y, 0.31, 0.52, 0.44, 0.66),
    segmentDistance(x, y, 0.44, 0.66, 0.7, 0.36)
  )

  return [plate, check <= stroke ? 1 : 0]
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let plate = 0
      let mark = 0

      // Supersampling keeps the curve and the check edges smooth; the shapes
      // are hard-edged on their own.
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const [p, m] = sample(
            (x + (sx + 0.5) / SAMPLES) / size,
            (y + (sy + 0.5) / SAMPLES) / size
          )
          plate += p
          mark += m
        }
      }

      const total = SAMPLES * SAMPLES
      plate /= total
      mark /= total

      const offset = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(
          GREEN[channel] * (1 - mark) + CREAM[channel] * mark
        )
      }
      pixels[offset + 3] = Math.round(255 * plate)
    }
  }

  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, crc])
}

function png(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // Every scanline gets filter type 0; the images are tiny and flat enough
  // that a smarter filter would not pay for itself.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = header.length + directory.length

  images.forEach(({ size, data }, index) => {
    const entry = index * 16
    // 0 means 256 in an icon directory.
    directory[entry] = size === 256 ? 0 : size
    directory[entry + 1] = size === 256 ? 0 : size
    directory[entry + 2] = 0
    directory[entry + 3] = 0
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(data.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.ico')
mkdirSync(dirname(target), { recursive: true })

const images = SIZES.map((size) => ({ size, data: png(size, render(size)) }))
writeFileSync(target, ico(images))

console.log(`Skrev ${target} (${SIZES.join(', ')} px)`)
