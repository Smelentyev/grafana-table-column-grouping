import React, { useMemo, useState, useCallback } from 'react';
import { GrafanaTheme2, Field, FieldType } from '@grafana/data';
import { TableCellTooltipPlacement } from '@grafana/schema';
import { useStyles2, useTheme2, DataLinksContextMenu, Icon, Pagination, Popover } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { SortColumn } from 'react-data-grid';
import {
  ColumnGroupingSettings,
  TableNGProps,
  InspectCellProps,
  FilterType,
  TableRow,
  TableSortByFieldState,
  FILTER_FOR_OPERATOR,
  FILTER_OUT_OPERATOR,
} from './types';
import { TableCellInspector } from '../TableCellInspector';
import { TableCellActions } from './components/TableCellActions';
import { SummaryCell } from './components/SummaryCell';
import { Filter } from './Filter/Filter';
import { getCellRenderer } from './Cells/renderers';
import { COLUMN, TABLE } from './constants';
import {
  applySort,
  computeColWidths,
  getAlignment,
  getCellColorInlineStylesFactory,
  getCellOptions,
  getColumnTypes,
  getDefaultRowHeight,
  getDisplayName,
  getJustifyContent,
  getTextColorForBackground,
  getVisibleFields,
  parseStyleJson,
  predicateByName,
  buildInspectValue,
} from './utils';
import { filterIndices, buildCellPlanByDepth, CellPlan } from './pipelineUtils';
import {
  buildGroupedHeaderStructure,
  buildSimpleHeaderStructure,
  normalizeRootGroups,
} from './groupedTable/groupHeaderPipeline';
import {
  ActiveGroupedCell,
  buildOwnershipMatrix,
  clampActiveCell,
  getCellId,
  moveActiveCell,
  moveActiveCellByRecord,
} from './groupedTable/keyboardNavigation';
import { HeaderCell } from './groupedTable/groupTypes';
import { usePaginatedRows } from './hooks';
import { useVirtualScroll } from './groupedTable/useVirtualScroll';
import { DEFAULT_ROW_HEIGHT_PX } from './groupedTable/virtualWindow';

interface TableWithGroupedHeadersProps extends TableNGProps {
  columnGrouping: ColumnGroupingSettings;
}

const tooltipTriggerStyle = css`
  width: 100%;
  min-width: 0;
`;

const GroupedCellTooltip = ({
  content,
  placement,
  children,
}: {
  content: React.ReactNode;
  placement?: TableCellTooltipPlacement;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [referenceEl, setReferenceEl] = useState<HTMLDivElement | null>(null);

  return (
    <div ref={setReferenceEl} className={tooltipTriggerStyle} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {referenceEl && content != null && (
        <Popover content={<>{content}</>} show={open} placement={placement} referenceElement={referenceEl} />
      )}
      {children}
    </div>
  );
};

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
    outline: none;
    position: relative;
    z-index: 0;
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
  stickyThead: css`
    position: sticky;
    top: 0;
    z-index: 2;
  `,
  headerCell: css`
    padding: ${theme.spacing(1)} ${theme.spacing(2)};
    text-align: center;
    vertical-align: top;
    font-weight: ${theme.typography.fontWeightMedium};
    border-right: 1px solid ${theme.colors.border.medium};
    border-bottom: 1px solid ${theme.colors.border.medium};
    background-color: ${theme.colors.background.secondary};
    position: relative;
    box-sizing: border-box;

    &:first-child {
      border-left: 1px solid ${theme.colors.border.medium};
    }
  `,
  headerCellFilterable: css`
    padding-right: ${theme.spacing(5)};
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
    position: relative;
    width: 100%;
    min-width: 0;
    padding-right: ${theme.spacing(3)};
  `,
  headerCellLabel: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing(0.5)};
    min-width: 0;
  `,
  headerFilterButton: css`
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  `,
  dataRow: css``,
  /** Applied to the per-record <tbody> wrapper; highlights the whole logical record on hover. */
  recordGroup: css`
    &:hover > tr {
      background-color: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};
    }
  `,
  recordGroupEven: css`
    background-color: ${theme.colors.background.canvas};
  `,
  dataCell: css`
    padding: ${theme.spacing(0.25)} ${theme.spacing(1)};
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
  activeCell: css`
    outline: 2px solid ${theme.colors.primary.main};
    outline-offset: -2px;
    z-index: 1;
  `,
  footerRow: css`
    background-color: ${theme.colors.background.secondary};
  `,
  footerCell: css`
    padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
    border-right: 1px solid ${theme.colors.border.weak};
    border-bottom: 1px solid ${theme.colors.border.medium};
    vertical-align: top;

    &:first-child {
      border-left: 1px solid ${theme.colors.border.weak};
    }
  `,
  cellLine: css`
    padding: 0;
    min-height: 16px;
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    flex-wrap: wrap;
    position: relative;

    &:not(:last-child) {
      border-bottom: 1px solid ${theme.colors.border.weak};
    }

    &:hover > div:last-child {
      opacity: 1;
      pointer-events: auto;
    }
  `,
  cellLineFilterable: css`
    padding: 0;
    min-height: 16px;
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
  cellRenderWrap: css`
    width: 100%;
    min-width: 0;
    display: flex;
    align-items: center;
  `,
  clampWrap: css`
    overflow: hidden;
  `,
  cellActions: css`
    display: inline-flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease-in-out;
    background: ${theme.colors.background.canvas};
    z-index: 2;
  `,
  paginationContainer: css`
    align-items: center;
    display: flex;
    justify-content: center;
    margin-top: ${theme.spacing(1)};
    padding: ${theme.spacing(0, 1, 0.5, 1)};
    flex: 0 0 auto;
    position: relative;
    z-index: 4;
    pointer-events: auto;
    width: 100%;
  `,
  paginationSummary: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    display: flex;
    justify-content: flex-end;
    padding: ${theme.spacing(0, 1, 0, 2)};
  `,
});

