import { CrosswordGrid, NumberedEntry, hasRotationalSymmetry, numberGrid } from './grid';

export interface GridReport {
  width: number;
  height: number;
  openCells: number;
  blockCells: number;
  rotationallySymmetric: boolean;
  entries: NumberedEntry[];
}

export function buildReport(grid: CrosswordGrid): GridReport {
  let openCells = 0;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.isOpen(x, y)) openCells += 1;
    }
  }
  const totalCells = grid.width * grid.height;

  return {
    width: grid.width,
    height: grid.height,
    openCells,
    blockCells: totalCells - openCells,
    rotationallySymmetric: hasRotationalSymmetry(grid),
    entries: numberGrid(grid),
  };
}

export type ReportFormat = 'text' | 'json';

// The two formats exist for two different readers: 'text' for a person
// staring at a terminal, 'json' for anything piping this into another tool
// (a solver, a linter, a build step that checks grids before publishing).
export function formatReport(report: GridReport, format: ReportFormat = 'text'): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }
  return formatReportAsText(report);
}

function formatReportAsText(report: GridReport): string {
  const lines: string[] = [];
  lines.push(`${report.width}x${report.height} grid, ${report.openCells} open cells, ${report.blockCells} blocks`);
  lines.push(`rotational symmetry: ${report.rotationallySymmetric ? 'yes' : 'no'}`);

  const across = report.entries.filter((e) => e.direction === 'across');
  const down = report.entries.filter((e) => e.direction === 'down');

  lines.push('');
  lines.push(`Across (${across.length})`);
  for (const entry of across) {
    lines.push(`  ${entry.number}. (${entry.x}, ${entry.y}) length ${entry.length}`);
  }

  lines.push('');
  lines.push(`Down (${down.length})`);
  for (const entry of down) {
    lines.push(`  ${entry.number}. (${entry.x}, ${entry.y}) length ${entry.length}`);
  }

  return lines.join('\n');
}
