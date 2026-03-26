/**
 * groupHeaderPipeline.ts
 *
 * Pure functions for building the thead structure and column model from a
 * ColumnGroupingSettings configuration.  No React, no side effects.
 *
 * Extracted from TableWithGroupedHeaders.tsx (Этап 1 — архитектурное разделение).
 */

import { DataFrame, Field } from '@grafana/data';

import { ColumnInfo } from '../pipelineUtils';
import { GroupChild, RootGroupItem } from '../types';
import { getDisplayName } from '../utils';
import { HeaderCell } from './groupTypes';

// ─── Private helpers ──────────────────────────────────────────────────────────

function isColumnFilterEnabled(field: Field): boolean {
  return field.config?.filterable === true || field.config?.custom?.filterable === true;
}

function findFieldById(fields: Field[], id: string): Field | undefined {
  return fields.find((f) => f.name === id || getDisplayName(f) === id);
}

// ─── Exported pure helpers ────────────────────────────────────────────────────

/** Returns the number of header rows a GroupItem subtree occupies vertically. */
export function getGroupItemDepth(item: GroupChild): number {
  if (item.type === 'column') {
    return 1;
  }

  if (item.type === 'root-group') {
    if (item.children.length === 0) {
      return 1;
    }
    if (item.orientation === 'vertical') {
      let total = 1;
      for (const child of item.children) {
        total += getGroupItemDepth(child);
      }
      return total;
    } else {
      let maxChild = 0;
      for (const child of item.children) {
        maxChild = Math.max(maxChild, getGroupItemDepth(child));
      }
      return 1 + maxChild;
    }
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return 0;
    }
    if (item.orientation === 'vertical') {
      let total = 0;
      for (const child of item.children) {
        total += getGroupItemDepth(child);
      }
      return total;
    } else {
      let maxChild = 0;
      for (const child of item.children) {
        maxChild = Math.max(maxChild, getGroupItemDepth(child));
      }
      return maxChild;
    }
  }

  return 1;
}

/** Returns the number of table columns a GroupItem subtree occupies horizontally. */
export function getGroupItemColumnCount(item: GroupChild): number {
  if (item.type === 'column') {
    return 1;
  }

  if (item.type === 'root-group') {
    if (item.children.length === 0) {
      return 1;
    }
    if (item.orientation === 'vertical') {
      const hasHorizontalGroup = item.children.some(
        (c) => c.type === 'group-container' && c.orientation === 'horizontal'
      );
      if (hasHorizontalGroup) {
        for (const child of item.children) {
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            return child.children.length;
          }
        }
        return 1;
      }
      return 1;
    } else {
      let total = 1;
      for (const child of item.children) {
        total += getGroupItemColumnCount(child);
      }
      return total;
    }
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return 1;
    }
    if (item.orientation === 'vertical') {
      const hasHorizontalGroup = item.children.some(
        (c) => c.type === 'group-container' && c.orientation === 'horizontal'
      );
      if (hasHorizontalGroup) {
        for (const child of item.children) {
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            return child.children.length;
          }
        }
        return 1;
      }
      return 1;
    } else {
      let total = 0;
      for (const child of item.children) {
        total += getGroupItemColumnCount(child);
      }
      return total;
    }
  }

  return 1;
}

/** Recursively collects all field ID strings from a GroupItem subtree. */
export function getAllColumnsFromGroupItem(item: GroupChild): string[] {
  if (item.type === 'column') {
    return [item.column];
  }
  if (item.type === 'root-group') {
    const cols = [item.column];
    for (const child of item.children) {
      cols.push(...getAllColumnsFromGroupItem(child));
    }
    return cols;
  }
  if (item.type === 'group-container') {
    const cols: string[] = [];
    for (const child of item.children) {
      cols.push(...getAllColumnsFromGroupItem(child));
    }
    return cols;
  }
  return [];
}

// ─── Internal builder helpers (not exported) ──────────────────────────────────

function collectFieldsFromItem(item: GroupChild, fields: Field[]): Field[] {
  const names = getAllColumnsFromGroupItem(item);
  const result: Field[] = [];
  for (const name of names) {
    const f = findFieldById(fields, name);
    if (f) {
      result.push(f);
    }
  }
  return result;
}

