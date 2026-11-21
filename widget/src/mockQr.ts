// Demo-only QR encoder (byte mode, error correction L, versions 1-5, mask 0).
// The real server sends `qr` rows itself; this exists so demo mode can show a
// scannable code for whatever invite link the mock makes up.

const VERSIONS = [
  { version: 1, data: 19, ec: 7 },
  { version: 2, data: 34, ec: 10 },
  { version: 3, data: 55, ec: 15 },
  { version: 4, data: 80, ec: 20 },
  { version: 5, data: 108, ec: 26 },
];

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

/** Rows of '0'/'1' ('1' = dark), or [] when the text is too long for this tiny encoder. */
export function mockQrRows(text: string): string[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = VERSIONS.find((v) => bytes.length + 2 <= v.data);
  if (!spec) return [];

  // Data codewords: mode 0100, 8-bit length, payload, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  const capacity = spec.data * 8;
  push(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  for (let padByte = 0xec; bits.length < capacity; padByte ^= 0xec ^ 0x11) push(padByte, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const codewords = [...data, ...rsRemainder(data, rsDivisor(spec.ec))];

  const size = spec.version * 4 + 17;
  const dark: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, on: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    dark[y][x] = on;
    fn[y][x] = true;
  };

  // Timing patterns, finders (with separators), alignment pattern.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  }
  if (spec.version >= 2) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) set(size - 7 + dx, size - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  // Format information: error correction L (01), mask 0.
  const formatData = (0b01 << 3) | 0;
  let rem = formatData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const format = ((formatData << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((format >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);

  // Zigzag data placement, then mask 0 ((x + y) even) on data modules.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        const on = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
        dark[y][x] = on !== ((x + y) % 2 === 0);
      }
    }
  }

  return dark.map((row) => row.map((d) => (d ? "1" : "0")).join(""));
}
