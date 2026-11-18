// Genera build/icon.png (512x512): una gota de tinta sobre fondo redondeado. Sin dependencias.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const S = 512
const px = Buffer.alloc(S * S * 4)
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v) => Math.max(0, Math.min(1, v))

// Distancia con signo a un rectángulo redondeado (fondo)
function sdRoundRect(x, y, half, r) {
  const qx = Math.abs(x) - half + r, qy = Math.abs(y) - half + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
// Gota: círculo + cono cuyos lados son tangentes al círculo
function sdDrop(x, y) {
  const cy = 60, r = 130, tipY = -200
  const sinA = r / (cy - tipY), cosA = Math.sqrt(1 - sinA * sinA)
  const yT = cy - r * sinA // altura de los puntos de tangencia
  if (y < yT) {
    if (y < tipY) return Math.hypot(x, y - tipY)
    return Math.abs(x) * cosA - (y - tipY) * sinA
  }
  return Math.hypot(x, y - cy) - r
}

for (let j = 0; j < S; j++) {
  for (let i = 0; i < S; i++) {
    const x = i - S / 2 + 0.5, y = j - S / 2 + 0.5
    const bg = clamp(0.5 - sdRoundRect(x, y, 236, 56))
    // Papel de fondo y gota de tinta plana
    const d = clamp(0.5 - sdDrop(x, y))
    const r = lerp(247, 27, d), g = lerp(242, 23, d), b = lerp(231, 18, d)
    const o = (j * S + i) * 4
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = Math.round(bg * 255)
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const v of buf) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6
const raw = Buffer.alloc(S * (S * 4 + 1))
for (let j = 0; j < S; j++) px.copy(raw, j * (S * 4 + 1) + 1, j * S * 4, (j + 1) * S * 4)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(new URL('../build/icon.png', import.meta.url), png)
console.log('build/icon.png creado')
