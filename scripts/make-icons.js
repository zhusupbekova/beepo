// Renders Beepo's happy face into extension/icons/icon{16,32,48,128}.png.
// Zero dependencies: tiny PNG encoder on top of node:zlib.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

await import("../extension/render/sprite.js");
const root = new URL("../extension/", import.meta.url);
const sprites = JSON.parse(readFileSync(new URL("data/sprites.json", root)));
const { grid, palette } = globalThis.BeepoSprite.compose({ sprites }, { mood: "happy" });

// Crop the empty headroom rows so Beepo fills the icon.
const rows = grid.filter((r) => r.some((c) => c !== "."));
const gw = rows[0].length;
const gh = rows.length;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const scale = Math.max(1, Math.floor(size / Math.max(gw, gh)));
  const ox = Math.floor((size - gw * scale) / 2);
  const oy = Math.floor((size - gh * scale) / 2);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - ox) / scale);
      const gy = Math.floor((y - oy) / scale);
      const c = x >= ox && y >= oy && gx < gw && gy < gh ? rows[gy][gx] : ".";
      if (c === "." || !palette[c]) continue;
      const hex = palette[c];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = parseInt(hex.slice(1, 3), 16);
      raw[i + 1] = parseInt(hex.slice(3, 5), 16);
      raw[i + 2] = parseInt(hex.slice(5, 7), 16);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("icons/", root), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`icons/icon${size}.png`, root), png(size));
  console.log(`icons/icon${size}.png`);
}
