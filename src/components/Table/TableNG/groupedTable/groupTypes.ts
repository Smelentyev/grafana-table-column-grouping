import { Field } from '@grafana/data';

/**
 * A single cell descriptor in the thead matrix.
 * Produced by groupHeaderPipeline and consumed by the header renderer.
 */
export interface HeaderCell {
  name: string;
  colSpan: number;
  rowSpan: number;
  level: number;
  /** Column index into the parallel `columns: ColumnInfo[]` array. */
  columnIndex: number;
  field?: Field;
  /** True only for leaf cells associated with a data field (sortable). */
  isSortable: boolean;
  /** Controlled by field.config.filterable or field.config.custom.filterable. */
  isFilterable: boolean;
}
