// A crossword grid is stored as a flat boolean array: true is an open
// (fillable) cell, false is a block. Rows are given as strings of '.' and
// '#' because that's the format constructors and puzzle files tend to use.

export class CrosswordGrid {
  readonly width: number;
  readonly height: number;
  private readonly cells: boolean[];

  constructor(rows: string[]) {
    if (rows.length === 0) {
      throw new Error('grid must have at least one row');
    }
    const width = rows[0].length;
    if (width === 0) {
      throw new Error('grid rows must not be empty');
    }
    rows.forEach((row, y) => {
      if (row.length !== width) {
        throw new Error(
          `row ${y} has length ${row.length}, expected ${width} (all rows must match the first row's width)`
        );
      }
    });

    this.width = width;
    this.height = rows.length;
    this.cells = new Array(this.width * this.height);

    rows.forEach((row, y) => {
      for (let x = 0; x < width; x++) {
        const ch = row[x];
        if (ch !== '.' && ch !== '#') {
          throw new Error(
            `unexpected character '${ch}' at row ${y}, column ${x}; use '.' for open cells and '#' for blocks`
          );
        }
        this.cells[y * width + x] = ch === '.';
      }
    });
  }

  isOpen(x: number, y: number): boolean {
    this.assertInBounds(x, y);
    return this.cells[y * this.width + x];
  }

  toRows(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) {
        row += this.cells[y * this.width + x] ? '.' : '#';
      }
      rows.push(row);
    }
    return rows;
  }

  private assertInBounds(x: number, y: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new RangeError(`cell (${x}, ${y}) is outside the ${this.width}x${this.height} grid`);
    }
  }
}

export type Direction = 'across' | 'down';

export interface NumberedEntry {
  number: number;
  x: number;
  y: number;
  direction: Direction;
  length: number;
}

// Standard crossword numbering: walk cells left-to-right, top-to-bottom;
// an open cell gets the next number if it starts an across word and/or a
// down word (a single number can start both).
export function numberGrid(grid: CrosswordGrid): NumberedEntry[] {
  const entries: NumberedEntry[] = [];
  let counter = 0;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isOpen(x, y)) continue;

      const startsAcross =
        (x === 0 || !grid.isOpen(x - 1, y)) && x + 1 < grid.width && grid.isOpen(x + 1, y);
      const startsDown =
        (y === 0 || !grid.isOpen(x, y - 1)) && y + 1 < grid.height && grid.isOpen(x, y + 1);

      if (!startsAcross && !startsDown) continue;

      counter += 1;
      if (startsAcross) {
        entries.push({ number: counter, x, y, direction: 'across', length: runLength(grid, x, y, 1, 0) });
      }
      if (startsDown) {
        entries.push({ number: counter, x, y, direction: 'down', length: runLength(grid, x, y, 0, 1) });
      }
    }
  }

  return entries;
}

function runLength(grid: CrosswordGrid, startX: number, startY: number, dx: number, dy: number): number {
  let length = 0;
  let x = startX;
  let y = startY;
  while (x < grid.width && y < grid.height && grid.isOpen(x, y)) {
    length += 1;
    x += dx;
    y += dy;
  }
  return length;
}

// American-style grids are conventionally symmetric under a 180 degree
// rotation: the block pattern reads the same upside down.
export function hasRotationalSymmetry(grid: CrosswordGrid): boolean {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const mirroredX = grid.width - 1 - x;
      const mirroredY = grid.height - 1 - y;
      if (grid.isOpen(x, y) !== grid.isOpen(mirroredX, mirroredY)) {
        return false;
      }
    }
  }
  return true;
}
