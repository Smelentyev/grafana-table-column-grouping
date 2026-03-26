import { FieldType } from '@grafana/data';

import { filterIndices, buildCellPlanByDepth, ColumnInfo } from './pipelineUtils';
import { FilterType } from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeField(name: string, values: unknown[], displayName?: string) {
  return {
    name,
    type: FieldType.string,
    values,
    config: {},
    state: displayName ? { displayName } : undefined,
  } as any;
}

function makeFrame(...fields: Array<ReturnType<typeof makeField>>) {
  return { fields, length: fields[0]?.values.length ?? 0 } as any;
}

// ─── filterIndices ─────────────────────────────────────────────────────────────

describe('filterIndices', () => {
  const frame = makeFrame(
    makeField('name', ['alice', 'bob', 'charlie', 'dave']),
    makeField('role', ['admin', 'user', 'admin', 'user'])
  );

  test('returns all indices when filter is empty', () => {
    expect(filterIndices(frame, {})).toEqual([0, 1, 2, 3]);
  });

  test('filters by a single column value', () => {
    const filter: FilterType = {
      role: { filteredSet: new Set(['admin']) },
    };
    expect(filterIndices(frame, filter)).toEqual([0, 2]);
  });

  test('filters by multiple columns (AND semantics)', () => {
    const filter: FilterType = {
      name: { filteredSet: new Set(['alice']) },
      role: { filteredSet: new Set(['admin']) },
    };
    expect(filterIndices(frame, filter)).toEqual([0]);
  });

  test('returns empty array when no rows match', () => {
    const filter: FilterType = {
      role: { filteredSet: new Set(['superadmin']) },
    };
    expect(filterIndices(frame, filter)).toEqual([]);
  });

  test('treats null/undefined values as empty string', () => {
    const f = makeFrame(makeField('val', [null, undefined, 'x']));
    const filter: FilterType = { val: { filteredSet: new Set(['']) } };
    expect(filterIndices(f, filter)).toEqual([0, 1]);
  });

  test('resolves field by displayName when set', () => {
    const field = makeField('internal_id', ['a', 'b', 'c'], 'Label');
    const f = makeFrame(field);
    const filter: FilterType = { Label: { filteredSet: new Set(['b']) } };
    expect(filterIndices(f, filter)).toEqual([1]);
  });

  test('ignores filter entries for unknown field names', () => {
    const filter: FilterType = {
      nonexistent: { filteredSet: new Set(['x']) },
    };
    // unknown field → no rows excluded
    expect(filterIndices(frame, filter)).toEqual([0, 1, 2, 3]);
  });

  test('handles an empty DataFrame', () => {
    const empty = makeFrame(makeField('x', []));
    expect(filterIndices(empty, {})).toEqual([]);
  });
});

// ─── buildCellPlanByDepth ──────────────────────────────────────────────────────

function col(...fieldNames: string[]): ColumnInfo {
  return { fields: fieldNames.map((n) => makeField(n, [])) };
}

