import { CrosswordGrid, numberGrid } from './grid';

// Reader and writer for the Across Lite .puz binary format. This library only
// models the block pattern, so on write every open cell gets a placeholder
// solution letter and every clue is empty; on read the letters and clues are
// discarded and only the pattern and the text metadata are kept.

export interface PuzMetadata {
  title?: string;
  author?: string;
  copyright?: string;
  notes?: string;
}

export interface PuzFile extends PuzMetadata {
  grid: CrosswordGrid;
}

const MAGIC = 'ACROSS&DOWN\0';
const VERSION = '1.3\0';
const HEADER_SIZE = 0x34;
const OFFSET_WIDTH = 0x2c;
const PLACEHOLDER = 'X'.charCodeAt(0);
const BLOCK = '.'.charCodeAt(0);
const EMPTY = '-'.charCodeAt(0);

// .puz strings are single-byte; anything outside latin-1 would be silently
// truncated by a plain mask, so substitute '?' instead.
function encodeText(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code <= 0xff ? code : '?'.charCodeAt(0));
  }
  return bytes;
}

function checksum(bytes: ArrayLike<number>, seed: number): number {
  let sum = seed;
  for (let i = 0; i < bytes.length; i++) {
    sum = sum & 1 ? (sum >> 1) | 0x8000 : sum >> 1;
    sum = (sum + (bytes[i] ?? 0)) & 0xffff;
  }
  return sum;
}

// Text fields join the checksum with their terminator, but empty ones are
// skipped entirely; clues never contribute their terminator.
// Every clue we write is empty, so the clues add nothing here.
function textBytes(meta: Required<PuzMetadata>): number[] {
  const bytes: number[] = [];
  for (const field of [meta.title, meta.author, meta.copyright]) {
    if (field.length > 0) bytes.push(...encodeText(field), 0);
  }
  if (meta.notes.length > 0) bytes.push(...encodeText(meta.notes), 0);
  return bytes;
}

export function writePuz(grid: CrosswordGrid, metadata: PuzMetadata = {}): Uint8Array {
  const meta: Required<PuzMetadata> = {
    title: metadata.title ?? '',
    author: metadata.author ?? '',
    copyright: metadata.copyright ?? '',
    notes: metadata.notes ?? '',
  };
  const clueCount = numberGrid(grid).length;
  if (grid.width > 255 || grid.height > 255) {
    throw new RangeError('.puz grids are limited to 255 rows and 255 columns');
  }
  if (clueCount > 0xffff) {
    throw new RangeError('too many entries for .puz');
  }

  const solution: number[] = [];
  const state: number[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const open = grid.isOpen(x, y);
      solution.push(open ? PLACEHOLDER : BLOCK);
      state.push(open ? EMPTY : BLOCK);
    }
  }

  const header = new Uint8Array(HEADER_SIZE);
  const view = new DataView(header.buffer);
  for (let i = 0; i < MAGIC.length; i++) header[0x02 + i] = MAGIC.charCodeAt(i);
  for (let i = 0; i < VERSION.length; i++) header[0x18 + i] = VERSION.charCodeAt(i);
  header[OFFSET_WIDTH] = grid.width;
  header[OFFSET_WIDTH + 1] = grid.height;
  view.setUint16(0x2e, clueCount, true);
  view.setUint16(0x30, 1, true); // puzzle type: normal
  view.setUint16(0x32, 0, true); // solution is not scrambled

  const text = textBytes(meta);
  const cib = checksum(header.subarray(OFFSET_WIDTH, HEADER_SIZE), 0);
  const solutionSum = checksum(solution, 0);
  const stateSum = checksum(state, 0);
  const textSum = checksum(text, 0);

  let overall = checksum(header.subarray(OFFSET_WIDTH, HEADER_SIZE), 0);
  overall = checksum(solution, overall);
  overall = checksum(state, overall);
  overall = checksum(text, overall);

  view.setUint16(0x00, overall, true);
  view.setUint16(0x0e, cib, true);
  const sums = [cib, solutionSum, stateSum, textSum];
  const lowMask = 'ICHE';
  const highMask = 'ATED';
  for (let i = 0; i < 4; i++) {
    header[0x10 + i] = lowMask.charCodeAt(i) ^ ((sums[i] ?? 0) & 0xff);
    header[0x14 + i] = highMask.charCodeAt(i) ^ ((sums[i] ?? 0) >> 8);
  }

  const body: number[] = [...solution, ...state];
  body.push(...encodeText(meta.title), 0);
  body.push(...encodeText(meta.author), 0);
  body.push(...encodeText(meta.copyright), 0);
  for (let i = 0; i < clueCount; i++) body.push(0);
  body.push(...encodeText(meta.notes), 0);

  const out = new Uint8Array(HEADER_SIZE + body.length);
  out.set(header, 0);
  out.set(body, HEADER_SIZE);
  return out;
}

export function readPuz(data: Uint8Array): PuzFile {
  if (data.length < HEADER_SIZE) {
    throw new Error('not a .puz file: too short for a header');
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (data[0x02 + i] !== MAGIC.charCodeAt(i)) {
      throw new Error('not a .puz file: missing ACROSS&DOWN signature');
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint8(OFFSET_WIDTH);
  const height = view.getUint8(OFFSET_WIDTH + 1);
  const clueCount = view.getUint16(0x2e, true);
  if (width === 0 || height === 0) {
    throw new Error('.puz file has a zero-sized grid');
  }

  const cellCount = width * height;
  const solutionStart = HEADER_SIZE;
  const textStart = solutionStart + cellCount * 2;
  if (data.length < textStart) {
    throw new Error('.puz file is truncated: grid data ends early');
  }

  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      row += data[solutionStart + y * width + x] === BLOCK ? '#' : '.';
    }
    rows.push(row);
  }

  let pos = textStart;
  const nextString = (): string => {
    let end = pos;
    while (end < data.length && data[end] !== 0) end += 1;
    if (end >= data.length) {
      throw new Error('.puz file is truncated: unterminated string');
    }
    let s = '';
    for (let i = pos; i < end; i++) s += String.fromCharCode(data[i] ?? 0);
    pos = end + 1;
    return s;
  };

  const title = nextString();
  const author = nextString();
  const copyright = nextString();
  for (let i = 0; i < clueCount; i++) nextString();
  // Notes were added in version 1.3; older files end after the clues.
  const notes = pos < data.length ? nextString() : '';

  return { grid: new CrosswordGrid(rows), title, author, copyright, notes };
}
