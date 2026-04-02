import { DataFrame, Field } from '@grafana/data';

import { getFilterValueLabel } from './Filter/utils';
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
      const value = getFilterValueLabel(field, field.values[i]);
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
 * - The last field of any column (single- or multi-field) gets
 *   rowSpan = maxFieldDepth - depth so it spans all remaining body sub-rows.
 *   This mirrors the header's rowSpan for the same cell and eliminates the
 *   need for alignment-only placeholder cells.
 * - Consecutive columns that share the same field at a given depth are merged
 *   into one cell via colSpan.
 * - Depths beyond a column's last field are skipped (covered by the rowSpan
 *   of the last field, same as single-field columns were already handled).
 */
export function buildCellPlanByDepth(columns: ColumnInfo[], maxFieldDepth: number): CellPlan[][] {
  const plans: CellPlan[][] = Array.from({ length: maxFieldDepth }, () => []);

  for (let depth = 0; depth < maxFieldDepth; depth++) {
    let colIndex = 0;
    while (colIndex < columns.length) {
      const col = columns[colIndex];

      // Skip columns whose last field already spans this depth via rowSpan.
      // - single-field: rendered at depth=0 with rowSpan=maxFieldDepth, absent at depth > 0.
      // - multi-field: last field spans remaining depths, absent beyond field count.
      if ((col.fields.length === 1 && depth > 0) || depth >= col.fields.length) {
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

      // The last field of a column spans all remaining body sub-rows so its
      // visual extent matches the header rowSpan for the same position.
      const isLastField = depth === col.fields.length - 1;
      const rowSpan = isLastField && maxFieldDepth > depth + 1 ? maxFieldDepth - depth : 1;
      plans[depth].push({ colIndex, fieldKey: key, field, colSpan, rowSpan, isPlaceholder: false });
      colIndex += colSpan;
    }
  }

  return plans;
}