/**
 * Recursively adds HeaderCell entries for a child item.
 *
 * @param bottomLevel - exclusive row index this subtree should fill down to.
 *   For the last child in a short vertical branch, bottomLevel === maxDepth so
 *   the rowSpan fills the remaining header rows.
 */
function addChildHeaders(
  item: GroupChild,
  columnIndex: number,
  startLevel: number,
  fields: Field[],
  rows: HeaderCell[][],
  bottomLevel: number
): void {
  if (item.type === 'column') {
    const field = findFieldById(fields, item.column);
    if (field) {
      rows[startLevel].push({
        name: getDisplayName(field),
        colSpan: 1,
        rowSpan: bottomLevel - startLevel,
        level: startLevel,
        columnIndex,
        field,
        isSortable: true,
        isFilterable: isColumnFilterEnabled(field),
      });
    }
    return;
  }

  if (item.type === 'root-group') {
    const field = findFieldById(fields, item.column);
    if (field) {
      rows[startLevel].push({
        name: getDisplayName(field),
        colSpan: 1,
        rowSpan: 1,
        level: startLevel,
        columnIndex,
        field,
        isSortable: false,
        isFilterable: isColumnFilterEnabled(field),
      });
      if (item.orientation === 'vertical' && item.children.length > 0) {
        let currentLevel = startLevel + 1;
        item.children.forEach((child, idx) => {
          const isLast = idx === item.children.length - 1;
          const childBottom = isLast ? bottomLevel : currentLevel + getGroupItemDepth(child);
          addChildHeaders(child, columnIndex, currentLevel, fields, rows, childBottom);
          currentLevel += getGroupItemDepth(child);
        });
      }
    }
    return;
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return;
    }
    if (item.orientation === 'vertical') {
      let currentLevel = startLevel;
      item.children.forEach((child, idx) => {
        const isLast = idx === item.children.length - 1;
        const childBottom = isLast ? bottomLevel : currentLevel + getGroupItemDepth(child);
        addChildHeaders(child, columnIndex, currentLevel, fields, rows, childBottom);
        currentLevel += getGroupItemDepth(child);
      });
    } else {
      let currentColumnIndex = columnIndex;
      for (const child of item.children) {
        addChildHeaders(child, currentColumnIndex, startLevel, fields, rows, bottomLevel);
        currentColumnIndex += getGroupItemColumnCount(child);
      }
    }
  }
}

/**
 * Recursively processes a GroupItem, populating `rows` (HeaderCell matrix) and
 * `columnsList` (data column descriptors).
 *
 * Returns the number of table columns consumed by this item.
 */