describe('buildCellPlanByDepth', () => {
  test('single-depth columns: one plan row, each col maps to its own cell', () => {
    const columns = [col('a'), col('b'), col('c')];
    const plans = buildCellPlanByDepth(columns, 1);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual([
      expect.objectContaining({ colIndex: 0, fieldKey: 'a', colSpan: 1, rowSpan: 1, isPlaceholder: false }),
      expect.objectContaining({ colIndex: 1, fieldKey: 'b', colSpan: 1, rowSpan: 1, isPlaceholder: false }),
      expect.objectContaining({ colIndex: 2, fieldKey: 'c', colSpan: 1, rowSpan: 1, isPlaceholder: false }),
    ]);
  });

  test('single-field column gets rowSpan=maxFieldDepth at depth=0 when mixed depths', () => {
    // col0: 1 field (single-value), col1: 2 fields (multi-value)
    const columns = [col('a'), { fields: [makeField('b1', []), makeField('b2', [])] }];
    const plans = buildCellPlanByDepth(columns, 2);

    // depth 0
    expect(plans[0]).toContainEqual(expect.objectContaining({ colIndex: 0, fieldKey: 'a', colSpan: 1, rowSpan: 2, isPlaceholder: false }));
    expect(plans[0]).toContainEqual(expect.objectContaining({ colIndex: 1, fieldKey: 'b1', colSpan: 1, rowSpan: 1, isPlaceholder: false }));

    // depth 1: col0 skipped (already covered by rowSpan), col1 shows b2
    expect(plans[1]).not.toContainEqual(expect.objectContaining({ colIndex: 0 }));
    expect(plans[1]).toContainEqual(expect.objectContaining({ colIndex: 1, fieldKey: 'b2', colSpan: 1, rowSpan: 1, isPlaceholder: false }));
  });

  test('placeholder cell has isPlaceholder=true; a field named "" is NOT a placeholder', () => {
    // col0: 2 fields, col1: 1 field — at depth=1 col0 needs a placeholder, col1 is covered by rowSpan
    const columns: ColumnInfo[] = [
      { fields: [makeField('a', []), makeField('b', [])] },
      col('c'),
    ];
    const plans = buildCellPlanByDepth(columns, 2);

    // depth=0: both columns render normally
    expect(plans[0].every((p) => !p.isPlaceholder)).toBe(true);

    // No placeholder in this layout since col1 is covered by rowSpan and col0 has depth=2
    // depth=1: col0 → field 'b' (not placeholder), col1 absent
    expect(plans[1].find((p) => p.colIndex === 0)).toEqual(
      expect.objectContaining({ colIndex: 0, fieldKey: 'b', colSpan: 1, rowSpan: 1, isPlaceholder: false })
    );
  });

  test('placeholder emitted for multi-field col shorter than maxFieldDepth', () => {
    // col0: [a1, a2]  col1: [b1, b2, b3]  col2: [c]  — maxFieldDepth=3
    // At depth=2: col0 has no field → placeholder; col2 is covered by rowSpan from depth=0
    const columns: ColumnInfo[] = [
      { fields: [makeField('a1', []), makeField('a2', [])] },
      { fields: [makeField('b1', []), makeField('b2', []), makeField('b3', [])] },
      col('c'),
    ];
    const plans = buildCellPlanByDepth(columns, 3);

    const d2col0 = plans[2].find((p) => p.colIndex === 0);
    expect(d2col0).toEqual(expect.objectContaining({ colIndex: 0, fieldKey: '', colSpan: 1, rowSpan: 1, isPlaceholder: true }));

    // col2 absent at depth=1 and depth=2 (covered by rowSpan)
    expect(plans[1].find((p) => p.colIndex === 2)).toBeUndefined();
    expect(plans[2].find((p) => p.colIndex === 2)).toBeUndefined();
  });

  test('consecutive columns sharing the same field at a depth are merged into colSpan', () => {
    // Two columns both showing field 'shared' at depth 0
    const sharedField = makeField('shared', []);
    const columns: ColumnInfo[] = [
      { fields: [sharedField, makeField('x', [])] },
      { fields: [sharedField, makeField('y', [])] },
    ];
    const plans = buildCellPlanByDepth(columns, 2);

    // depth 0: one merged cell covering both columns
    expect(plans[0]).toEqual([
      expect.objectContaining({ colIndex: 0, fieldKey: 'shared', colSpan: 2, rowSpan: 1, isPlaceholder: false }),
    ]);
    // depth 1: two independent cells
    expect(plans[1]).toEqual([
      expect.objectContaining({ colIndex: 0, fieldKey: 'x', colSpan: 1, rowSpan: 1, isPlaceholder: false }),
      expect.objectContaining({ colIndex: 1, fieldKey: 'y', colSpan: 1, rowSpan: 1, isPlaceholder: false }),
    ]);
  });

  test('short group (depth 1) next to deep group (depth 3)', () => {
    // col0: [a]  col1: [b1,b2,b3]  — maxFieldDepth = 3
    const columns: ColumnInfo[] = [
      col('a'),
      { fields: [makeField('b1', []), makeField('b2', []), makeField('b3', [])] },
    ];
    const plans = buildCellPlanByDepth(columns, 3);

    // col0 must have rowSpan=3 at depth=0 and no entries at depth 1 or 2
    const d0col0 = plans[0].find((p) => p.colIndex === 0);
    expect(d0col0).toEqual(expect.objectContaining({ colIndex: 0, fieldKey: 'a', colSpan: 1, rowSpan: 3, isPlaceholder: false }));
    expect(plans[1].find((p) => p.colIndex === 0)).toBeUndefined();
    expect(plans[2].find((p) => p.colIndex === 0)).toBeUndefined();

    // col1 must have one cell per depth
    expect(plans[0].find((p) => p.colIndex === 1)?.fieldKey).toBe('b1');
    expect(plans[1].find((p) => p.colIndex === 1)?.fieldKey).toBe('b2');
    expect(plans[2].find((p) => p.colIndex === 1)?.fieldKey).toBe('b3');
  });

  test('returns one empty plan array when columns list is empty', () => {
    const plans = buildCellPlanByDepth([], 1);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toEqual([]);
  });

  test('empty root-group (1 field, depth=1) next to deep group (depth=3) — no misalignment', () => {
    // This mirrors the scenario where processGroupItem creates a ColumnInfo with one field
    // for an empty root-group.  The fix in processGroupItem gives it rowSpan=maxDepth-startLevel
    // in the header, but here we verify the body cellPlan is also correct:
    // col0 is a "single-field" column (empty group) → rowSpan=3 at depth=0, absent at 1 and 2.
    // col1 is a 3-field column (deep group) → one cell per depth.
    const columns: ColumnInfo[] = [
      col('emptyGroup'),
      { fields: [makeField('deep1', []), makeField('deep2', []), makeField('deep3', [])] },
    ];
    const plans = buildCellPlanByDepth(columns, 3);

    // Empty-group column: rowSpan=3, no entries at depth > 0
    expect(plans[0].find((p) => p.colIndex === 0)).toEqual(
      expect.objectContaining({ colIndex: 0, fieldKey: 'emptyGroup', colSpan: 1, rowSpan: 3, isPlaceholder: false })
    );
    expect(plans[1].find((p) => p.colIndex === 0)).toBeUndefined();
    expect(plans[2].find((p) => p.colIndex === 0)).toBeUndefined();

    // Deep group: all three depths present, no placeholder needed
    expect(plans[0].find((p) => p.colIndex === 1)?.fieldKey).toBe('deep1');
    expect(plans[1].find((p) => p.colIndex === 1)?.fieldKey).toBe('deep2');
    expect(plans[2].find((p) => p.colIndex === 1)?.fieldKey).toBe('deep3');
    expect(plans.flat().some((p) => p.isPlaceholder)).toBe(false);
  });
});

