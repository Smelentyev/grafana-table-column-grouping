import { ColumnGroupingSettings } from './components/Table/TableNG/types';
import { Options as GeneratedOptions } from './panelcfg.gen';

/**
 * Default settings for column grouping feature
 */
export const defaultColumnGroupingSettings: ColumnGroupingSettings = {
  enabled: false,
  ungroupedColumns: [],
  rootGroups: [],
};

/**
 * Extended options interface that includes column grouping
 */
export interface ExtendedOptions extends GeneratedOptions {
  columnGrouping?: ColumnGroupingSettings;
  paginationEnabled?: boolean;
  paginationPageSize?: number;
}