function processGroupItem(
  item: GroupChild,
  startColumnIndex: number,
  startLevel: number,
  fields: Field[],
  rows: HeaderCell[][],
  columnsList: ColumnInfo[],
  maxDepth: number
): number {
  const colCount = getGroupItemColumnCount(item);

  if (item.type === 'column') {
    const field = findFieldById(fields, item.column);
    if (!field) {
      return 0;
    }
    rows[startLevel].push({
      name: getDisplayName(field),
      colSpan: 1,
      rowSpan: maxDepth - startLevel,
      level: startLevel,
      columnIndex: startColumnIndex,
      field,
      isSortable: true,
      isFilterable: isColumnFilterEnabled(field),
    });
    columnsList.push({ fields: [field] });
    return 1;
  }

  if (item.type === 'root-group') {
    const field = findFieldById(fields, item.column);
    if (!field) {
      return 0;
    }

    const rowSpan = item.children.length === 0 ? maxDepth - startLevel : 1;
    rows[startLevel].push({
      name: getDisplayName(field),
      colSpan: colCount,
      rowSpan,
      level: startLevel,
      columnIndex: startColumnIndex,
      field,
      isSortable: false,
      isFilterable: isColumnFilterEnabled(field),
    });

    if (item.children.length === 0) {
      columnsList.push({ fields: [field] });
      return 1;
    }

    if (item.orientation === 'vertical') {
      const hasHorizontalGroup = item.children.some(
        (c) => c.type === 'group-container' && c.orientation === 'horizontal'
      );

      if (hasHorizontalGroup) {
        // Count columns from the first horizontal Group child.
        let totalColumns = 0;
        for (const child of item.children) {
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            totalColumns = child.children.length;
            break;
          }
        }
        for (let i = 0; i < totalColumns; i++) {
          columnsList.push({ fields: [field] });
        }
        let currentLevel = startLevel + 1;
        item.children.forEach((child, childIdx) => {
          const isLastChild = childIdx === item.children.length - 1;
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            const grandchildBottom = isLastChild ? maxDepth : currentLevel + 1;
            child.children.forEach((grandchild, idx) => {
              const columnFields = columnsList[startColumnIndex + idx].fields;
              columnFields.push(...collectFieldsFromItem(grandchild, fields));
              addChildHeaders(grandchild, startColumnIndex + idx, currentLevel, fields, rows, grandchildBottom);
            });
            currentLevel += 1;
          } else if (child.type === 'column') {
            for (let i = 0; i < totalColumns; i++) {
              const columnFields = columnsList[startColumnIndex + i].fields;
              columnFields.push(...collectFieldsFromItem(child, fields));
            }
            const childBottom = isLastChild ? maxDepth : currentLevel + 1;
            const childField = findFieldById(fields, child.column);
            if (childField) {
              rows[currentLevel].push({
                name: getDisplayName(childField),
                colSpan: totalColumns,
                rowSpan: childBottom - currentLevel,
                level: currentLevel,
                columnIndex: startColumnIndex,
                field: childField,
                isSortable: true,
                isFilterable: isColumnFilterEnabled(childField),
              });
            }
            currentLevel += 1;
          } else {
            console.warn('Vertical elements after horizontal groups not fully supported');
          }
        });
        return totalColumns;
      } else {
        // Normal vertical: one data column.
        const columnFields: Field[] = [field];
        let currentLevel = startLevel + 1;
        item.children.forEach((child, idx) => {
          columnFields.push(...collectFieldsFromItem(child, fields));
          const isLast = idx === item.children.length - 1;
          const childBottom = isLast ? maxDepth : currentLevel + getGroupItemDepth(child);
          addChildHeaders(child, startColumnIndex, currentLevel, fields, rows, childBottom);
          currentLevel += getGroupItemDepth(child);
        });
        columnsList.push({ fields: columnFields });
        return 1;
      }
    } else {
      // Horizontal root-group: own column + children side-by-side.
      columnsList.push({ fields: [field] });
      let currentColumnIndex = startColumnIndex + 1;
      let totalColumnsAdded = 1;
      for (const child of item.children) {
        const added = processGroupItem(child, currentColumnIndex, startLevel, fields, rows, columnsList, maxDepth);
        currentColumnIndex += added;
        totalColumnsAdded += added;
      }
      return totalColumnsAdded;
    }
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return 0;
    }

    if (item.orientation === 'vertical') {
      // Special case: single horizontal group child.
      if (
        item.children.length === 1 &&
        item.children[0].type === 'group-container' &&
        item.children[0].orientation === 'horizontal'
      ) {
        const hGroup = item.children[0];
        let currentColumnIndex = startColumnIndex;
        for (const child of hGroup.children) {
          const childFields = collectFieldsFromItem(child, fields);
          columnsList.push({ fields: childFields });
          addChildHeaders(child, currentColumnIndex, startLevel, fields, rows, maxDepth);
          currentColumnIndex += getGroupItemColumnCount(child);
        }
        return getGroupItemColumnCount(hGroup);
      }

      // Normal vertical: one data column.
      const columnFields: Field[] = [];
      for (const child of item.children) {
        columnFields.push(...collectFieldsFromItem(child, fields));
      }
      let currentLevel = startLevel;
      item.children.forEach((child, idx) => {
        const isLast = idx === item.children.length - 1;
        const childBottom = isLast ? maxDepth : currentLevel + getGroupItemDepth(child);
        addChildHeaders(child, startColumnIndex, currentLevel, fields, rows, childBottom);
        currentLevel += getGroupItemDepth(child);
      });
      columnsList.push({ fields: columnFields });
      return 1;
    } else {
      // Horizontal group-container: children side-by-side.
      let currentColumnIndex = startColumnIndex;
      let totalColumnsAdded = 0;
      for (const child of item.children) {
        const added = processGroupItem(child, currentColumnIndex, startLevel, fields, rows, columnsList, maxDepth);
        currentColumnIndex += added;
        totalColumnsAdded += added;
      }
      return totalColumnsAdded;
    }
  }

  return 0;
}

