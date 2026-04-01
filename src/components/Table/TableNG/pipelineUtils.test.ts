import { FieldType } from '@grafana/data';

import { filterIndices, buildCellPlanByDepth, ColumnInfo } from './pipelineUtils';
import { buildGroupedHeaderStructure, buildSimpleHeaderStructure, normalizeRootGroups } from './groupedTable/groupHeaderPipeline';
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

  test('multi-field col shorter than maxFieldDepth: last field has rowSpan, no placeholder', () => {
    // col0: [a, b]  col1: [c]  — maxFieldDepth=2
    // col0's last field (b) at depth=1 gets rowSpan=1 (depth+1 == maxFieldDepth, no span needed).
    // col1 (single-field) gets rowSpan=2 at depth=0, absent at depth=1.
    const columns: ColumnInfo[] = [
      { fields: [makeField('a', []), makeField('b', [])] },
      col('c'),
    ];
    const plans = buildCellPlanByDepth(columns, 2);

    // depth=0: both columns render normally, no placeholder
    expect(plans[0].every((p) => !p.isPlaceholder)).toBe(true);

    // depth=1: col0 → field 'b' (not placeholder), col1 absent (covered by rowSpan)
    expect(plans[1].find((p) => p.colIndex === 0)).toEqual(
      expect.objectContaining({ colIndex: 0, fieldKey: 'b', colSpan: 1, rowSpan: 1, isPlaceholder: false })
    );
    expect(plans[1].find((p) => p.colIndex === 1)).toBeUndefined();
  });

  test('last field of shorter column spans remaining body sub-rows, no placeholder emitted', () => {
    // col0: [a1, a2]  col1: [b1, b2, b3]  col2: [c]  — maxFieldDepth=3
    // col0's last field (a2) at depth=1 gets rowSpan=2 (spans depths 1 and 2).
    // col2 (single-field) gets rowSpan=3 at depth=0.
    // No placeholder is emitted for col0 at depth=2.
    const columns: ColumnInfo[] = [
      { fields: [makeField('a1', []), makeField('a2', [])] },
      { fields: [makeField('b1', []), makeField('b2', []), makeField('b3', [])] },
      col('c'),
    ];
    const plans = buildCellPlanByDepth(columns, 3);

    // col0 at depth=1: a2 with rowSpan=2 (covers depths 1 and 2)
    expect(plans[1].find((p) => p.colIndex === 0)).toEqual(
      expect.objectContaining({ colIndex: 0, fieldKey: 'a2', colSpan: 1, rowSpan: 2, isPlaceholder: false })
    );

    // col0 absent at depth=2 (covered by a2's rowSpan)
    expect(plans[2].find((p) => p.colIndex === 0)).toBeUndefined();

    // col2 absent at depth=1 and depth=2 (covered by rowSpan=3 from depth=0)
    expect(plans[1].find((p) => p.colIndex === 2)).toBeUndefined();
    expect(plans[2].find((p) => p.colIndex === 2)).toBeUndefined();

    // No placeholder anywhere in the plan
    expect(plans.flat().some((p) => p.isPlaceholder)).toBe(false);
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

// ─── buildGroupedHeaderStructure / buildSimpleHeaderStructure ─────────────────

describe('buildGroupedHeaderStructure', () => {
  // Helpers to build RootGroupItem config objects (matching the types used by the pipeline).
  function rootGroup(column: string, children: any[] = [], orientation: 'vertical' | 'horizontal' = 'vertical'): any {
    return { type: 'root-group', column, children, orientation };
  }
  function leafColumn(column: string): any {
    return { type: 'column', column };
  }
  function container(children: any[] = [], orientation: 'vertical' | 'horizontal' = 'vertical'): any {
    return { id: `container-${Math.random()}`, type: 'group-container', orientation, children };
  }

  test('simple header: maxDepth is 1', () => {
    const frame = makeFrame(makeField('a', [1]), makeField('b', [2]));
    const { maxDepth, headerRows, columns } = buildSimpleHeaderStructure(frame);
    expect(maxDepth).toBe(1);
    expect(headerRows).toHaveLength(1);
    expect(columns).toHaveLength(2);
  });

  test('vertical root-group with two column children: maxDepth=3, columns have 3 fields each', () => {
    // root → [child1, child2] in vertical orientation → depth = 1 + 1 + 1 = 3
    const frame = makeFrame(
      makeField('root', []),
      makeField('c1', []),
      makeField('c2', []),
    );
    const config = [rootGroup('root', [leafColumn('c1'), leafColumn('c2')])];
    const { maxDepth, columns, headerRows } = buildGroupedHeaderStructure(frame, config);

    expect(maxDepth).toBe(3);
    expect(headerRows).toHaveLength(3);
    // One vertical column with fields [root, c1, c2]
    expect(columns).toHaveLength(1);
    expect(columns[0].fields.map((f) => f.name)).toEqual(['root', 'c1', 'c2']);
  });

  test('uneven root groups: maxDepth equals deeper group depth', () => {
    // Group A: root → [c1] → depth 2
    // Group B: root → [c2, c3] → depth 3
    // maxDepth should be 3
    const frame = makeFrame(
      makeField('a', []),
      makeField('c1', []),
      makeField('b', []),
      makeField('c2', []),
      makeField('c3', []),
    );
    const config = [
      rootGroup('a', [leafColumn('c1')]),
      rootGroup('b', [leafColumn('c2'), leafColumn('c3')]),
    ];
    const { maxDepth, columns } = buildGroupedHeaderStructure(frame, config);

    expect(maxDepth).toBe(3);
    // Column A has 2 fields [a, c1]; column B has 3 fields [b, c2, c3]
    expect(columns[0].fields).toHaveLength(2);
    expect(columns[1].fields).toHaveLength(3);
  });

  test('header maxDepth and body cellPlan are consistent for uneven groups', () => {
    // Group A depth=2, Group B depth=3 → maxFieldDepth=3 for body plan.
    // Column A's last field (c1) should get rowSpan=2, not a placeholder, in the body plan.
    const frame = makeFrame(
      makeField('a', []),
      makeField('c1', []),
      makeField('b', []),
      makeField('c2', []),
      makeField('c3', []),
    );
    const config = [
      rootGroup('a', [leafColumn('c1')]),
      rootGroup('b', [leafColumn('c2'), leafColumn('c3')]),
    ];
    const { columns, maxDepth } = buildGroupedHeaderStructure(frame, config);
    // maxDepth from the pipeline must equal max(col.fields.length) — the two models must agree.
    expect(maxDepth).toBe(Math.max(...columns.map((c) => c.fields.length), 1));
    const plans = buildCellPlanByDepth(columns, maxDepth);

    // col0 (Group A): depth=0 → 'a' rowSpan=1; depth=1 → 'c1' rowSpan=2; depth=2 → absent
    expect(plans[0].find((p) => p.colIndex === 0)?.fieldKey).toBe('a');
    expect(plans[0].find((p) => p.colIndex === 0)?.rowSpan).toBe(1);
    expect(plans[1].find((p) => p.colIndex === 0)).toEqual(
      expect.objectContaining({ fieldKey: 'c1', rowSpan: 2, isPlaceholder: false })
    );
    expect(plans[2].find((p) => p.colIndex === 0)).toBeUndefined();

    // col1 (Group B): one cell per depth, no placeholder
    expect(plans[0].find((p) => p.colIndex === 1)?.fieldKey).toBe('b');
    expect(plans[1].find((p) => p.colIndex === 1)?.fieldKey).toBe('c2');
    expect(plans[2].find((p) => p.colIndex === 1)?.fieldKey).toBe('c3');
    expect(plans.flat().some((p) => p.isPlaceholder)).toBe(false);
  });

  test('normalizeRootGroups removes hidden leaf columns and recomputes grouped structure', () => {
    const frame = makeFrame(
      makeField('root', []),
      makeField('visibleLeaf', []),
      makeField('hiddenLeaf', []),
      makeField('other', [])
    );
    const visibleFields = [frame.fields[0], frame.fields[1], frame.fields[3]];
    const config = [rootGroup('root', [leafColumn('visibleLeaf'), leafColumn('hiddenLeaf')])];

    const normalized = normalizeRootGroups(config, visibleFields);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual(
      expect.objectContaining({
        type: 'root-group',
        children: [expect.objectContaining({ type: 'column', column: 'visibleLeaf' })],
      })
    );

    const { columns, maxDepth } = buildGroupedHeaderStructure(makeFrame(...visibleFields), normalized);
    expect(maxDepth).toBe(2);
    expect(columns[0].fields.map((f) => f.name)).toEqual(['root', 'visibleLeaf']);
    expect(columns[1].fields.map((f) => f.name)).toEqual(['other']);
  });

  test('normalizeRootGroups keeps visible children when root field is hidden', () => {
    const frame = makeFrame(
      makeField('hiddenRoot', []),
      makeField('childA', []),
      makeField('childB', [])
    );
    const visibleFields = [frame.fields[1], frame.fields[2]];
    const config = [rootGroup('hiddenRoot', [leafColumn('childA'), leafColumn('childB')], 'horizontal')];

    const normalized = normalizeRootGroups(config, visibleFields);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual(
      expect.objectContaining({
        type: 'group-container',
        orientation: 'horizontal',
        children: [
          expect.objectContaining({ type: 'column', column: 'childA' }),
          expect.objectContaining({ type: 'column', column: 'childB' }),
        ],
      })
    );

    const { columns, maxDepth } = buildGroupedHeaderStructure(makeFrame(...visibleFields), normalized);
    expect(maxDepth).toBe(1);
    expect(columns.map((column) => column.fields.map((f) => f.name))).toEqual([['childA'], ['childB']]);
  });

  test('normalizeRootGroups drops empty containers and fully hidden groups', () => {
    const frame = makeFrame(
      makeField('root', []),
      makeField('visibleLeaf', []),
      makeField('hiddenLeaf', [])
    );
    const visibleFields = [frame.fields[1]];
    const config = [
      rootGroup('root', [container([leafColumn('hiddenLeaf')]), leafColumn('visibleLeaf')]),
      rootGroup('alsoHidden', [leafColumn('missingChild')]),
    ];

    const normalized = normalizeRootGroups(config, visibleFields);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual(
      expect.objectContaining({
        type: 'group-container',
        children: [expect.objectContaining({ type: 'column', column: 'visibleLeaf' })],
      })
    );
  });

  test('hidden vertical root preserves the remaining group structure', () => {
    const frame = makeFrame(
      makeField('hiddenRoot', []),
      makeField('childA', []),
      makeField('childB', []),
      makeField('outside', [])
    );
    const visibleFields = [frame.fields[1], frame.fields[2], frame.fields[3]];
    const config = [rootGroup('hiddenRoot', [leafColumn('childA'), leafColumn('childB')], 'vertical')];

    const normalized = normalizeRootGroups(config, visibleFields);
    const { columns, maxDepth } = buildGroupedHeaderStructure(makeFrame(...visibleFields), normalized);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toEqual(
      expect.objectContaining({
        type: 'group-container',
        orientation: 'vertical',
      })
    );
    expect(maxDepth).toBe(2);
    expect(columns.map((column) => column.fields.map((f) => f.name))).toEqual([['childA', 'childB'], ['outside']]);
  });
});
