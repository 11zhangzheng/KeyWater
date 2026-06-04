import { nativeImage, type NativeImage } from 'electron'
import { deflateSync } from 'node:zlib'

type Rgba = [number, number, number, number]

const ICON_PIXELS = [
  '................',
  '.......DD.......',
  '......DFFD......',
  '.....DFFFFD.....',
  '....DFFFFFFD....',
  '...DFFFFFFFFD...',
  '..DFFFFFFFFFFD..',
  '..DFFLFFFFHFFD..',
  '.DFFLLFFFHHFFFD.',
  '.DFFFFFFFFFFFFD.',
  '.DFFFLFFFFFFFD.',
  '..DFFFFFFFFFFD..',
  '..DFFFFFFFFFFD..',
  '...DFFFFFFFFD...',
  '....DDDDDDDD....',
  '................'
]

const COLORS: Record<string, Rgba> = {
  '.': [0, 0, 0, 0],
  D: [14, 74, 122, 255],
  F: [66, 191, 245, 255],
  L: [171, 244, 255, 255],
  H: [234, 251, 255, 255]
}

const crcTable = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Buffer) => {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)

  return Buffer.concat([length, typeBuffer, data, crc])
}

const encodePng = (width: number, height: number, rgba: Buffer) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  const stride = width * 4
  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    rows.push(Buffer.from([0]))
    rows.push(rgba.subarray(y * stride, (y + 1) * stride))
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

const renderIconPixels = (scale: number) => {
  const sourceSize = ICON_PIXELS.length
  const size = sourceSize * scale
  const buffer = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceY = Math.floor(y / scale)
      const sourceX = Math.floor(x / scale)
      const color = COLORS[ICON_PIXELS[sourceY][sourceX]] ?? COLORS['.']
      const offset = (y * size + x) * 4
      buffer[offset] = color[0]
      buffer[offset + 1] = color[1]
      buffer[offset + 2] = color[2]
      buffer[offset + 3] = color[3]
    }
  }

  return { size, buffer }
}

export const createTrayIcon = (): NativeImage => {
  const { size, buffer } = renderIconPixels(2)
  const image = nativeImage.createFromBuffer(encodePng(size, size, buffer))
  image.setTemplateImage(false)
  return image
}
