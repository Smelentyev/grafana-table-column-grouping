import React, { useMemo, useState, useCallback } from 'react';
import { GrafanaTheme2, Field, FieldType } from '@grafana/data';
import { useStyles2, DataLinksContextMenu, Icon, Pagination } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { SortColumn } from 'react-data-grid';
import {
  ColumnGroupingSettings,
  TableNGProps,
  InspectCellProps,
  FilterType,
  TableRow,
} from './types';
import { TableCellInspector } from '../TableCellInspector';
import { TableCellActions } from './components/TableCellActions';
import { Filter } from './Filter/Filter';
import { applySort, getColumnTypes, getDisplayName } from './utils';
import { filterIndices, buildCellPlanByDepth, CellPlan } from './pipelineUtils';
import {
  buildGroupedHeaderStructure,
  buildSimpleHeaderStructure,
} from './groupedTable/groupHeaderPipeline';
import { HeaderCell } from './groupedTable/groupTypes';
import { useVirtualScroll } from './groupedTable/useVirtualScroll';
import { DEFAULT_ROW_HEIGHT_PX } from './groupedTable/virtualWindow';

interface TableWithGroupedHeadersProps extends TableNGProps {
  columnGrouping: ColumnGroupingSettings;
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
    &:hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};
    }
  `,
  dataRowEven: css`
    background-color: ${theme.colors.background.canvas};
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

