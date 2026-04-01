import { buildOwnershipMatrix, clampActiveCell, moveActiveCell, moveActiveCellByRecord } from './keyboardNavigation';
import { CellPlan } from '../pipelineUtils';

describe('grouped keyboard navigation', () => {
  const cellPlanByDepth: CellPlan[][] = [
    [
      { colIndex: 0, fieldKey: 'a', colSpan: 1, rowSpan: 2, isPlaceholder: false },
      { colIndex: 1, fieldKey: 'b', colSpan: 1, rowSpan: 1, isPlaceholder: false },
      { colIndex: 2, fieldKey: 'c', colSpan: 1, rowSpan: 1, isPlaceholder: false },
    ],
    [
      { colIndex: 1, fieldKey: 'b2', colSpan: 2, rowSpan: 1, isPlaceholder: false },
    ],
  ];

  const dimensions = { columnCount: 3, maxDepth: 2, recordCount: 2 };

  test('builds an ownership matrix that honors rowSpan and colSpan', () => {
    const matrix = buildOwnershipMatrix(cellPlanByDepth, dimensions);

    expect(matrix[0][0]).toEqual({ recordIndex: 0, fieldDepth: 0, colIndex: 0 });
    expect(matrix[1][0]).toEqual({ recordIndex: 0, fieldDepth: 0, colIndex: 0 });
    expect(matrix[1][1]).toEqual({ recordIndex: 0, fieldDepth: 1, colIndex: 1 });
    expect(matrix[1][2]).toEqual({ recordIndex: 0, fieldDepth: 1, colIndex: 1 });
    expect(matrix[2][0]).toEqual({ recordIndex: 1, fieldDepth: 0, colIndex: 0 });
  });

  test('moves right and down to the next distinct visible cell', () => {
    const matrix = buildOwnershipMatrix(cellPlanByDepth, dimensions);

    expect(moveActiveCell({ recordIndex: 0, fieldDepth: 0, colIndex: 0 }, 'right', matrix, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 0,
      colIndex: 1,
    });

    expect(moveActiveCell({ recordIndex: 0, fieldDepth: 0, colIndex: 1 }, 'down', matrix, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 1,
      colIndex: 1,
    });

    expect(moveActiveCell({ recordIndex: 0, fieldDepth: 0, colIndex: 0 }, 'down', matrix, dimensions)).toEqual({
      recordIndex: 1,
      fieldDepth: 0,
      colIndex: 0,
    });
  });

  test('home and end move within the current visual row', () => {
    const matrix = buildOwnershipMatrix(cellPlanByDepth, dimensions);

    expect(moveActiveCell({ recordIndex: 0, fieldDepth: 1, colIndex: 1 }, 'home', matrix, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 0,
      colIndex: 0,
    });

    expect(moveActiveCell({ recordIndex: 0, fieldDepth: 1, colIndex: 1 }, 'end', matrix, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 1,
      colIndex: 1,
    });
  });

  test('shift up/down can jump to the previous or next logical record', () => {
    const matrix = buildOwnershipMatrix(cellPlanByDepth, dimensions);

    expect(moveActiveCellByRecord({ recordIndex: 0, fieldDepth: 1, colIndex: 1 }, 'down', matrix, dimensions)).toEqual({
      recordIndex: 1,
      fieldDepth: 1,
      colIndex: 1,
    });

    expect(moveActiveCellByRecord({ recordIndex: 1, fieldDepth: 1, colIndex: 2 }, 'up', matrix, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 1,
      colIndex: 1,
    });
  });

  test('clamps the active cell to the current page dimensions', () => {
    expect(clampActiveCell({ recordIndex: 9, fieldDepth: 5, colIndex: 10 }, dimensions)).toEqual({
      recordIndex: 1,
      fieldDepth: 1,
      colIndex: 2,
    });

    expect(clampActiveCell(null, dimensions)).toEqual({
      recordIndex: 0,
      fieldDepth: 0,
      colIndex: 0,
    });
  });
});