// ─── Main exported builder ────────────────────────────────────────────────────

export interface GroupedHeaderStructure {
  headerRows: HeaderCell[][];
  columns: ColumnInfo[];
}

/**
 * Converts a ColumnGroupingSettings.rootGroups tree into:
 * - `headerRows`: a 2-D matrix of HeaderCell for thead rendering;
 * - `columns`: an ordered list of ColumnInfo for tbody rendering.
 *
 * Ungrouped fields appear at their original position in `data.fields`.
 */
export function buildGroupedHeaderStructure(
  data: DataFrame,
  rootGroups: RootGroupItem[]
): GroupedHeaderStructure {
  const { fields } = data;

  // Collect all field identifiers that belong to any group.
  const groupedFieldNames = new Set<string>();
  const fieldToRootGroupMap = new Map<string, RootGroupItem>();

  for (const rootGroup of rootGroups) {
    const fieldIds = getAllColumnsFromGroupItem(rootGroup);
    for (const id of fieldIds) {
      const f = findFieldById(fields, id);
      if (f) {
        groupedFieldNames.add(f.name);
        groupedFieldNames.add(getDisplayName(f));
      } else {
        groupedFieldNames.add(id);
      }
    }
    const rootField = findFieldById(fields, rootGroup.column);
    if (rootField) {
      fieldToRootGroupMap.set(rootField.name, rootGroup);
      fieldToRootGroupMap.set(getDisplayName(rootField), rootGroup);
    } else {
      fieldToRootGroupMap.set(rootGroup.column, rootGroup);
    }
  }

  const maxDepth = Math.max(...rootGroups.map((rg) => getGroupItemDepth(rg)), 1);
  const columnsList: ColumnInfo[] = [];
  const rows: HeaderCell[][] = Array.from({ length: maxDepth }, () => []);
  const processedRootGroups = new Set<RootGroupItem>();

  for (const field of fields) {
    const rootGroup =
      fieldToRootGroupMap.get(field.name) ?? fieldToRootGroupMap.get(getDisplayName(field));

    if (rootGroup && !processedRootGroups.has(rootGroup)) {
      processGroupItem(rootGroup, columnsList.length, 0, fields, rows, columnsList, maxDepth);
      processedRootGroups.add(rootGroup);
    } else if (!groupedFieldNames.has(field.name) && !groupedFieldNames.has(getDisplayName(field))) {
      // Ungrouped field — spans all header rows.
      const columnIndex = columnsList.length;
      rows[0].push({
        name: getDisplayName(field),
        colSpan: 1,
        rowSpan: maxDepth,
        level: 0,
        columnIndex,
        field,
        isSortable: true,
        isFilterable: isColumnFilterEnabled(field),
      });
      columnsList.push({ fields: [field] });
    }
    // Grouped non-root fields are processed as part of their root group — skip.
  }

  return { headerRows: rows, columns: columnsList };
}

/**
 * Builds a simple (ungrouped) single-row header structure.
 * Used when grouping is disabled or has no root groups.
 */
export function buildSimpleHeaderStructure(data: DataFrame): GroupedHeaderStructure {
  const headerRows: HeaderCell[][] = [
    data.fields.map((field, idx) => ({
      name: getDisplayName(field),
      colSpan: 1,
      rowSpan: 1,
      level: 0,
      columnIndex: idx,
      field,
      isSortable: true,
      isFilterable: isColumnFilterEnabled(field),
    })),
  ];
  const columns: ColumnInfo[] = data.fields.map((field) => ({ fields: [field] }));
  return { headerRows, columns };
}
