import React, { useCallback, useMemo, useEffect } from 'react';
import { css } from '@emotion/css';

import {
  ActionModel,
  DashboardCursorSync,
  DataFrame,
  FieldMatcherID,
  GrafanaTheme2,
  getFrameDisplayName,
  InterpolateFunction,
  PanelProps,
  SelectableValue,
  Field,
  cacheFieldDisplayNames,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { Select, usePanelContext, useStyles2, useTheme2 } from '@grafana/ui';

import { TableSortByFieldState, ColumnGroupingSettings } from './Table/TableNG/types';
import { TableNG } from './Table/TableNG/TableNG';
import { ExtendedOptions, defaultColumnGroupingSettings } from '../types';

interface Props extends PanelProps<ExtendedOptions> {}

export function TablePanel(props: Props) {
  const { data, height, width, options, fieldConfig, id, timeRange, replaceVariables, transparent } = props;

  useEffect(() => {
    cacheFieldDisplayNames(data.series);
  }, [data.series]);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const panelContext = usePanelContext();
  const userCanExecuteActions = useMemo(() => panelContext.canExecuteActions?.() ?? false, [panelContext]);
  const _getActions = useCallback(
    (frame: DataFrame, field: Field, rowIndex: number) =>
      userCanExecuteActions ? getCellActions(frame, field, rowIndex, replaceVariables) : [],
    [replaceVariables, userCanExecuteActions]
  );
  const frames = data.series;
  const count = frames?.length;
  const hasFields = frames.some((frame) => frame.fields.length > 0);
  const currentIndex = getCurrentFrameIndex(frames, options);
  const main = frames[currentIndex];

  let tableHeight = height;

  if (!count || !hasFields) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (count > 1) {
    const inputHeight = theme.spacing.gridSize * theme.components.height.md;
    const padding = theme.spacing.gridSize;

    tableHeight = height - inputHeight - padding;
  }

  const enableSharedCrosshair = panelContext.sync && panelContext.sync() !== DashboardCursorSync.Off;

  const disableSanitizeHtml = config.disableSanitizeHtml;

  const columnGrouping: ColumnGroupingSettings = options.columnGrouping ?? defaultColumnGroupingSettings;

  const tableElement = (
    <TableNG
      height={tableHeight}
      width={width}
      data={main}
      noHeader={!options.showHeader}
      showTypeIcons={options.showTypeIcons}
      resizable={true}
      initialSortBy={options.sortBy}
      onSortByChange={(sortBy) => onSortByChange(sortBy, props)}
      onColumnResize={(displayName, resizedWidth) => onColumnResize(displayName, resizedWidth, props)}
      onCellFilterAdded={panelContext.onAddAdHocFilter}
      frozenColumns={options.frozenColumns?.left}
      enablePagination={options.enablePagination}
      cellHeight={options.cellHeight}
      maxRowHeight={options.maxRowHeight}
      timeRange={timeRange}
      enableSharedCrosshair={config.featureToggles.tableSharedCrosshair && enableSharedCrosshair}
      fieldConfig={fieldConfig}
      getActions={_getActions}
      structureRev={data.structureRev}
      transparent={transparent}
      disableSanitizeHtml={disableSanitizeHtml}
      disableKeyboardEvents={options.disableKeyboardEvents}
      columnGrouping={columnGrouping}
    />
  );

  if (count === 1) {
    return tableElement;
  }

  const names = frames.map((frame, index) => {
    return {
      label: getFrameDisplayName(frame),
      value: index,
    };
  });

  return (
    <div className={styles.wrapper}>
      {tableElement}
      <div className={styles.selectWrapper}>
        <Select
          tabIndex={options.disableKeyboardEvents ? -1 : 0}
          options={names}
          value={names[currentIndex]}
          onChange={(val) => onChangeTableSelection(val, props)}
        />
      </div>
    </div>
  );
}

function getCurrentFrameIndex(frames: DataFrame[], options: ExtendedOptions) {
  return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}

function onColumnResize(fieldDisplayName: string, width: number, props: Props) {
  const { fieldConfig } = props;
  const { overrides } = fieldConfig;

  const matcherId = FieldMatcherID.byName;
  const propId = 'custom.width';

  // look for existing override
  const override = overrides.find((o) => o.matcher.id === matcherId && o.matcher.options === fieldDisplayName);

  if (override) {
    // look for existing property
    const property = override.properties.find((prop) => prop.id === propId);
    if (property) {
      property.value = width;
    } else {
      override.properties.push({ id: propId, value: width });
    }
  } else {
    overrides.push({
      matcher: { id: matcherId, options: fieldDisplayName },
      properties: [{ id: propId, value: width }],
    });
  }

  props.onFieldConfigChange({
    ...fieldConfig,
    overrides,
  });
}

function onSortByChange(sortBy: TableSortByFieldState[], props: Props) {
  props.onOptionsChange({
    ...props.options,
    sortBy,
  });
}

function onChangeTableSelection(val: SelectableValue<number>, props: Props) {
  props.onOptionsChange({
    ...props.options,
    frameIndex: val.value || 0,
  });
}

const getCellActions = (
  _dataFrame: DataFrame,
  field: Field,
  _rowIndex: number,
  _replaceVariables: InterpolateFunction | undefined
): Array<ActionModel<Field>> => {
  // Return empty array as actions are not fully implemented yet
  // In a full implementation, this would convert field.config.actions to ActionModel format
  return [];
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  }),
  selectWrapper: css({
    padding: theme.spacing(1, 1, 0, 1),
  }),
});