export const TableWithGroupedHeaders: React.FC<TableWithGroupedHeadersProps> = (props) => {
  const {
    data,
    columnGrouping,
    height,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    showTypeIcons,
    enablePagination,
    paginationPageSize,
  } = props;
  const styles = useStyles2(getStyles);
  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);

  const hasHeader = !noHeader;

  // ── Sort state ───────────────────────────────────────────────────────────────
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);

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
  /** Direct refs to <col> elements; written during drag to avoid React re-renders. */
  const colElemsRef = React.useRef<Array<HTMLTableColElement | null>>([]);
  const theadRef = React.useRef<HTMLTableSectionElement | null>(null);
  const [headerHeightPx, setHeaderHeightPx] = useState(0);

  // ── Cross-filter index chains ─────────────────────────────────────────────────
  const crossFilterRows = useMemo(() => {
    const result: { [key: string]: number[] } = {};
    if (crossFilterOrder.length === 0) {
      return result;
    }
    const fieldByName = new Map<string, Field>();
    for (const f of data.fields) {
      fieldByName.set(getDisplayName(f), f);
    }
    let prefixIndices: number[] = Array.from({ length: data.length }, (_, i) => i);
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
  }, [data, filter, crossFilterOrder]);

  // ── Sort handler ─────────────────────────────────────────────────────────────
  const handleHeaderClick = useCallback((cell: HeaderCell) => {
    if (!cell.field || !cell.isSortable) {
      return;
    }
    const fieldName = getDisplayName(cell.field);
    setSortColumns((prev) => {
      const existing = prev.find((sc) => sc.columnKey === fieldName);
      if (!existing) {
        return [{ columnKey: fieldName, direction: 'ASC' }];
      }
      if (existing.direction === 'ASC') {
        return [{ columnKey: fieldName, direction: 'DESC' }];
      }
      return [];
    });
  }, []);

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
      const newWidth = Math.max(50, resizeStartWidthRef.current + deltaX);
      // Write directly to <col> — avoids React re-render during drag.
      const col = colElemsRef.current[resizingColumn];
      if (col) {
        col.style.width = `${newWidth}px`;
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
  const { headerRows, columns } = useMemo(() => {
    const useGrouped =
      columnGrouping.enabled &&
      columnGrouping.rootGroups &&
      columnGrouping.rootGroups.length > 0;

    if (!useGrouped) {
      return buildSimpleHeaderStructure(data);
    }
    return buildGroupedHeaderStructure(data, columnGrouping.rootGroups!);
  }, [data, columnGrouping]);

  // ── Filtered + sorted indices ────────────────────────────────────────────────
  const filteredSortedIndices = useMemo(() => {
    let indices = filterIndices(data, filter);
    if (sortColumns.length > 0) {
      const tempRows: TableRow[] = indices.map((i) => {
        const row: TableRow = { __depth: 0, __index: i };
        for (const field of data.fields) {
          row[getDisplayName(field)] = field.values[i];
        }
        return row;
      });
      const sorted = applySort(tempRows, data.fields, sortColumns, columnTypes, false);
      indices = sorted.map((row) => row.__index as number);
    }
    return indices;
  }, [data, filter, sortColumns, columnTypes]);

  // ── Pagination ───────────────────────────────────────────────────────────────
  const numRows = filteredSortedIndices.length;
  const maxFieldDepth = useMemo(() => Math.max(...columns.map((col) => col.fields.length), 1), [columns]);

  const [page, setPage] = useState(0);
  const paginationEnabled = Boolean(enablePagination);
  const rowsPerPage = useMemo(
    () => (paginationPageSize && paginationPageSize > 0 ? paginationPageSize : 100),
    [paginationPageSize]
  );
  const numPages = useMemo(
    () => (paginationEnabled ? Math.ceil(numRows / rowsPerPage) : 1),
    [numRows, rowsPerPage, paginationEnabled]
  );
  const pageRangeStart = useMemo(
    () => (paginationEnabled ? page * rowsPerPage + 1 : 1),
    [page, rowsPerPage, paginationEnabled]
  );
  const pageRangeEnd = useMemo(
    () => (paginationEnabled ? Math.min(numRows, (page + 1) * rowsPerPage) : numRows),
    [numRows, page, rowsPerPage, paginationEnabled]
  );

  // Guard against page overflow on filter/sort changes.
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

  /**
   * Positions (0-based) within filteredSortedIndices that belong to the current page.
   * These are NOT raw data indices — use `filteredSortedIndices[pos]` to get the data index.
   */
  const pageRowIndices = useMemo(() => {
    if (numRows === 0) {
      return [];
    }
    if (!paginationEnabled) {
      return Array.from({ length: numRows }, (_, i) => i);
    }
    const start = page * rowsPerPage;
    const end = Math.min(numRows, start + rowsPerPage);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [numRows, page, rowsPerPage, paginationEnabled]);

  // ── Virtual scroll ───────────────────────────────────────────────────────────
  /** Estimated height per logical record (one record = maxFieldDepth visual rows). */
  const recordHeightPx = maxFieldDepth * DEFAULT_ROW_HEIGHT_PX;
  const { scrollContainerRef, virtualWindow } = useVirtualScroll({
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

  // Reset scroll position when the page changes so new page always starts at top.
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // ── Display value cache ──────────────────────────────────────────────────────
  /** Cleared whenever `data` changes; filled lazily during body render. */
  const displayValueCache = useMemo(() => new Map<string, string>(), []);

  // ── Cell plan ────────────────────────────────────────────────────────────────
  const cellPlanByDepth = useMemo<CellPlan[][]>(
    () => buildCellPlanByDepth(columns, maxFieldDepth),
    [columns, maxFieldDepth]
  );

  // ── Guard: grouping must be enabled ─────────────────────────────────────────
  const hasGroups = columnGrouping.rootGroups && columnGrouping.rootGroups.length > 0;
  if (!columnGrouping.enabled || !hasGroups) {
    return <div>Column grouping is not enabled</div>;
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  /** Renders a single logical record (possibly multiple <tr> elements). */
  const renderRecord = (pos: number, recordIndexInPage: number) => {
    // `pos` is a position in filteredSortedIndices; `recordIndexInPage` drives alternation.
    return Array.from({ length: maxFieldDepth }, (_, fieldDepth) => (
      <tr
        key={`${pos}-${fieldDepth}`}
        className={cx(styles.dataRow, recordIndexInPage % 2 === 0 && styles.dataRowEven)}
      >
        {cellPlanByDepth[fieldDepth].map(
          ({ colIndex, field: filteredField, colSpan, rowSpan, isPlaceholder }: CellPlan) => {
            if (isPlaceholder) {
              return (
                <td
                  key={`${fieldDepth}-${colIndex}-empty`}
                  className={styles.dataCell}
                  colSpan={colSpan}
                />
              );
            }

            if (!filteredField) {
              return null;
            }

            const originalRowIndex = filteredSortedIndices[pos];
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

            const links = filteredField.getLinks
              ? filteredField.getLinks({ valueRowIndex: originalRowIndex })
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
    ));
  };

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.container} style={{ height }}>
      <div className={styles.tableScroll} ref={scrollContainerRef}>
        <table className={styles.table}>
          {/*
           * <colgroup> is the single source of truth for column widths with
           * table-layout:fixed.  During resize we write directly to the matching
           * <col> element so that the full column updates instantly without any
           * React re-render.
           */}
          <colgroup>
            {columns.map((_, i) => {
              const w = columnWidths.get(i);
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
                            wrapHeaderText ? styles.headerCellWrap : styles.headerCellNoWrap,
                            cell.isSortable && styles.headerCellClickable
                          )}
                          onClick={() => cell.isSortable && handleHeaderClick(cell)}
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
                            {cell.isFilterable && cell.field && (
                              <Filter
                                name={getDisplayName(cell.field)}
                                data={data}
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
            {/* Top spacer — compensates for records rendered above the virtual window */}
            {virtualWindow.topSpacerPx > 0 && (
              <tr style={{ height: virtualWindow.topSpacerPx }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}

            {/* Visible records only */}
            {pageRowIndices
              .slice(virtualWindow.startIndex, virtualWindow.endIndex)
              .flatMap((pos, visibleIdx) =>
                renderRecord(pos, virtualWindow.startIndex + visibleIdx)
              )}

            {/* Bottom spacer — compensates for records rendered below the virtual window */}
            {virtualWindow.bottomSpacerPx > 0 && (
              <tr style={{ height: virtualWindow.bottomSpacerPx }}>
                <td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
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
