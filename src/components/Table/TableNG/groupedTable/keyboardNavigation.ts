import { CellPlan } from '../pipelineUtils';

export interface ActiveGroupedCell {
  recordIndex: number;
  fieldDepth: number;
  colIndex: number;
}

export interface GroupedGridDimensions {
  columnCount: number;
  maxDepth: number;
  recordCount: number;
}

export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'home' | 'end';

type OwnedCell = ActiveGroupedCell | null;

function isSameCell(a: OwnedCell, b: OwnedCell): boolean {
  return Boolean(a && b && a.recordIndex === b.recordIndex && a.fieldDepth === b.fieldDepth && a.colIndex === b.colIndex);
}

export function getCellId(cell: ActiveGroupedCell): string {
  return `${cell.recordIndex}:${cell.fieldDepth}:${cell.colIndex}`;
}

export function clampActiveCell(cell: ActiveGroupedCell | null, dimensions: GroupedGridDimensions): ActiveGroupedCell | null {
  if (dimensions.recordCount <= 0 || dimensions.columnCount <= 0 || dimensions.maxDepth <= 0) {
    return null;
  }

  if (!cell) {
    return { recordIndex: 0, fieldDepth: 0, colIndex: 0 };
  }

  return {
    recordIndex: Math.max(0, Math.min(dimensions.recordCount - 1, cell.recordIndex)),
    fieldDepth: Math.max(0, Math.min(dimensions.maxDepth - 1, cell.fieldDepth)),
    colIndex: Math.max(0, Math.min(dimensions.columnCount - 1, cell.colIndex)),
  };
}

export function buildOwnershipMatrix(
  cellPlanByDepth: CellPlan[][],
  dimensions: GroupedGridDimensions
): OwnedCell[][] {
  const totalRows = dimensions.recordCount * dimensions.maxDepth;
  const matrix: OwnedCell[][] = Array.from({ length: totalRows }, () =>
    Array.from({ length: dimensions.columnCount }, () => null)
  );

  for (let recordIndex = 0; recordIndex < dimensions.recordCount; recordIndex++) {
    const rowOffset = recordIndex * dimensions.maxDepth;

    for (let fieldDepth = 0; fieldDepth < dimensions.maxDepth; fieldDepth++) {
      for (const cell of cellPlanByDepth[fieldDepth] ?? []) {
        const owner: ActiveGroupedCell = {
          recordIndex,
          fieldDepth,
          colIndex: cell.colIndex,
        };

        for (let row = fieldDepth; row < Math.min(dimensions.maxDepth, fieldDepth + cell.rowSpan); row++) {
          for (let col = cell.colIndex; col < Math.min(dimensions.columnCount, cell.colIndex + cell.colSpan); col++) {
            matrix[rowOffset + row][col] = owner;
          }
        }
      }
    }
  }

  return matrix;
}

function getOwnerAt(matrix: OwnedCell[][], row: number, col: number): OwnedCell {
  if (row < 0 || col < 0 || row >= matrix.length || col >= (matrix[row]?.length ?? 0)) {
    return null;
  }
  return matrix[row][col];
}

export function moveActiveCell(
  current: ActiveGroupedCell | null,
  direction: NavigationDirection,
  matrix: OwnedCell[][],
  dimensions: GroupedGridDimensions
): ActiveGroupedCell | null {
  const active = clampActiveCell(current, dimensions);
  if (!active) {
    return null;
  }

  const currentRow = active.recordIndex * dimensions.maxDepth + active.fieldDepth;
  const currentCol = active.colIndex;
  const currentOwner = getOwnerAt(matrix, currentRow, currentCol);
  if (!currentOwner) {
    return active;
  }

  if (direction === 'home' || direction === 'end') {
    const step = direction === 'home' ? 1 : -1;
    let col = direction === 'home' ? 0 : dimensions.columnCount - 1;

    while (col >= 0 && col < dimensions.columnCount) {
      const owner = getOwnerAt(matrix, currentRow, col);
      if (owner) {
        return owner;
      }
      col += step;
    }

    return active;
  }

  const rowStep = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const colStep = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  let row = currentRow + rowStep;
  let col = currentCol + colStep;

  while (row >= 0 && row < matrix.length && col >= 0 && col < dimensions.columnCount) {
    const owner = getOwnerAt(matrix, row, col);
    if (owner && !isSameCell(owner, currentOwner)) {
      return owner;
    }
    row += rowStep;
    col += colStep;
  }

  return active;
}

export function moveActiveCellByRecord(
  current: ActiveGroupedCell | null,
  direction: 'up' | 'down',
  matrix: OwnedCell[][],
  dimensions: GroupedGridDimensions
): ActiveGroupedCell | null {
  const active = clampActiveCell(current, dimensions);
  if (!active) {
    return null;
  }

  const targetRecordIndex = active.recordIndex + (direction === 'down' ? 1 : -1);
  if (targetRecordIndex < 0 || targetRecordIndex >= dimensions.recordCount) {
    return active;
  }

  for (let fieldDepth = active.fieldDepth; fieldDepth >= 0; fieldDepth--) {
    const owner = getOwnerAt(matrix, targetRecordIndex * dimensions.maxDepth + fieldDepth, active.colIndex);
    if (owner) {
      return owner;
    }
  }

  for (let fieldDepth = active.fieldDepth + 1; fieldDepth < dimensions.maxDepth; fieldDepth++) {
    const owner = getOwnerAt(matrix, targetRecordIndex * dimensions.maxDepth + fieldDepth, active.colIndex);
    if (owner) {
      return owner;
    }
  }

  return active;
}
