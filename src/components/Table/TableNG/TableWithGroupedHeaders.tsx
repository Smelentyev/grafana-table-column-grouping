import React, { useMemo, useState, useCallback } from 'react';
import { DataFrame, GrafanaTheme2, Field, FieldType } from '@grafana/data';
import { useStyles2, useTheme2, DataLinksContextMenu, Icon, Pagination } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { SortColumn } from 'react-data-grid';
import {
  ColumnGroupingSettings,
  RootGroupItem,
  GroupChild,
  TableNGProps,
  InspectCellProps,
  FilterType,
  TableRow,
} from './types';
import { TableCellInspector } from '../TableCellInspector';
import { TableCellActions } from './components/TableCellActions';
import { Filter } from './Filter/Filter';
import { applySort, getColumnTypes, getDisplayName } from './utils';

interface TableWithGroupedHeadersProps extends TableNGProps {
  columnGrouping: ColumnGroupingSettings;
}

interface HeaderCell {
  name: string;
  colSpan: number;
  rowSpan: number;
  level: number;
  columnIndex: number;
  field?: Field;
  isSortable: boolean;    // Only for leaf headers with field
  isFilterable: boolean;  // Controlled by "Column filter"
}

interface ColumnInfo {
  // Fields to display in this column (main field + subgroup fields)
  fields: Field[];
}

// Helper function to get field type icon
function getFieldTypeIcon(field: Field): string {
  switch (field.type) {
    case FieldType.time:
      return 'clock-nine';
    case FieldType.string:
      return 'font';
    case FieldType.number:
      return 'calculator-alt';
    case FieldType.boolean:
      return 'toggle-on';
    case FieldType.other:
      return 'brackets-curly';
    default:
      return 'question-circle';
  }
}

// Convert DataFrame to TableRow[]
function frameToTableRows(frame: DataFrame): TableRow[] {
  const rows: TableRow[] = [];
  for (let i = 0; i < frame.length; i++) {
    const row: TableRow = { __depth: 0, __index: i };
    frame.fields.forEach(field => {
      row[getDisplayName(field)] = field.values[i];
    });
    rows.push(row);
  }
  return rows;
}