export const TableWithGroupedHeaders: React.FC<TableWithGroupedHeadersProps> = (props) => {
  const {
    data,
    columnGrouping,
    height,
    width,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    showTypeIcons,
    disableKeyboardEvents,
    enablePagination,
    paginationPageSize,
    cellHeight,
    maxRowHeight,
    initialSortBy,
    timeRange,
    disableSanitizeHtml,
    getActions = () => [],
  } = props;
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);
  const [activeCell, setActiveCell] = useState<ActiveGroupedCell | null>(null);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);

  const hasHeader = !noHeader;
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const visibleData = useMemo(() => ({ ...data, fields: visibleFields }), [data, visibleFields]);
  const normalizedRootGroups = useMemo(
    () => normalizeRootGroups(columnGrouping.rootGroups ?? [], visibleFields),
    [columnGrouping.rootGroups, visibleFields]
  );
  const groupedRows = useMemo<TableRow[]>(
    () =>
      Array.from({ length: visibleData.length }, (_, i) => {
        const row: TableRow = { __depth: 0, __index: i };
        for (const field of visibleData.fields) {
          row[getDisplayName(field)] = field.values[i];
        }
        return row;
      }),
    [visibleData]
  );
  const defaultRowHeight = useMemo(() => getDefaultRowHeight(theme, visibleFields, cellHeight), [theme, visibleFields, cellHeight]);
  const perLineMinHeight = useMemo(
    () => (typeof defaultRowHeight === 'number' ? Math.max(16, defaultRowHeight - TABLE.CELL_PADDING) : DEFAULT_ROW_HEIGHT_PX),
    [defaultRowHeight]
  );
  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);

  // ── Sort state ───────────────────────────────────────────────────────────────
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(
    () =>
      initialSortBy?.flatMap(({ displayName, desc }: TableSortByFieldState) =>
        visibleFields.some((f) => getDisplayName(f) === displayName)
          ? [{ columnKey: displayName, direction: desc ? ('DESC' as const) : ('ASC' as const) }]
          : []
      ) ?? []
  );
  const columnTypes = useMemo(() => getColumnTypes(visibleData.fields), [visibleData.fields]);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<FilterType>({});
  const crossFilterOrder = useMemo(() => Object.keys(filter), [filter]);

  // ── Column resize state ──────────────────────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const resizeStartXRef = React.useRef<number>(0);
  const resizeStartWidthRef = React.useRef<number>(0);
  const resizingHeaderRef = React.useRef<HTMLElement | null>(null);
  const pendingWidthRef = React.useRef<number | null>(null);
  const columnMinWidthsRef = React.useRef<number[]>([]);
  /** Direct refs to <col> elements; written during drag to avoid React re-renders. */
  const colElemsRef = React.useRef<Array<HTMLTableColElement | null>>([]);
  /** Same for the footer table — kept in sync during drag so footer widths don't lag. */
  const footerColElemsRef = React.useRef<Array<HTMLTableColElement | null>>([]);
  const theadRef = React.useRef<HTMLTableSectionElement | null>(null);
  const firstVisibleRecordRef = React.useRef<HTMLTableSectionElement | null>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);
  const [measuredRecordHeightPx, setMeasuredRecordHeightPx] = useState<number | null>(null);

  // ── Cross-filter index chains ─────────────────────────────────────────────────
  const crossFilterRows = useMemo(() => {
    const result: { [key: string]: number[] } = {};
    if (crossFilterOrder.length === 0) {
      return result;
    }
    const fieldByName = new Map<string, Field>();
    for (const f of visibleData.fields) {
      fieldByName.set(getDisplayName(f), f);
    }
    let prefixIndices: number[] = Array.from({ length: visibleData.length }, (_, i) => i);
    for (const fieldName of crossFilterOrder) {
      const filterValue = filter[fieldName];
      const field = fieldByName.get(fieldName);
      if (filterValue?.filteredSet?.size && field) {
        prefixIndices = prefixIndices.filter((i) =>
          filterValue.filteredSet.has(String(field.values[i] ?? ''))
        );
      }
      result[fieldName] = prefixIndices;
    }
    return result;
  }, [visibleData, filter, crossFilterOrder]);

  // ── Sort handler ─────────────────────────────────────────────────────────────
  const handleHeaderClick = useCallback((cell: HeaderCell) => {
    if (!cell.field || !cell.isSortable) {
      return;
    }
    const fieldName = getDisplayName(cell.field);
    setSortColumns((prev) => {
      let nextSortColumns: SortColumn[];
      const existing = prev.find((sc) => sc.columnKey === fieldName);
      if (!existing) {
        nextSortColumns = [{ columnKey: fieldName, direction: 'ASC' }];
      } else if (existing.direction === 'ASC') {
        nextSortColumns = [{ columnKey: fieldName, direction: 'DESC' }];
      } else {
        nextSortColumns = [];
      }

      onSortByChange?.(
        nextSortColumns.map((col) => ({
          displayName: String(col.columnKey),
          desc: col.direction === 'DESC',
        }))
      );

      return nextSortColumns;
    });
  }, [onSortByChange]);

  // ── Column resize handlers ───────────────────────────────────────────────────
  const handleResizeStart = (columnIndex: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const headerCell = (event.target as HTMLElement).parentElement;
    if (!headerCell) {
      return;
    }
    resizingHeaderRef.current = headerCell;
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = headerCell.offsetWidth;
    pendingWidthRef.current = null;
    setResizingColumn(columnIndex);
  };

  const handleResizeMove = React.useCallback(
    (event: MouseEvent) => {
      if (resizingColumn === null) {
        return;
      }
      const deltaX = event.clientX - resizeStartXRef.current;
      const minWidth = columnMinWidthsRef.current[resizingColumn] ?? COLUMN.MIN_WIDTH;
      const newWidth = Math.max(minWidth, resizeStartWidthRef.current + deltaX);
      // Write directly to <col> — avoids React re-render during drag.
      const col = colElemsRef.current[resizingColumn];
      if (col) {
        col.style.width = `${newWidth}px`;
      }
      const footerCol = footerColElemsRef.current[resizingColumn];
      if (footerCol) {
        footerCol.style.width = `${newWidth}px`;
      }
      pendingWidthRef.current = newWidth;
    },
    [resizingColumn]
  );

  const handleResizeEnd = React.useCallback(() => {
    if (resizingColumn !== null) {
      const newWidth = pendingWidthRef.current;
      if (newWidth !== null) {
        setColumnWidths((prev) => {
          const next = new Map(prev);
          next.set(resizingColumn, newWidth);
          return next;
        });
        if (onColumnResize && columns) {
          const column = columns[resizingColumn];
          if (column && column.fields.length > 0) {
            onColumnResize(column.fields[0].name, newWidth);
          }
        }
      }
    }
    setResizingColumn(null);
    resizingHeaderRef.current = null;
    pendingWidthRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingColumn, onColumnResize]);

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
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);

  // ── Header structure (from pipeline) ────────────────────────────────────────
  const { headerRows, columns, maxDepth } = useMemo(() => {
    const useGrouped =
      columnGrouping.enabled &&
      normalizedRootGroups.length > 0;

    if (!useGrouped) {
      return buildSimpleHeaderStructure(visibleData);
    }
    return buildGroupedHeaderStructure(visibleData, normalizedRootGroups);
  }, [visibleData, columnGrouping.enabled, normalizedRootGroups]);

  const initialColumnWidths = useMemo(() => {
    const rootFields = columns.map((column) => column.fields[0]).filter(Boolean);
    return computeColWidths(rootFields, width);
  }, [columns, width]);
  React.useEffect(() => {
    columnMinWidthsRef.current = columns.map((column) => column.fields[0]?.config?.custom?.minWidth ?? COLUMN.MIN_WIDTH);
  }, [columns]);

  const footerFields = useMemo(
    () => columns.map((column) => column.fields[column.fields.length - 1] ?? column.fields[0]),
    [columns]
  );
  const footerConfigs = useMemo(() => footerFields.map((field) => field?.config.custom?.footer), [footerFields]);
  const hasFooter = useMemo(
    () => footerFields.some((field) => Boolean(field?.config.custom?.footer?.reducers?.length)),
    [footerFields]
  );

  // ── Filtered + sorted indices ────────────────────────────────────────────────
  const filteredSortedIndices = useMemo(() => {
    let indices = filterIndices(visibleData, filter);
    if (sortColumns.length > 0) {
      const tempRows: TableRow[] = indices.map((i) => {
        const row: TableRow = { __depth: 0, __index: i };
        for (const field of visibleData.fields) {
          row[getDisplayName(field)] = field.values[i];
        }
        return row;
      });
      const sorted = applySort(tempRows, visibleData.fields, sortColumns, columnTypes, false);
      indices = sorted.map((row) => row.__index as number);
    }
    return indices;
  }, [visibleData, filter, sortColumns, columnTypes]);
  const filteredSortedRows = useMemo(
    () => filteredSortedIndices.map((i) => groupedRows[i]),
    [filteredSortedIndices, groupedRows]
  );

  // ── Pagination ───────────────────────────────────────────────────────────────
  const numRows = filteredSortedIndices.length;
  const estimatedHeaderHeightPx = hasHeader ? headerHeightPx || TABLE.HEADER_ROW_HEIGHT : 0;
  const estimatedFooterHeightPx = hasFooter
    ? typeof defaultRowHeight === 'number'
      ? defaultRowHeight
      : DEFAULT_ROW_HEIGHT_PX
    : 0;
  const averageRecordHeightPx = Math.max(
    1,
    measuredRecordHeightPx ??
      (typeof defaultRowHeight === 'number' ? defaultRowHeight * maxDepth : DEFAULT_ROW_HEIGHT_PX * maxDepth)
  );

  const paginationEnabled = Boolean(enablePagination);
  const {
    rows: paginatedRows,
    page,
    setPage,
    numPages,
    rowsPerPage,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  } = usePaginatedRows(filteredSortedRows, {
    enabled: paginationEnabled,
    pageSize: paginationPageSize,
    width,
    height,
    footerHeight: estimatedFooterHeightPx,
    headerHeight: estimatedHeaderHeightPx,
    rowHeight: averageRecordHeightPx,
  });

  /**
   * Original row indices that belong to the current page.
   */
  const pageRowIndices = useMemo(() => {
    if (numRows === 0) {
      return [];
    }
    if (!paginationEnabled) {
      return filteredSortedRows.map((row) => row.__index);
    }
    return paginatedRows.map((row) => row.__index);
  }, [filteredSortedRows, numRows, paginatedRows, paginationEnabled]);

  // ── Virtual scroll ───────────────────────────────────────────────────────────
  /** Estimated height per logical record (one record = maxDepth visual rows). */
  const recordHeightPx = measuredRecordHeightPx ?? maxDepth * DEFAULT_ROW_HEIGHT_PX;
  const { scrollContainerRef, virtualWindow, recomputeWindow } = useVirtualScroll({
    totalRecords: pageRowIndices.length,
    recordHeightPx,
    leadingOffsetPx: hasHeader ? headerHeightPx : 0,
  });

  React.useEffect(() => {
    const theadEl = theadRef.current;
    if (!theadEl) {
      setHeaderHeightPx(0);
      return;
    }

    const updateHeaderHeight = () => {
      setHeaderHeightPx(theadEl.getBoundingClientRect().height);
    };

    updateHeaderHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(theadEl);
    return () => {
      observer.disconnect();
    };
  }, [hasHeader, headerRows]);

  React.useEffect(() => {
    const recordEl = firstVisibleRecordRef.current;
    if (!recordEl) {
      return;
    }

    const updateRecordHeight = () => {
      const nextHeight = Math.ceil(recordEl.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setMeasuredRecordHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
      }
    };

    updateRecordHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateRecordHeight);
    observer.observe(recordEl);
    return () => {
      observer.disconnect();
    };
  }, [pageRowIndices, virtualWindow.startIndex, virtualWindow.endIndex, maxDepth, columns.length]);

  // Reset scroll position when the page changes so new page always starts at top,
  // then explicitly recompute the virtual window (setting scrollTop=0 on an element
  // already at 0 does not fire a scroll event, so the window must be updated manually).
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    recomputeWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Display value cache ──────────────────────────────────────────────────────
  /** Cleared whenever visible data changes; filled lazily during body render. */
  const displayValueCache = useMemo(() => new Map<string, string>(), [visibleData]);

  // ── Cell plan ────────────────────────────────────────────────────────────────
  const cellPlanByDepth = useMemo<CellPlan[][]>(
    () => buildCellPlanByDepth(columns, maxDepth),
    [columns, maxDepth]
  );
  const gridDimensions = useMemo(
    () => ({
      columnCount: columns.length,
      maxDepth,
      recordCount: pageRowIndices.length,
    }),
    [columns.length, maxDepth, pageRowIndices.length]
  );
  const ownershipMatrix = useMemo(
    () => buildOwnershipMatrix(cellPlanByDepth, gridDimensions),
    [cellPlanByDepth, gridDimensions]
  );

  React.useEffect(() => {
    setActiveCell((prev) => clampActiveCell(prev, gridDimensions));
  }, [gridDimensions]);

  const focusTable = useCallback(() => {
    scrollContainerRef.current?.focus();
  }, [scrollContainerRef]);

  const openInspectorForCell = useCallback(
    (cell: ActiveGroupedCell) => {
      const originalRowIndex = pageRowIndices[cell.recordIndex];
      const plan = cellPlanByDepth[cell.fieldDepth]?.find((item) => item.colIndex === cell.colIndex);
      const field = plan?.field;
      if (field == null || originalRowIndex == null) {
        return;
      }

      const value = field.values[originalRowIndex];
      const [inspectValue, mode] = buildInspectValue(value, field);
      setInspectCell({ value: inspectValue, mode });
    },
    [cellPlanByDepth, pageRowIndices]
  );

  const applyFilterForCell = useCallback(
    (cell: ActiveGroupedCell, operator: typeof FILTER_FOR_OPERATOR | typeof FILTER_OUT_OPERATOR) => {
      if (!onCellFilterAdded) {
        return;
      }

      const originalRowIndex = pageRowIndices[cell.recordIndex];
      const plan = cellPlanByDepth[cell.fieldDepth]?.find((item) => item.colIndex === cell.colIndex);
      const field = plan?.field;
      if (!field || originalRowIndex == null) {
        return;
      }

      onCellFilterAdded({
        key: field.name,
        operator,
        value: String(field.values[originalRowIndex] ?? ''),
      });
    },
    [cellPlanByDepth, onCellFilterAdded, pageRowIndices]
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!paginationEnabled || numPages <= 0) {
        return;
      }

      const safePage = Math.max(0, Math.min(numPages - 1, nextPage));
      if (safePage === page) {
        return;
      }

      const nextRecordIndex = activeCell ? Math.min(activeCell.recordIndex, Math.max(rowsPerPage - 1, 0)) : 0;
      const nextFieldDepth = activeCell?.fieldDepth ?? 0;
      const nextColIndex = activeCell?.colIndex ?? 0;
      setPage(safePage);
      setActiveCell({
        recordIndex: nextRecordIndex,
        fieldDepth: nextFieldDepth,
        colIndex: nextColIndex,
      });
    },
    [activeCell, numPages, page, paginationEnabled, rowsPerPage]
  );

  React.useEffect(() => {
    if (!activeCell) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const approxSubRowHeight = Math.max(1, recordHeightPx / Math.max(1, maxDepth));
    const cellTop = activeCell.recordIndex * recordHeightPx + activeCell.fieldDepth * approxSubRowHeight;
    const cellBottom = cellTop + approxSubRowHeight;
    const viewportTop = container.scrollTop;
    const viewportBottom = viewportTop + container.clientHeight;

    if (cellTop < viewportTop) {
      container.scrollTop = Math.max(0, cellTop);
    } else if (cellBottom > viewportBottom) {
      container.scrollTop = Math.max(0, cellBottom - container.clientHeight);
    }

    const target = container.querySelector<HTMLElement>(`[data-active-cell-id="${getCellId(activeCell)}"]`);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeCell, maxDepth, recordHeightPx, scrollContainerRef, page]);

  const handleTableKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const isFilterHotkey = event.code === 'KeyF';
      if (
        !target ||
        target.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"], [role="listbox"]')
      ) {
        return;
      }

      if (event.ctrlKey && !event.shiftKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault();
        goToPage(page + (event.key === 'ArrowRight' ? 1 : -1));
        return;
      }

      if (!activeCell) {
        const nextCell = clampActiveCell(null, gridDimensions);
        if (!nextCell) {
          return;
        }

        if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          setActiveCell(nextCell);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          setActiveCell(nextCell);
          openInspectorForCell(nextCell);
          return;
        }

        if (isFilterHotkey) {
          event.preventDefault();
          setActiveCell(nextCell);
          applyFilterForCell(nextCell, event.shiftKey ? FILTER_OUT_OPERATOR : FILTER_FOR_OPERATOR);
        }
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCell(
          event.shiftKey
            ? moveActiveCellByRecord(activeCell, 'up', ownershipMatrix, gridDimensions)
            : moveActiveCell(activeCell, 'up', ownershipMatrix, gridDimensions)
        );
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveCell(
          event.shiftKey
            ? moveActiveCellByRecord(activeCell, 'down', ownershipMatrix, gridDimensions)
            : moveActiveCell(activeCell, 'down', ownershipMatrix, gridDimensions)
        );
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveCell(moveActiveCell(activeCell, 'left', ownershipMatrix, gridDimensions));
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveCell(moveActiveCell(activeCell, 'right', ownershipMatrix, gridDimensions));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setActiveCell(moveActiveCell(activeCell, 'home', ownershipMatrix, gridDimensions));
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setActiveCell(moveActiveCell(activeCell, 'end', ownershipMatrix, gridDimensions));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        openInspectorForCell(activeCell);
        return;
      }
      if (isFilterHotkey) {
        event.preventDefault();
        applyFilterForCell(activeCell, event.shiftKey ? FILTER_OUT_OPERATOR : FILTER_FOR_OPERATOR);
      }
    },
    [activeCell, applyFilterForCell, goToPage, gridDimensions, openInspectorForCell, ownershipMatrix, page]
  );

  // ── Guard: grouping must be enabled ─────────────────────────────────────────
  if (!columnGrouping.enabled) {
    return <div>Column grouping is not enabled</div>;
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  /** Renders a single logical record wrapped in its own <tbody>.
   *  Grouping sub-rows under one <tbody> lets CSS `tbody:hover > tr` highlight
   *  the full logical record without triggering leave/enter flicker between sub-rows. */
  const renderRecord = (originalRowIndex: number, recordIndexInPage: number, isFirstVisible: boolean) => {
    return (
      <tbody
        key={`${recordIndexInPage}-${originalRowIndex}`}
        ref={(node) => {
          if (isFirstVisible) {
            firstVisibleRecordRef.current = node;
          }
        }}
        className={cx(styles.recordGroup, recordIndexInPage % 2 === 0 && styles.recordGroupEven)}
      >
      {Array.from({ length: maxDepth }, (_, fieldDepth) => (
        <tr
          key={fieldDepth}
          className={styles.dataRow}
        >
        {cellPlanByDepth[fieldDepth].map(
          ({ colIndex, field: filteredField, colSpan, rowSpan }: CellPlan) => {
            if (!filteredField) {
              return null;
            }
            const value = filteredField.values[originalRowIndex];
            const cacheKey = `${filteredField.name}:${originalRowIndex}`;
            let displayValue = displayValueCache.get(cacheKey);
            if (displayValue === undefined) {
              displayValue = filteredField.display
                ? filteredField.display(value).text
                : String(value ?? '');
              displayValueCache.set(cacheKey, displayValue);
            }

            const isFilterable =
              filteredField.config?.filterable === true ||
              filteredField.config?.custom?.filterable === true;
            const showFilters = Boolean(onCellFilterAdded && isFilterable);
            const cellInspect = filteredField.config?.custom?.inspect;
            const showActions = cellInspect || showFilters;
            const wrapText = filteredField.config?.custom?.wrapText;
            const textAlign = getAlignment(filteredField);
            const justifyContent = getJustifyContent(textAlign);
            const cellOptions = getCellOptions(filteredField);
            const CellType = getCellRenderer(filteredField, cellOptions);
            const columnWidth = columnWidths.get(colIndex) ?? initialColumnWidths[colIndex] ?? COLUMN.DEFAULT_WIDTH;
            const styleFieldName = filteredField.config.custom?.styleField;
            const styleField = styleFieldName ? data.fields.find(predicateByName(styleFieldName)) : undefined;
            const styleValue = styleField ? styleField.values[originalRowIndex] : undefined;
            const displayValueObj = filteredField.display ? filteredField.display(value) : undefined;

            const links = filteredField.getLinks
              ? filteredField.getLinks({ valueRowIndex: originalRowIndex })
              : undefined;
            const hasLinks = Boolean(links && links.length > 0);

            const inlineStyle: React.CSSProperties = {
              justifyContent,
              textAlign,
              ...(maxRowHeight != null ? { maxHeight: maxRowHeight, overflow: 'hidden' } : null),
              ...(displayValueObj ? getCellColorInlineStyles(cellOptions, displayValueObj, false) : null),
              ...(parseStyleJson(styleValue) ?? null),
            };

            const renderedValue = (
              <div
                className={cx(styles.cellRenderWrap, !wrapText && styles.cellNoWrap, maxRowHeight != null && styles.clampWrap)}
                style={inlineStyle}
                title={!wrapText ? displayValue : undefined}
              >
                <CellType
                  cellOptions={cellOptions}
                  frame={visibleData}
                  field={filteredField}
                  height={typeof defaultRowHeight === 'number' ? defaultRowHeight : DEFAULT_ROW_HEIGHT_PX}
                  rowIdx={originalRowIndex}
                  theme={theme}
                  value={value}
                  width={columnWidth}
                  timeRange={timeRange}
                  cellInspect={!!cellInspect}
                  showFilters={showFilters}
                  getActions={(field, rowIdx) => getActions(visibleData, field, rowIdx)}
                  disableSanitizeHtml={disableSanitizeHtml}
                  getTextColorForBackground={getTextColorForBackground}
                />
              </div>
            );

            const tooltipFieldName = filteredField.config.custom?.tooltip?.field;
            const tooltipField = tooltipFieldName ? data.fields.find(predicateByName(tooltipFieldName)) : undefined;
            const tooltipPlacement = filteredField.config.custom?.tooltip?.placement ?? TableCellTooltipPlacement.Auto;
            let tooltipContent: React.ReactNode = null;
            if (tooltipField) {
              const tooltipOptions = getCellOptions(tooltipField);
              const TooltipRenderer = getCellRenderer(tooltipField, tooltipOptions);
              tooltipContent = (
                <div style={{ width: tooltipField.config.custom?.width ?? columnWidth, padding: theme.spacing(0.5) }}>
                  <TooltipRenderer
                    cellOptions={tooltipOptions}
                    frame={visibleData}
                    field={tooltipField}
                    height={typeof defaultRowHeight === 'number' ? defaultRowHeight : DEFAULT_ROW_HEIGHT_PX}
                    rowIdx={originalRowIndex}
                    theme={theme}
                    value={tooltipField.values[originalRowIndex]}
                    width={tooltipField.config.custom?.width ?? columnWidth}
                    timeRange={timeRange}
                    cellInspect={false}
                    showFilters={false}
                    getActions={(field, rowIdx) => getActions(visibleData, field, rowIdx)}
                    disableSanitizeHtml={disableSanitizeHtml}
                    getTextColorForBackground={getTextColorForBackground}
                  />
                </div>
              );
            }

            const cellContent = (
              <div
                className={styles.cellLine}
                style={{
                  minHeight: perLineMinHeight,
                }}
              >
                {tooltipContent ? (
                  <GroupedCellTooltip content={tooltipContent} placement={tooltipPlacement}>
                    {renderedValue}
                  </GroupedCellTooltip>
                ) : (
                  renderedValue
                )}
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
                className={cx(
                  styles.dataCell,
                  hasKeyboardFocus &&
                    activeCell?.recordIndex === recordIndexInPage &&
                    activeCell?.fieldDepth === fieldDepth &&
                    activeCell?.colIndex === colIndex &&
                    styles.activeCell
                )}
                data-active-cell-id={getCellId({
                  recordIndex: recordIndexInPage,
                  fieldDepth,
                  colIndex,
                })}
                onClick={() => {
                  setActiveCell({
                    recordIndex: recordIndexInPage,
                    fieldDepth,
                    colIndex,
                  });
                  focusTable();
                }}
                onMouseEnter={(e) => {
                  const actions = e.currentTarget.querySelector<HTMLElement>('[data-role="cell-actions"]');
                  if (actions) {
                    actions.style.opacity = '1';
                    actions.style.pointerEvents = 'auto';
                  }
                }}
                onMouseLeave={(e) => {
                  const actions = e.currentTarget.querySelector<HTMLElement>('[data-role="cell-actions"]');
                  if (actions) {
                    actions.style.opacity = '0';
                    actions.style.pointerEvents = 'none';
                  }
                }}
                colSpan={colSpan}
                rowSpan={rowSpan}
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
          }
        )}
        </tr>
      ))}
      </tbody>
    );
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container} style={{ height }}>
      <div
        className={styles.tableScroll}
        ref={scrollContainerRef}
        tabIndex={disableKeyboardEvents ? -1 : 0}
        role="grid"
        aria-label="Grouped table"
        onFocus={() => {
          setHasKeyboardFocus(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHasKeyboardFocus(false);
          }
        }}
        onKeyDown={disableKeyboardEvents ? undefined : handleTableKeyDown}
      >
        <table className={styles.table}>
          {/*
           * <colgroup> is the single source of truth for column widths with
           * table-layout:fixed.  During resize we write directly to the matching
           * <col> element so that the full column updates instantly without any
           * React re-render.
           */}
          <colgroup>
            {columns.map((_, i) => {
              const w = columnWidths.get(i) ?? initialColumnWidths[i];
              return (
                <col
                  key={i}
                  ref={(el) => {
                    colElemsRef.current[i] = el;
                  }}
                  style={w ? { width: `${w}px` } : undefined}
                />
              );
            })}
          </colgroup>

          {hasHeader && (
            <thead className={styles.stickyThead} ref={theadRef}>
              {headerRows.map((row, rowIndex) => (
                <tr key={rowIndex} className={styles.headerRow}>
                  {row
                    .slice()
                    .sort((a, b) => a.columnIndex - b.columnIndex)
                    .map((cell, cellIndex) => {
                      const wrapHeaderText = cell.field?.config?.custom?.wrapHeaderText;
                      return (
                        <th
                          key={`${rowIndex}-${cellIndex}`}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={cx(
                            styles.headerCell,
                            cell.isFilterable && cell.field && styles.headerCellFilterable,
                            wrapHeaderText ? styles.headerCellWrap : styles.headerCellNoWrap,
                            cell.isSortable && styles.headerCellClickable
                          )}
                          onClick={() => cell.isSortable && handleHeaderClick(cell)}
                        >
                          <div className={styles.headerCellContent}>
                            <span className={styles.headerCellLabel}>
                              {showTypeIcons && cell.field && (
                                <Icon
                                  className={styles.headerCellIcon}
                                  name={getFieldTypeIcon(cell.field) as any}
                                  title={cell.field.type}
                                  size="sm"
                                />
                              )}
                              <span>{cell.name}</span>
                              {cell.field &&
                                (() => {
                                  const fieldName = getDisplayName(cell.field);
                                  const activeSort = sortColumns.find(
                                    (sc) => sc.columnKey === fieldName
                                  );
                                  if (!activeSort) {
                                    return null;
                                  }
                                  return (
                                    <Icon
                                      name={activeSort.direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
                                      size="lg"
                                    />
                                  );
                                })()}
                            </span>
                            {cell.isFilterable && cell.field && (
                              <Filter
                                name={getDisplayName(cell.field)}
                                data={visibleData}
                                filter={filter}
                                setFilter={setFilter}
                                field={cell.field}
                                crossFilterOrder={crossFilterOrder}
                                crossFilterRows={crossFilterRows}
                                iconClassName={styles.headerCellIcon}
                                buttonClassName={styles.headerFilterButton}
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

          {/* Top spacer — compensates for records rendered above the virtual window */}
          {virtualWindow.topSpacerPx > 0 && (
            <tbody>
              <tr style={{ height: virtualWindow.topSpacerPx }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
              </tr>
            </tbody>
          )}

          {/* Visible records — each logical record in its own <tbody> for hover correctness */}
          {pageRowIndices
            .slice(virtualWindow.startIndex, virtualWindow.endIndex)
            .map((originalRowIndex, visibleIdx) =>
              renderRecord(originalRowIndex, virtualWindow.startIndex + visibleIdx, visibleIdx === 0)
            )}

          {/* Bottom spacer — compensates for records rendered below the virtual window */}
          {virtualWindow.bottomSpacerPx > 0 && (
            <tbody>
              <tr style={{ height: virtualWindow.bottomSpacerPx }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {hasFooter && (
        <table className={styles.table}>
          <colgroup>
            {columns.map((_, i) => {
              const w = columnWidths.get(i) ?? initialColumnWidths[i];
              return (
                <col
                  key={i}
                  ref={(el) => { footerColElemsRef.current[i] = el; }}
                  style={w ? { width: `${w}px` } : undefined}
                />
              );
            })}
          </colgroup>
          <tfoot>
            <tr className={styles.footerRow}>
              {footerFields.map((field, i) => (
                <td key={i} className={styles.footerCell}>
                  {field ? (
                    <SummaryCell
                      rows={filteredSortedRows}
                      footers={footerConfigs}
                      field={field}
                      colIdx={i}
                      textAlign={getAlignment(field)}
                      rowLabel={i === 0}
                      hideLabel={i !== 0}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}

      {paginationEnabled && numPages > 1 && (
        <div className={styles.paginationContainer}>
          <Pagination
            className="table-ng-pagination"
            currentPage={page + 1}
            numberOfPages={numPages}
            showSmallVersion={smallPagination}
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
