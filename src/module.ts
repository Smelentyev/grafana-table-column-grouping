import { PanelPlugin, standardEditorsRegistry, identityOverrideProcessor, FieldConfigProperty } from '@grafana/data';
import {
  defaultTableFieldOptions,
  TableCellOptions,
  TableCellDisplayMode,
  TableCellTooltipPlacement,
} from '@grafana/schema';

import { PaginationEditor } from './components/PaginationEditor';
import { TableCellOptionEditor } from './components/TableCellOptionEditor';
import { TablePanel } from './components/TablePanel';
import { defaultOptions, FieldConfig } from './panelcfg.gen';
import { ColumnGroupingEditorV2 } from './components/editors/ColumnGroupingEditorV2';
import { ExtendedOptions, defaultColumnGroupingSettings } from './types';

export const plugin = new PanelPlugin<ExtendedOptions, FieldConfig>(TablePanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      const category = ['Table'];
      const cellCategory = ['Cell options'];
      builder
        .addNumberInput({
          path: 'minWidth',
          name: 'Minimum column width',
          category,
          description: 'The minimum width for column auto resizing',
          settings: {
            placeholder: '150',
            min: 50,
            max: 500,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.minWidth,
        })
        .addNumberInput({
          path: 'width',
          name: 'Column width',
          category,
          settings: {
            placeholder: 'auto',
            min: 20,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.width,
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
          category,
          settings: {
            options: [
              { label: 'Auto', value: 'auto' },
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
          defaultValue: defaultTableFieldOptions.align,
        })
        .addBooleanSwitch({
          path: 'filterable',
          name: 'Column filter',
          category,
          description: 'Enables/disables field filters in table',
          defaultValue: defaultTableFieldOptions.filterable,
        })
        .addBooleanSwitch({
          path: 'wrapText',
          name: 'Wrap text',
          category,
        })
        .addBooleanSwitch({
          path: 'wrapHeaderText',
          name: 'Wrap header text',
          category,
        })
        .addBooleanSwitch({
          path: 'hideFrom.viz',
          name: 'Hide in table',
          category,
          defaultValue: undefined,
          hideFromDefaults: true,
        })
        .addCustomEditor({
          id: 'footer.reducers',
          category: ['Table footer'],
          path: 'footer.reducers',
          name: 'Calculation',
          description: 'Choose a reducer function / calculation',
          editor: standardEditorsRegistry.get('stats-picker').editor,
          override: standardEditorsRegistry.get('stats-picker').editor,
          defaultValue: [],
          process: identityOverrideProcessor,
          shouldApply: () => true,
          settings: {
            allowMultiple: true,
          },
        })
        .addCustomEditor<void, TableCellOptions>({
          id: 'cellOptions',
          path: 'cellOptions',
          name: 'Cell type',
          editor: TableCellOptionEditor,
          override: TableCellOptionEditor,
          defaultValue: defaultTableFieldOptions.cellOptions,
          process: identityOverrideProcessor,
          category: cellCategory,
          shouldApply: () => true,
        })
        .addBooleanSwitch({
          path: 'inspect',
          name: 'Cell value inspect',
          description: 'Enable cell value inspection in a modal window',
          defaultValue: false,
          category: cellCategory,
          showIf: (cfg) => {
            return (
              cfg.cellOptions.type === TableCellDisplayMode.Auto ||
              cfg.cellOptions.type === TableCellDisplayMode.JSONView ||
              cfg.cellOptions.type === TableCellDisplayMode.ColorText ||
              cfg.cellOptions.type === TableCellDisplayMode.ColorBackground
            );
          },
        })
        .addFieldNamePicker({
          path: 'tooltip.field',
          name: 'Tooltip from field',
          description: 'Render a cell from a field (hidden or visible) in a tooltip',
          category: cellCategory,
        })
        .addSelect({
          path: 'tooltip.placement',
          name: 'Tooltip placement',
          category: cellCategory,
          settings: {
            options: [
              {
                label: 'Auto',
                value: TableCellTooltipPlacement.Auto,
              },
              {
                label: 'Top',
                value: TableCellTooltipPlacement.Top,
              },
              {
                label: 'Right',
                value: TableCellTooltipPlacement.Right,
              },
              {
                label: 'Bottom',
                value: TableCellTooltipPlacement.Bottom,
              },
              {
                label: 'Left',
                value: TableCellTooltipPlacement.Left,
              },
            ],
          },
          showIf: (cfg) => cfg.tooltip?.field !== undefined,
        })
        .addFieldNamePicker({
          path: 'styleField',
          name: 'Styling from field',
          description: 'A field containing JSON objects with CSS properties',
          category: cellCategory,
        });
    },
  })
  .setPanelOptions((builder) => {
    const category = ['Table'];
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show table header',
        category,
        defaultValue: defaultOptions.showHeader,
      })
      .addNumberInput({
        path: 'maxRowHeight',
        name: 'Max row height',
        category,
        settings: {
          placeholder: 'none',
          min: 0,
        },
      })
      .addCustomEditor({
        id: 'enablePagination',
        path: 'enablePagination',
        name: 'Enable pagination',
        category,
        editor: PaginationEditor,
        defaultValue: defaultOptions?.enablePagination,
      })
      .addNumberInput({
        path: 'paginationPageSize',
        name: 'Rows per page',
        category,
        description: 'How many rows to show on one page when pagination is enabled',
        settings: {
          placeholder: '100',
          min: 1,
        },
        defaultValue: 100,
        showIf: (cfg) => Boolean(cfg.enablePagination),
      })
      .addCustomEditor({
        id: 'columnGrouping',
        path: 'columnGrouping',
        name: 'Column Grouping',
        description: 'Configure multi-level column headers with hierarchical grouping',
        category: ['Table Display'],
        editor: ColumnGroupingEditorV2,
        defaultValue: defaultColumnGroupingSettings,
      });
  });