// Convert TableRow[] back to DataFrame
function tableRowsToFrame(rows: TableRow[], originalFrame: DataFrame): DataFrame {
  const newFields = originalFrame.fields.map(field => {
    const values: any[] = [];
    rows.forEach(row => {
      const index = row.__index;
      values.push(field.values[index]);
    });
    return {
      ...field,
      values,
    };
  });

  return {
    ...originalFrame,
    fields: newFields,
    length: rows.length,
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `,
  tableScroll: css`
    overflow: auto;
    flex: 1 1 auto;
    min-height: 0;
  `,
  table: css`
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: ${theme.typography.fontSize}px;
    table-layout: fixed;
  `,
  headerRow: css`
    background-color: ${theme.colors.background.secondary};

    &:first-child th {
      border-top: 1px solid ${theme.colors.border.medium};
    }
  `,
  headerCell: css`
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    text-align: center;
    vertical-align: top;
    font-weight: ${theme.typography.fontWeightMedium};
    border-right: 1px solid ${theme.colors.border.medium};
    border-bottom: 1px solid ${theme.colors.border.medium};
    background-color: ${theme.colors.background.secondary};
    position: sticky;
    z-index: 2;
    box-sizing: border-box;
    position: relative;

    &:first-child {
      border-left: 1px solid ${theme.colors.border.medium};
    }
  `,
  headerCellClickable: css`
    cursor: pointer;
    &:hover {
      background-color: ${theme.colors.action.hover};
    }
  `,
  sortableHeader: css`
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  `,
  headerCellIcon: css`
    margin-left: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
  `,
  resizeHandle: css`
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: col-resize;
    user-select: none;
    z-index: 3;

    &:hover {
      background-color: ${theme.colors.primary.border};
    }
  `,
  resizing: css`
    background-color: ${theme.colors.primary.border};
  `,
  headerCellWrap: css`
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
  `,
  headerCellNoWrap: css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  headerCellContent: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing(0.5)};
  `,
  dataRow: css`
    &:nth-child(even) {
      background-color: ${theme.colors.background.canvas};
    }
    &:hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};
    }
  `,
  dataCell: css`
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border-right: 1px solid ${theme.colors.border.weak};
    border-bottom: 1px solid ${theme.colors.border.weak};
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    text-overflow: ellipsis;

    &:first-child {
      border-left: 1px solid ${theme.colors.border.weak};
    }
  `,
  cellLine: css`
    padding: ${theme.spacing(0.25)} 0;
    min-height: 20px;
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    flex-wrap: wrap;

    &:not(:last-child) {
      border-bottom: 1px solid ${theme.colors.border.weak};
    }

    &:hover > div:last-child {
      opacity: 1;
    }
  `,
  cellLineFilterable: css`
    padding: ${theme.spacing(0.25)} 0;
    min-height: 20px;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    flex-wrap: wrap;

    &:not(:last-child) {
      border-bottom: 1px solid ${theme.colors.border.weak};
    }

    &:hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.canvas, 0.05)};
    }
  `,
  cellWrap: css`
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    flex: 1 1 auto;
    min-width: 0;
  `,
  cellNoWrap: css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1 1 auto;
    min-width: 0;
  `,
  cellActions: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
  `,
  paginationContainer: css`
    align-items: center;
    display: flex;
    justify-content: center;
    padding: ${theme.spacing(1)} ${theme.spacing(1)} 0 ${theme.spacing(1)};
    flex: 0 0 auto;
  `,
  paginationSummary: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    display: flex;
    justify-content: flex-end;
    padding: ${theme.spacing(0, 1, 0, 2)};
  `,
});

// ============================================================
// Helper functions for GroupItem structure
// ============================================================

// Calculate depth of a GroupItem tree
const getGroupItemDepth = (item: GroupChild): number => {
  if (item.type === 'column') {
    return 1; // Column is a leaf, takes 1 level
  }

  if (item.type === 'root-group') {
    if (item.children.length === 0) {
      return 1; // Empty RootGroup takes 1 level
    }

    const orientation = item.orientation;

    if (orientation === 'vertical') {
      // Vertical: RootGroup takes 1 level + children stack below
      let totalDepth = 1; // This RootGroup takes 1 level
      item.children.forEach((child) => {
        totalDepth += getGroupItemDepth(child);
      });
      return totalDepth;
    } else {
      // Horizontal: RootGroup takes 1 level + max child depth
      let maxChildDepth = 0;
      item.children.forEach((child) => {
        const childDepth = getGroupItemDepth(child);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      });
      return 1 + maxChildDepth;
    }
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return 0; // Empty Group takes NO levels (it's just a container)
    }

    const orientation = item.orientation;

    if (orientation === 'vertical') {
      // Vertical: Group has no header, just sum children depths
      let totalDepth = 0; // Group itself takes NO level
      item.children.forEach((child) => {
        totalDepth += getGroupItemDepth(child);
      });
      return totalDepth;
    } else {
      // Horizontal: Group has no header, return max child depth
      let maxChildDepth = 0;
      item.children.forEach((child) => {
        const childDepth = getGroupItemDepth(child);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      });
      return maxChildDepth;
    }
  }

  return 1;
};

// Calculate how many table columns a GroupItem will occupy
const getGroupItemColumnCount = (item: GroupChild): number => {
  if (item.type === 'column') {
    return 1; // Column occupies 1 table column
  }

  if (item.type === 'root-group') {
    if (item.children.length === 0) {
      return 1; // Empty RootGroup occupies 1 column
    }

    const orientation = item.orientation;

    if (orientation === 'vertical') {
      // Check if any children need horizontal layout
      // Only Groups with horizontal orientation trigger horizontal layout
      const hasHorizontalLayout = item.children.some(child => {
        return child.type === 'group-container' && child.orientation === 'horizontal';
      });

      if (hasHorizontalLayout) {
        // Horizontal layout: count columns from first horizontal Group only
        // All horizontal Groups should have same number of children
        // Standalone Columns span across existing columns (don't add new ones)
        for (const child of item.children) {
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            // Return column count from first horizontal Group
            return child.children.length;
          }
        }
        return 1; // Fallback
      } else {
        // Normal vertical: all children fit in 1 column
        return 1;
      }
    } else {
      // Horizontal: RootGroup gets 1 column + sum of all child columns
      let totalColumns = 1; // Count the RootGroup's own column
      item.children.forEach((child) => {
        totalColumns += getGroupItemColumnCount(child);
      });
      return totalColumns;
    }
  }

  if (item.type === 'group-container') {
    if (item.children.length === 0) {
      return 1; // Empty container occupies 1 column
    }

    const orientation = item.orientation;

    if (orientation === 'vertical') {
      // Check if any children need horizontal layout
      // Only Groups with horizontal orientation trigger horizontal layout
      const hasHorizontalLayout = item.children.some(child => {
        return child.type === 'group-container' && child.orientation === 'horizontal';
      });

      if (hasHorizontalLayout) {
        // Horizontal layout: count columns from first horizontal Group only
        // All horizontal Groups should have same number of children
        // Standalone Columns span across existing columns (don't add new ones)
        for (const child of item.children) {
          if (child.type === 'group-container' && child.orientation === 'horizontal') {
            // Return column count from first horizontal Group
            return child.children.length;
          }
        }
        return 1; // Fallback
      } else {
        // Normal vertical: all children fit in 1 column
        return 1;
      }
    } else {
      // Horizontal: sum of all child columns
      let totalColumns = 0;
      item.children.forEach((child) => {
        totalColumns += getGroupItemColumnCount(child);
      });
      return totalColumns;
    }
  }

  return 1;
};

// Collect all column names from a GroupItem tree
const getAllColumnsFromGroupItem = (item: GroupChild): string[] => {
  if (item.type === 'column') {
    return [item.column];
  }

  if (item.type === 'root-group') {
    const columns = [item.column];
    item.children.forEach((child) => {
      columns.push(...getAllColumnsFromGroupItem(child));
    });
    return columns;
  }

  if (item.type === 'group-container') {
    const columns: string[] = [];
    item.children.forEach((child) => {
      columns.push(...getAllColumnsFromGroupItem(child));
    });
    return columns;
  }

  return [];
};

export const TableWithGroupedHeaders: React.FC<TableWithGroupedHeadersProps> = (props) => {
  const { data, columnGrouping, height, noHeader, onCellFilterAdded, onColumnResize, showTypeIcons, enablePagination } = props;
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);

  const isColumnFilterEnabled = useCallback((field: Field) => {
    return field.config?.filterable === true || field.config?.custom?.filterable === true;
  }, []);

  const hasHeader = !noHeader;

  const fieldMatchesId = useCallback((field: Field, id: string) => field.name === id || getDisplayName(field) === id, []);
  const findFieldById = useCallback((fields: Field[], id: string) => fields.find((f) => fieldMatchesId(f, id)), [fieldMatchesId]);

  // State for sorting
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);

  // State for filtering
  const [filter, setFilter] = useState<FilterType>({});
  const crossFilterOrder = useMemo(() => Object.keys(filter), [filter]);

  // State for header filters (column -> Set of selected values)
  // TODO: Implement header filters functionality
  // const [headerFilters] = useState<Map<string, Set<any>>>(new Map());

  // State for column resizing
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  const [resizeStartWidth, setResizeStartWidth] = useState<number>(0);

  // Create tableRows for filtering
  const tableRows = useMemo((): TableRow[] => {
    const rows: TableRow[] = [];
    for (let i = 0; i < data.length; i++) {
      const row: TableRow = { __depth: 0, __index: i };
      data.fields.forEach(field => {
        row[getDisplayName(field)] = field.values[i];
      });
      rows.push(row);
    }
    return rows;
  }, [data]);

  // Calculate cross-filtered rows for filter component
  const crossFilterRows = useMemo(() => {
    const result: { [key: string]: TableRow[] } = {};

    // Incremental filtering to avoid O(K^2 * N) behavior when multiple filters are applied.
    let prefixRows = tableRows;
    for (const fieldName of crossFilterOrder) {
      const filterValue = filter[fieldName];
      if (filterValue?.filteredSet?.size) {
        prefixRows = prefixRows.filter((row) => filterValue.filteredSet.has(String(row[fieldName] ?? '')));
      }
      result[fieldName] = prefixRows;
    }

    return result;
  }, [tableRows, filter, crossFilterOrder]);

  // Handler for sorting
  const handleHeaderClick = useCallback((cell: HeaderCell) => {
    if (!cell.field || !cell.isSortable) {
      return;
    }

    const fieldName = getDisplayName(cell.field);
    setSortColumns(prev => {
      const existing = prev.find(sc => sc.columnKey === fieldName);
      if (!existing) {
        return [{ columnKey: fieldName, direction: 'ASC' }];
      }
      if (existing.direction === 'ASC') {
        return [{ columnKey: fieldName, direction: 'DESC' }];
      }
      return [];
    });
  }, []);

  // Handlers for column resizing
  const handleResizeStart = (columnIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const headerCell = (event.target as HTMLElement).parentElement;
    if (!headerCell) {
      return;
    }

    const currentWidth = headerCell.offsetWidth;
    setResizingColumn(columnIndex);
    setResizeStartX(event.clientX);
    setResizeStartWidth(currentWidth);
  };

  const handleResizeMove = React.useCallback((event: MouseEvent) => {
    if (resizingColumn === null) {
      return;
    }

    const deltaX = event.clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + deltaX);

    setColumnWidths((prev) => {
      const newWidths = new Map(prev);
      newWidths.set(resizingColumn, newWidth);
      return newWidths;
    });
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeEnd = React.useCallback(() => {
    if (resizingColumn !== null && onColumnResize && columns) {
      const newWidth = columnWidths.get(resizingColumn);
      if (newWidth) {
        // Find the field name for this column
        const column = columns[resizingColumn];
        if (column && column.fields.length > 0) {
          onColumnResize(column.fields[0].name, newWidth);
        }
      }
    }
    setResizingColumn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingColumn, columnWidths, onColumnResize]);

  // Add event listeners for resize
  React.useEffect(() => {
    if (resizingColumn !== null) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingColumn, resizeStartX, resizeStartWidth, columnWidths]);

  // Process new GroupItem structure
  const processNewGroupStructure = (
    originalData: DataFrame,
    rootGroups: RootGroupItem[]
  ): { headerRows: HeaderCell[][]; columns: ColumnInfo[] } => {
    // Collect all field names that are in groups and map field -> rootGroup
    const groupedFieldNames = new Set<string>();
    const fieldToRootGroupMap = new Map<string, RootGroupItem>();

    rootGroups.forEach((rootGroup) => {
      const fieldNames = getAllColumnsFromGroupItem(rootGroup);

      for (const id of fieldNames) {
        const field = findFieldById(originalData.fields, id);
        if (field) {
          groupedFieldNames.add(field.name);
          groupedFieldNames.add(getDisplayName(field));
        } else {
          groupedFieldNames.add(id);
        }
      }

      // Map the ROOT field (the main column of RootGroup) to the RootGroup (by both name and display name).
      const rootField = findFieldById(originalData.fields, rootGroup.column);
      if (rootField) {
        fieldToRootGroupMap.set(rootField.name, rootGroup);
        fieldToRootGroupMap.set(getDisplayName(rootField), rootGroup);
      } else {
        fieldToRootGroupMap.set(rootGroup.column, rootGroup);
      }
    });

    // Calculate max depth
    const maxDepth = Math.max(...rootGroups.map((rg) => getGroupItemDepth(rg)), 1);

    // Initialize column list and header rows
    const columnsList: ColumnInfo[] = [];
    const rows: HeaderCell[][] = Array.from({ length: maxDepth }, () => []);

    // Track which root groups have been processed
    const processedRootGroups = new Set<RootGroupItem>();

    // Process fields in original order
    originalData.fields.forEach((field) => {
      const rootGroup = fieldToRootGroupMap.get(field.name) ?? fieldToRootGroupMap.get(getDisplayName(field));

      if (rootGroup && !processedRootGroups.has(rootGroup)) {
        // This field is the main column of a RootGroup - process the entire group
        const startColumnIndex = columnsList.length;
        processGroupItem(rootGroup, startColumnIndex, 0, originalData, rows, columnsList);
        processedRootGroups.add(rootGroup);
      } else if (!groupedFieldNames.has(field.name) && !groupedFieldNames.has(getDisplayName(field))) {
        // This is an ungrouped field - add it at its original position
        const columnIndex = columnsList.length;

        // Add header with rowSpan = maxDepth to span all header rows
        const isFilterable = isColumnFilterEnabled(field);
        rows[0].push({
          name: getDisplayName(field),
          colSpan: 1,
          rowSpan: maxDepth,
          level: 0,
          columnIndex: columnIndex,
          field: field,
          isSortable: true, // Ungrouped fields are sortable
          isFilterable: isFilterable,
        });

        // Add data column
        columnsList.push({
          fields: [field],
        });
      }
      // If it's a grouped field but not the root field, skip it (already processed as part of group)
    });

    return { headerRows: rows, columns: columnsList };
  };

  // Recursively process a GroupItem
  const processGroupItem = (
    item: GroupChild,
    startColumnIndex: number,
    startLevel: number,
    originalData: DataFrame,
    rows: HeaderCell[][],
    columnsList: ColumnInfo[]
  ): number => {
    // Number of columns this item will occupy
    const colCount = getGroupItemColumnCount(item);

    if (item.type === 'column') {
      // Column item - create header and data column
      const field = findFieldById(originalData.fields, item.column);
      if (!field) {
        return 0;
      }

      // Add header
      rows[startLevel].push({
        name: getDisplayName(field),
        colSpan: 1,
        rowSpan: 1,
        level: startLevel,
        columnIndex: startColumnIndex,
        field: field,
        isSortable: true, // Leaf column is sortable
        isFilterable: isColumnFilterEnabled(field),
      });

      // Add data column
      columnsList.push({
        fields: [field],
      });

      return 1;
    }

    if (item.type === 'root-group') {
      // Root group - has a column field
      const field = findFieldById(originalData.fields, item.column);
      if (!field) {
        return 0;
      }

      // Add header for root group
      // RootGroup headers are filterable only if "Column filter" is enabled for the field
      const isFilterable = isColumnFilterEnabled(field);
      rows[startLevel].push({
        name: getDisplayName(field),
        colSpan: colCount,
        rowSpan: 1,
        level: startLevel,
        columnIndex: startColumnIndex,
        field: field,
        isSortable: false, // Group headers are not sortable
        isFilterable: isFilterable,
      });

      if (item.children.length === 0) {
        // No children - create one data column with just this field
        columnsList.push({
          fields: [field],
        });
        return 1;
      }

      const orientation = item.orientation;

      if (orientation === 'vertical') {
        // Check if any children are horizontal Groups
        const hasHorizontalGroup = item.children.some(child => {
          return child.type === 'group-container' && child.orientation === 'horizontal';
        });

        if (hasHorizontalGroup) {
          // Special case: vertical RootGroup with horizontal Group children
          // First, count total columns needed (from first horizontal Group)
          let totalColumns = 0;
          for (const child of item.children) {
            if (child.type === 'group-container' && child.orientation === 'horizontal') {
              totalColumns = child.children.length;
              break; // All horizontal Groups should have same number of children
            }
          }

          // Create columns and initialize with RootGroup field
          for (let i = 0; i < totalColumns; i++) {
            columnsList.push({ fields: [field] });
          }

          let currentLevel = startLevel + 1;

          // Process all children sequentially (vertical stacking)
          item.children.forEach((child) => {
            if (child.type === 'group-container' && child.orientation === 'horizontal') {
              // Horizontal Group: add headers and fields for each grandchild at current level
              child.children.forEach((grandchild, idx) => {
                // Add grandchild fields to corresponding column
                const columnFields = columnsList[startColumnIndex + idx].fields;
                const childFields = collectFieldsFromItem(grandchild, originalData);
                columnFields.push(...childFields);

                // Add header for grandchild
                addChildHeaders(grandchild, startColumnIndex + idx, currentLevel, originalData, rows);
              });
              currentLevel += 1;
            } else if (child.type === 'column') {
              // Standalone Column: spans across all columns
              // Add Column field to all columns
              for (let i = 0; i < totalColumns; i++) {
                const columnFields = columnsList[startColumnIndex + i].fields;
                const childFields = collectFieldsFromItem(child, originalData);
                columnFields.push(...childFields);
              }

              // Add header with colspan
              const childField = findFieldById(originalData.fields, child.column);
              if (childField) {
                rows[currentLevel].push({
                  name: getDisplayName(childField),
                  colSpan: totalColumns,
                  rowSpan: 1,
                  level: currentLevel,
                  columnIndex: startColumnIndex,
                  field: childField,
                  isSortable: true,
                  isFilterable: isColumnFilterEnabled(childField),
                });
              }
              currentLevel += 1;
            } else {
              // Vertical elements (nested RootGroup/Group) - not supported in this mode
              console.warn('Vertical elements after horizontal groups not fully supported');
            }
          });

          return totalColumns;
        } else {
          // Normal vertical case: all children stack in ONE column
          const columnFields: Field[] = [field];

          // Process children vertically
          let currentLevel = startLevel + 1;
          item.children.forEach((child) => {
            const childFields = collectFieldsFromItem(child, originalData);
            columnFields.push(...childFields);

            // Add child headers
            addChildHeaders(child, startColumnIndex, currentLevel, originalData, rows);

            // Move to next level
            currentLevel += getGroupItemDepth(child);
          });

          // Create one data column
          columnsList.push({
            fields: columnFields,
          });

          return 1;
        }
      } else {
        // Horizontal: RootGroup field gets its own column, then children are added horizontally
        // All children should be on the SAME level as RootGroup

        // First, add the RootGroup's own field as a column
        columnsList.push({
          fields: [field],
        });

        let currentColumnIndex = startColumnIndex + 1; // Start after the RootGroup column
        let totalColumnsAdded = 1; // Count the RootGroup column

        item.children.forEach((child) => {
          const columnsAdded = processGroupItem(
            child,
            currentColumnIndex,
            startLevel, // FIXED: Use startLevel (not startLevel + 1) - children on same level
            originalData,
            rows,
            columnsList
          );
          currentColumnIndex += columnsAdded;
          totalColumnsAdded += columnsAdded;
        });

        return totalColumnsAdded;
      }
    }

    if (item.type === 'group-container') {
      // Group container - no column field, just contains children
      if (item.children.length === 0) {
        return 0; // Empty group ignored
      }

      const orientation = item.orientation;

      if (orientation === 'vertical') {
        // Check for special case: single horizontal Group child
        if (item.children.length === 1 &&
            item.children[0].type === 'group-container' &&
            item.children[0].orientation === 'horizontal') {
          // Special case: vertical Group with horizontal Group child
          // Each grandchild gets its own column
          const horizontalGroup = item.children[0];

          let currentColumnIndex = startColumnIndex;

          horizontalGroup.children.forEach((child) => {
            // Each grandchild creates its own column
            const childFields = collectFieldsFromItem(child, originalData);

            // Add data column
            columnsList.push({
              fields: childFields,
            });

            // Add child headers
            addChildHeaders(child, currentColumnIndex, startLevel, originalData, rows);

            currentColumnIndex += getGroupItemColumnCount(child);
          });

          return getGroupItemColumnCount(horizontalGroup);
        }

        // Normal vertical case: all children stack in ONE column
        const columnFields: Field[] = [];

        // Collect all fields from children
        item.children.forEach((child) => {
          const childFields = collectFieldsFromItem(child, originalData);
          columnFields.push(...childFields);
        });

        // Add child headers vertically
        let currentLevel = startLevel;
        item.children.forEach((child) => {
          addChildHeaders(child, startColumnIndex, currentLevel, originalData, rows);
          currentLevel += getGroupItemDepth(child);
        });

        // Create one data column
        columnsList.push({
          fields: columnFields,
        });

        return 1;
      } else {
        // Horizontal: children create multiple columns
        let currentColumnIndex = startColumnIndex;
        let totalColumnsAdded = 0;

        item.children.forEach((child) => {
          const columnsAdded = processGroupItem(
            child,
            currentColumnIndex,
            startLevel,
            originalData,
            rows,
            columnsList
          );
          currentColumnIndex += columnsAdded;
          totalColumnsAdded += columnsAdded;
        });

        return totalColumnsAdded;
      }
    }

    return 0;
  };

  // Helper to collect all fields from an item
  const collectFieldsFromItem = (item: GroupChild, originalData: DataFrame): Field[] => {
    const fieldNames = getAllColumnsFromGroupItem(item);
    const fields: Field[] = [];

    fieldNames.forEach((fieldName) => {
      const field = findFieldById(originalData.fields, fieldName);
      if (field) {
        fields.push(field);
      }
    });

    return fields;
  };

  // Helper to add headers for a child item
  const addChildHeaders = (
    item: GroupChild,
    columnIndex: number,
    startLevel: number,
    originalData: DataFrame,
    rows: HeaderCell[][]
  ) => {
    if (item.type === 'column') {
      const field = findFieldById(originalData.fields, item.column);
      if (field) {
        rows[startLevel].push({
          name: getDisplayName(field),
          colSpan: 1,
          rowSpan: 1,
          level: startLevel,
          columnIndex: columnIndex,
          field: field,
          isSortable: true, // Leaf column is sortable
          isFilterable: isColumnFilterEnabled(field),
        });
      }
    } else if (item.type === 'root-group') {
      const field = findFieldById(originalData.fields, item.column);
      if (field) {
        rows[startLevel].push({
          name: getDisplayName(field),
          colSpan: 1,
          rowSpan: 1,
          level: startLevel,
          columnIndex: columnIndex,
          field: field,
          isSortable: false, // Group headers are not sortable
          isFilterable: isColumnFilterEnabled(field),
        });

        // Add children headers if vertical
        if (item.orientation === 'vertical' && item.children.length > 0) {
          let currentLevel = startLevel + 1;
          item.children.forEach((child) => {
            addChildHeaders(child, columnIndex, currentLevel, originalData, rows);
            currentLevel += getGroupItemDepth(child);
          });
        }
      }
    } else if (item.type === 'group-container') {
      // Group has no header itself, just process children
      if (item.children.length === 0) {
        return;
      }

      if (item.orientation === 'vertical') {
        // Vertical: children stack in the same column
        let currentLevel = startLevel;
        item.children.forEach((child) => {
          addChildHeaders(child, columnIndex, currentLevel, originalData, rows);
          currentLevel += getGroupItemDepth(child);
        });
      } else {
        // Horizontal: children are in different columns
        let currentColumnIndex = columnIndex;
        item.children.forEach((child) => {
          addChildHeaders(child, currentColumnIndex, startLevel, originalData, rows);
          currentColumnIndex += getGroupItemColumnCount(child);
        });
      }
    }
  };

  // Apply filtering and sorting to data
  const filteredAndSortedData = useMemo(() => {
    let result = data;
    const fieldByDisplayName = new Map<string, Field>();
    for (const field of data.fields) {
      fieldByDisplayName.set(getDisplayName(field), field);
      fieldByDisplayName.set(field.name, field);
    }

    // Apply filter
    if (Object.keys(filter).length > 0) {
      const rowIndices: number[] = [];

      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        let matchesAllFilters = true;

        for (const [fieldName, filterValue] of Object.entries(filter)) {
          const field = fieldByDisplayName.get(fieldName);
          if (!field) {
            continue;
          }

          const value = String(field.values[rowIndex] ?? '');

          if (filterValue.filteredSet.size > 0 && !filterValue.filteredSet.has(value)) {
            matchesAllFilters = false;
            break;
          }
        }

        if (matchesAllFilters) {
          rowIndices.push(rowIndex);
        }
      }

      // Create filtered frame
      const filteredFields = data.fields.map((field) => ({
        ...field,
        values: rowIndices.map((i) => field.values[i]),
      }));

      result = {
        ...data,
        fields: filteredFields,
        length: rowIndices.length,
      };
    }

    // Apply sorting// Group headers are not sortable
    if (sortColumns.length > 0) {
      const rows = frameToTableRows(result);
      const sorted = applySort(rows, result.fields, sortColumns, columnTypes, false);
      result = tableRowsToFrame(sorted, result);
    }

    return result;
  }, [data, filter, sortColumns, columnTypes]);

  // Build the header structure and column mapping
  const { headerRows, columns } = useMemo(() => {
    // Check if we should use new GroupItem structure
    const useNewStructure =
      columnGrouping.enabled && columnGrouping.rootGroups && columnGrouping.rootGroups.length > 0;

    if (!columnGrouping.enabled || !useNewStructure) {
      // No grouping - show simple headers
      const simpleHeaders: HeaderCell[][] = [
        data.fields.map((field, idx) => ({
          name: getDisplayName(field),
          colSpan: 1,
          rowSpan: 1,
          level: 0,
          columnIndex: idx,
          field: field,
          isSortable: true, // Simple headers are sortable
          isFilterable: isColumnFilterEnabled(field),
        })),
      ];

      const simpleColumns: ColumnInfo[] = data.fields.map((field) => ({
        fields: [field],
      }));

      return { headerRows: simpleHeaders, columns: simpleColumns };
    }

    // Use original data for building headers (filters apply to rows, not columns)
    const originalData = data;

    // Process rootGroups (GroupItem[])
    return processNewGroupStructure(originalData, columnGrouping.rootGroups!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, columnGrouping]);

  // Render table with filtered data
  const numRows = filteredAndSortedData.length;
  const maxFieldDepth = useMemo(() => Math.max(...columns.map((col) => col.fields.length), 1), [columns]);

  // Pagination for grouped header mode: avoids rendering thousands of <tr>/<td> nodes at once.
  const [page, setPage] = useState(0);
  const paginationEnabled = Boolean(enablePagination) || numRows > 2000;
  const rowsPerPage = useMemo(() => {
    // Estimate row heights conservatively; grouped view can render multiple sub-rows per record.
    const lineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
    const headerRowEstimate = lineHeight + theme.spacing.gridSize * 2; // padding: theme.spacing(1) top/bottom
    const cellRowEstimate = lineHeight + theme.spacing.gridSize; // padding: theme.spacing(0.5) top/bottom
    const paginationEstimate = theme.spacing.gridSize * (theme.components.height.md + 1);

    const headerEstimate = hasHeader && headerRows.length > 0 ? headerRows.length * headerRowEstimate : 0;
    const available = Math.max(0, height - headerEstimate - paginationEstimate);
    const perRecord = Math.max(1, maxFieldDepth) * cellRowEstimate;
    return Math.max(1, Math.floor(available / perRecord));
  }, [hasHeader, headerRows.length, height, maxFieldDepth, theme]);
  const numPages = useMemo(
    () => (paginationEnabled ? Math.ceil(numRows / rowsPerPage) : 1),
    [numRows, rowsPerPage, paginationEnabled]
  );
  const pageRangeStart = useMemo(() => (paginationEnabled ? page * rowsPerPage + 1 : 1), [page, rowsPerPage, paginationEnabled]);
  const pageRangeEnd = useMemo(
    () => (paginationEnabled ? Math.min(numRows, (page + 1) * rowsPerPage) : numRows),
    [numRows, page, rowsPerPage, paginationEnabled]
  );

  // Safeguard against page overflow on filter/sort changes.
  React.useEffect(() => {
    if (!paginationEnabled && page !== 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(0);
      return;
    }
    if (page >= numPages && numPages > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPage(numPages - 1);
    }
  }, [page, numPages, paginationEnabled]);

  const pageRowIndices = useMemo(() => {
    if (numRows === 0) {
      return [];
    }
    if (!paginationEnabled) {
      const indices: number[] = [];
      for (let i = 0; i < numRows; i++) {
        indices.push(i);
      }
      return indices;
    }
    const start = page * rowsPerPage;
    const end = Math.min(numRows, start + rowsPerPage);
    const indices: number[] = [];
    for (let i = start; i < end; i++) {
      indices.push(i);
    }
    return indices;
  }, [numRows, page, rowsPerPage, paginationEnabled]);

  const filteredFieldByName = useMemo(() => {
    const map = new Map<string, Field>();
    for (const f of filteredAndSortedData.fields) {
      map.set(getDisplayName(f), f);
      map.set(f.name, f);
    }
    return map;
  }, [filteredAndSortedData.fields]);

  type CellPlan = {
    colIndex: number;
    fieldKey: string;
    colSpan: number;
    rowSpan: number;
  };

  const cellPlanByDepth = useMemo(() => {
    const plans: CellPlan[][] = Array.from({ length: maxFieldDepth }, () => []);
    for (let depth = 0; depth < maxFieldDepth; depth++) {
      let colIndex = 0;
      while (colIndex < columns.length) {
        const col = columns[colIndex];
        // Single-field columns are rendered once with rowspan.
        if (col.fields.length === 1 && depth > 0) {
          colIndex += 1;
          continue;
        }
        if (depth >= col.fields.length) {
          colIndex += 1;
          continue;
        }

        const field = col.fields[depth];
        const fieldKey = getDisplayName(field);

        // If this field was already rendered in the previous column (via colspan), skip.
        if (
          colIndex > 0 &&
          columns[colIndex - 1].fields.length > depth &&
          getDisplayName(columns[colIndex - 1].fields[depth]) === fieldKey
        ) {
          colIndex += 1;
          continue;
        }

        // Compute colspan (consecutive columns that repeat the same field at this depth).
        let colSpan = 1;
        for (let next = colIndex + 1; next < columns.length; next++) {
          const nextCol = columns[next];
          if (nextCol.fields.length > depth && getDisplayName(nextCol.fields[depth]) === fieldKey) {
            colSpan += 1;
          } else {
            break;
          }
        }

        const rowSpan = col.fields.length === 1 && maxFieldDepth > 1 && depth === 0 ? maxFieldDepth : 1;
        plans[depth].push({ colIndex, fieldKey, colSpan, rowSpan });
        colIndex += colSpan;
      }
    }
    return plans;
  }, [columns, maxFieldDepth]);

  // Check if grouping is enabled and has new rootGroups
  const hasGroups = columnGrouping.rootGroups && columnGrouping.rootGroups.length > 0;

  if (!columnGrouping.enabled || !hasGroups) {
    return <div>Column grouping is not enabled</div>;
  }

  return (
    <div className={styles.container} style={{ height }}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          {hasHeader && (
            <thead>
              {headerRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={styles.headerRow}>
                  {row
                    .sort((a, b) => a.columnIndex - b.columnIndex)
                    .map((cell, cellIndex) => {
                      const wrapHeaderText = cell.field?.config?.custom?.wrapHeaderText;

                      // Apply width only to cells that span multiple rows (ungrouped columns)
                      // or cells at level 0 (top level headers in groups)
                      const shouldApplyWidth = cell.rowSpan > 1 || cell.level === 0;
                      const columnWidth = shouldApplyWidth ? columnWidths.get(cell.columnIndex) : undefined;

                      return (
                        <th
                          key={`${rowIndex}-${cellIndex}`}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={cx(
                            styles.headerCell,
                            wrapHeaderText ? styles.headerCellWrap : styles.headerCellNoWrap,
                            cell.isSortable && styles.headerCellClickable
                          )}
                          onClick={() => cell.isSortable && handleHeaderClick(cell)}
                          style={{
                            width: columnWidth ? `${columnWidth}px` : undefined,
                            minWidth: columnWidth ? `${columnWidth}px` : undefined,
                            maxWidth: columnWidth ? `${columnWidth}px` : undefined,
                          }}
                        >
                          <div className={styles.headerCellContent}>
                            {showTypeIcons && cell.field && (
                              <Icon
                                className={styles.headerCellIcon}
                                name={getFieldTypeIcon(cell.field) as any}
                                title={cell.field.type}
                                size="sm"
                              />
                            )}
                            <span>{cell.name}</span>
                            {cell.field && sortColumns.some((sc) => sc.columnKey === getDisplayName(cell.field)) && (
                              <Icon
                                name={
                                  sortColumns.find((sc) => sc.columnKey === getDisplayName(cell.field))?.direction ===
                                  'ASC'
                                    ? 'arrow-up'
                                    : 'arrow-down'
                                }
                                size="lg"
                              />
                            )}
                            {cell.isFilterable && cell.field && (
                              <Filter
                                name={getDisplayName(cell.field)}
                                rows={tableRows}
                                filter={filter}
                                setFilter={setFilter}
                                field={cell.field}
                                crossFilterOrder={crossFilterOrder}
                                crossFilterRows={crossFilterRows}
                                iconClassName={styles.headerCellIcon}
                              />
                            )}
                          </div>
                          <div
                            className={`${styles.resizeHandle} ${resizingColumn === cell.columnIndex ? styles.resizing : ''}`}
                            onMouseDown={(e) => handleResizeStart(cell.columnIndex, e)}
                          />
                        </th>
                      );
                    })}
                </tr>
              ))}
            </thead>
          )}
          <tbody>
            {pageRowIndices
              .map((rowIndex) =>
                Array.from({ length: maxFieldDepth }).map((_, fieldDepth) => (
                  <tr key={`${rowIndex}-${fieldDepth}`} className={styles.dataRow}>
                    {cellPlanByDepth[fieldDepth].map(({ colIndex, fieldKey, colSpan, rowSpan }) => {
                      const columnWidth = columnWidths.get(colIndex);
                      const filteredField = filteredFieldByName.get(fieldKey);
                      if (!filteredField) {
                        return null;
                      }

                      const value = filteredField.values[rowIndex];
                      const displayValue = filteredField.display
                        ? filteredField.display(value).text
                        : String(value ?? '');
                      const isFilterable = isColumnFilterEnabled(filteredField);
                      const showFilters = Boolean(onCellFilterAdded && isFilterable);
                      const cellInspect = filteredField.config?.custom?.inspect;
                      const showActions = cellInspect || showFilters;
                      const wrapText = filteredField.config?.custom?.wrapText;

                      const links = filteredField.getLinks
                        ? filteredField.getLinks({ valueRowIndex: rowIndex })
                        : undefined;
                      const hasLinks = Boolean(links && links.length > 0);

                      const cellContent = (
                        <div className={styles.cellLine}>
                          <span
                            className={wrapText ? styles.cellWrap : styles.cellNoWrap}
                            title={!wrapText ? displayValue : undefined}
                          >
                            {displayValue}
                          </span>
                          {showActions && (
                            <TableCellActions
                              field={filteredField}
                              value={value}
                              displayName={filteredField.name}
                              cellInspect={!!cellInspect}
                              showFilters={showFilters}
                              className={styles.cellActions}
                              setInspectCell={setInspectCell}
                              onCellFilterAdded={onCellFilterAdded}
                            />
                          )}
                        </div>
                      );

                      return (
                        <td
                          key={`${fieldDepth}-${colIndex}`}
                          className={styles.dataCell}
                          colSpan={colSpan}
                          rowSpan={rowSpan}
                          style={{
                            width: columnWidth ? `${columnWidth}px` : undefined,
                            minWidth: columnWidth ? `${columnWidth}px` : undefined,
                            maxWidth: columnWidth ? `${columnWidth}px` : undefined,
                          }}
                        >
                          {hasLinks ? (
                            <DataLinksContextMenu links={() => links!} style={{}}>
                              {() => cellContent}
                            </DataLinksContextMenu>
                          ) : (
                            cellContent
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )
              .flat()}
          </tbody>
        </table>
      </div>

      {paginationEnabled && numPages > 1 && (
        <div className={styles.paginationContainer}>
          <Pagination
            className="table-ng-pagination"
            currentPage={page + 1}
            numberOfPages={numPages}
            showSmallVersion={false}
            onNavigate={(toPage) => setPage(toPage - 1)}
          />
          <div className={styles.paginationSummary}>
            {pageRangeStart} - {pageRangeEnd} of {numRows} rows
          </div>
        </div>
      )}

      {inspectCell && inspectCell.mode && (
        <TableCellInspector
          mode={inspectCell.mode}
          value={inspectCell.value}
          onDismiss={() => setInspectCell(null)}
        />
      )}
    </div>
  );
};