// ─── sort + pagination contract ───────────────────────────────────────────────
// These tests verify the contract expected by the component:
// filterIndices followed by manual sort must preserve original indices.

describe('filterIndices + sort integration contract', () => {
  test('filtered indices point back to correct original rows', () => {
    // rows: [0:'x', 1:'y', 2:'x', 3:'z']
    const frame = makeFrame(makeField('val', ['x', 'y', 'x', 'z']));
    const filter: FilterType = { val: { filteredSet: new Set(['x']) } };
    const indices = filterIndices(frame, filter);

    // Verify values at those original indices
    const values = indices.map((i) => frame.fields[0].values[i]);
    expect(values).toEqual(['x', 'x']);
  });

  test('after sort, indices still map to original data correctly', () => {
    const frame = makeFrame(makeField('n', [30, 10, 20]));
    const filter: FilterType = {};
    const indices = filterIndices(frame, filter); // [0,1,2]

    // Simulate stable sort by value ascending (what applySort would produce)
    const sorted = [...indices].sort(
      (a, b) => (frame.fields[0].values[a] as number) - (frame.fields[0].values[b] as number)
    );

    expect(sorted).toEqual([1, 2, 0]); // indices pointing to 10, 20, 30
    expect(sorted.map((i) => frame.fields[0].values[i])).toEqual([10, 20, 30]);
  });

  test('page slice of sorted indices renders correct values', () => {
    const frame = makeFrame(makeField('n', [5, 3, 4, 1, 2]));
    const indices = filterIndices(frame, {});

    const sorted = [...indices].sort(
      (a, b) => (frame.fields[0].values[a] as number) - (frame.fields[0].values[b] as number)
    );
    // sorted indices point to values: 1, 2, 3, 4, 5

    const rowsPerPage = 2;
    const page1 = sorted.slice(0, rowsPerPage);
    const page2 = sorted.slice(rowsPerPage, rowsPerPage * 2);

    expect(page1.map((i) => frame.fields[0].values[i])).toEqual([1, 2]);
    expect(page2.map((i) => frame.fields[0].values[i])).toEqual([3, 4]);
  });
});
