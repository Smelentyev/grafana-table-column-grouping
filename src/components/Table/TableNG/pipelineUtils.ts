import { DataFrame, Field } from '@grafana/data';

import { FilterType } from './types';

/** Inline copy to avoid importing the heavy utils.ts in tests */
function fieldDisplayName(field: Field): string {
  return field.state?.displayName ?? field.name;
}

/**
 * Returns the indices (into `data`) of rows that pass all active filters.
 * When no filters are active returns [0…N-1] without allocating objects.
 */
export function filterIndices(data: DataFrame, filter: FilterType): number[] {
  if (Object.keys(filter).length === 0) {
    return Array.from({ length: data.length }, (_, i) => i);
  }

  const fieldByName = new Map<string, Field>();
  for (const field of data.fields) {
    fieldByName.set(field.name, field);
    fieldByName.set(fieldDisplayName(field), field);
  }

  const indices: number[] = [];
  for (let i = 0; i < data.length; i++) {
    let match = true;
    for (const [fieldName, filterValue] of Object.entries(filter)) {
      const field = fieldByName.get(fieldName);
      if (!field) {
        continue;
      }
      const value = String(field.values[i] ?? '');
      if (filterValue.filteredSet.size > 0 && !filterValue.filteredSet.has(value)) {
        match = false;
        break;
      }
    }
    if (match) {
      indices.push(i);
    }
  }
  return indices;
}

// ─── CellPlan ────────────────────────────────────────────────────────────────

export interface ColumnInfo {
  fields: Field[];
}

export interface CellPlan {
  colIndex: number;
  /** Display name of the field, or empty string for placeholder cells. */
  fieldKey: string;
  /** Direct reference to the Field object; undefined only for placeholder cells. */
  field?: Field;
  colSpan: number;
  rowSpan: number;
  /** True for alignment-only cells that have no data field at this depth. */
  isPlaceholder: boolean;
}

/**
 * Pre-computes, for each depth level 0…maxFieldDepth-1, the ordered list of
 * cells that must be rendered.  This avoids per-row re-computation during
 * the tbody render loop.
 *
 * Rules:
 * - A single-field column at depth 0 gets rowSpan = maxFieldDepth so that it
 *   spans all sub-rows for that record.
 * - Consecutive columns that share the same field at a given depth are merged
 *   into one cell via colSpan.
 * - A multi-field column that has no field at `depth` emits an entry with
 *   `isPlaceholder: true` to keep column alignment.
 */
export function buildCellPlanByDepth(columns: ColumnInfo[], maxFieldDepth: number): CellPlan[][] {
  const plans: CellPlan[][] = Array.from({ length: maxFieldDepth }, () => []);

  for (let depth = 0; depth < maxFieldDepth; depth++) {
    let colIndex = 0;
    while (colIndex < columns.length) {
      const col = columns[colIndex];

      // Single-field column already rendered at depth=0 with rowSpan; skip deeper levels.
      if (col.fields.length === 1 && depth > 0) {
        colIndex += 1;
        continue;
      }

      if (depth >= col.fields.length) {
        // Multi-field column with no data at this depth → alignment-only placeholder.
        if (col.fields.length > 1) {
          plans[depth].push({ colIndex, fieldKey: '', colSpan: 1, rowSpan: 1, isPlaceholder: true });
        }
        colIndex += 1;
        continue;
      }

      const field = col.fields[depth];
      const key = fieldDisplayName(field);

      // Skip if already rendered by previous column's colSpan.
      if (
        colIndex > 0 &&
        columns[colIndex - 1].fields.length > depth &&
        fieldDisplayName(columns[colIndex - 1].fields[depth]) === key
      ) {
        colIndex += 1;
        continue;
      }

      // Count consecutive columns sharing the same field at this depth.
      let colSpan = 1;
      for (let next = colIndex + 1; next < columns.length; next++) {
        const nextCol = columns[next];
        if (nextCol.fields.length > depth && fieldDisplayName(nextCol.fields[depth]) === key) {
          colSpan += 1;
        } else {
          break;
        }
      }

      const rowSpan = col.fields.length === 1 && maxFieldDepth > 1 && depth === 0 ? maxFieldDepth : 1;
      plans[depth].push({ colIndex, fieldKey: key, field, colSpan, rowSpan, isPlaceholder: false });
      colIndex += colSpan;
    }
  }

  return plans;
}
