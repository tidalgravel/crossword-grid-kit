# crossword-grid-kit

A small library for working with the *structure* of a crossword grid: the
pattern of open cells and blocks, not the letters. It answers the questions
you need before you start filling anything in:

- where do across and down entries start, and how long are they (standard
  crossword numbering)
- does the grid have the conventional 180-degree rotational symmetry
- how many open cells and blocks does it have

There's no solver here, no dictionary, no fill logic. Just the grid shape
and the bookkeeping that everything else (a constructor, a checker, an
export step) tends to need first.

## Install

No package is published yet. Copy `src/` into your project, or add this
repo as a path dependency once it has a build.

## Usage

A grid is built from an array of row strings, `.` for an open cell and `#`
for a block:

```ts
import { CrosswordGrid, buildReport, formatReport } from './src/index';

const grid = new CrosswordGrid([
  '..#..',
  '.....',
  '#...#',
  '.....',
  '..#..',
]);

const report = buildReport(grid);
console.log(formatReport(report)); // human-readable
```

```
5x5 grid, 21 open cells, 4 blocks
rotational symmetry: yes

Across (5)
  1. (0, 0) length 2
  4. (3, 0) length 2
  5. (0, 1) length 5
  ...

Down (5)
  1. (0, 0) length 2
  ...
```

For anything that needs to consume the result programmatically, pass
`'json'` instead:

```ts
console.log(formatReport(report, 'json'));
```

```json
{
  "width": 5,
  "height": 5,
  "openCells": 21,
  "blockCells": 4,
  "rotationallySymmetric": true,
  "entries": [
    { "number": 1, "x": 0, "y": 0, "direction": "across", "length": 2 },
    { "number": 1, "x": 0, "y": 0, "direction": "down", "length": 2 }
  ]
}
```

Same data either way, `buildReport` computes it once; `formatReport` just
picks how to print it.

## Why

Every crossword tool ends up reimplementing grid numbering and symmetry
checks slightly differently, and it's easy to get the "starts a word" rule
wrong at the edges. This is meant to be the one place that logic lives, so
it can be reused by a constructor UI, a validator, or a batch script
without redoing it each time.

## Status

Early skeleton. Grid parsing, numbering, symmetry checking, and the
text/JSON report all work. Not yet covered: reading standard puzzle file
formats (.puz, ipuz), non-rectangular grids, and any kind of fill/solve
logic.

## License

MIT, see LICENSE.
