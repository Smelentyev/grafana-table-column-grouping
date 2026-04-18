import React from 'react';
import { css } from '@emotion/css';

import {
  FieldConfig,
  getMinMaxAndDelta,
  Field,
  isDataFrameWithValue,
  formattedValueToString,
  GrafanaTheme2,
} from '@grafana/data';
import {
  BarAlignment,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  TableSparklineCellOptions,
  TableCellDisplayMode,
  VisibilityMode,
} from '@grafana/schema';
import { Sparkline } from '@grafana/ui';

// Simple measureText utility
const measureText = (text: string, theme: GrafanaTheme2): { width: number; height: number } => {
  const fontSize = Number.parseInt(String(theme.typography.body.fontSize), 10) || 16;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = `${fontSize}px ${theme.typography.fontFamily}`;
    const metrics = context.measureText(text);
    return { width: metrics.width, height: fontSize };
  }
  return { width: text.length * fontSize * 0.6, height: fontSize };
};
import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { SparklineCellProps, TableCellStyles } from '../types';
import { getAlignmentFactor, getCellOptions, prepareSparklineValue } from '../utils';

export const defaultSparklineCellConfig: TableSparklineCellOptions = {
  type: TableCellDisplayMode.Sparkline,
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Smooth,
  lineWidth: 1,
  fillOpacity: 17,
  gradientMode: GraphGradientMode.Hue,
  pointSize: 2,
  barAlignment: BarAlignment.Center,
  showPoints: VisibilityMode.Never,
  hideValue: false,
};

export const SparklineCell = (props: SparklineCellProps) => {
  const { field, value, theme, timeRange, rowIdx, width } = props;
  const sparkline = prepareSparklineValue(value, field);

  if (!sparkline) {
    return (
      <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
        {field.config.noValue || 'no data'}
      </MaybeWrapWithLink>
    );
  }

  // Get the step from the first two values to null-fill the x-axis based on timerange
  if (sparkline.x && !sparkline.x.config.interval && sparkline.x.values.length > 1) {
    sparkline.x.config.interval = sparkline.x.values[1] - sparkline.x.values[0];
  }

  // Remove non-finite values, e.g: NaN, +/-Infinity
  sparkline.y.values = sparkline.y.values.map((v) => {
    if (!Number.isFinite(v)) {
      return null;
    } else {
      return v;
    }
  });

  const range = getMinMaxAndDelta(sparkline.y);
  sparkline.y.config.min = range.min;
  sparkline.y.config.max = range.max;
  sparkline.y.state = { range };
  sparkline.timeRange = timeRange;

  const cellOptions = getTableSparklineCellOptions(field);

  const config: FieldConfig<GraphFieldConfig> = {
    color: field.config.color,
    custom: {
      ...defaultSparklineCellConfig,
      ...cellOptions,
    },
  };

  const hideValue = cellOptions.hideValue;
  let valueWidth = 0;
  let valueElement: React.ReactNode = null;
  if (!hideValue) {
    const newValue = isDataFrameWithValue(value) ? value.value : null;
    const displayValue = field.display!(newValue);
    const alignmentFactor = getAlignmentFactor(field, displayValue, rowIdx!);

    valueWidth =
      measureText(`${alignmentFactor.prefix ?? ''}${alignmentFactor.text}${alignmentFactor.suffix ?? ''}`, theme).width +
      theme.spacing.gridSize;

    const formattedValue = formattedValueToString(displayValue);
    valueElement = <span style={{ width: valueWidth, color: displayValue.color }}>{formattedValue}</span>;
  }

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {valueElement}
      <Sparkline width={width - valueWidth} height={25} sparkline={sparkline} config={config} theme={theme} />
    </MaybeWrapWithLink>
  );
};

function getTableSparklineCellOptions(field: Field): TableSparklineCellOptions {
  let options = getCellOptions(field);
  if (options.type === TableCellDisplayMode.Auto) {
    options = { ...options, type: TableCellDisplayMode.Sparkline };
  }
  if (options.type === TableCellDisplayMode.Sparkline) {
    return options;
  }
  throw new Error(`Expected options type ${TableCellDisplayMode.Sparkline} but got ${options.type}`);
}

export const getStyles: TableCellStyles = (theme, { textAlign }) =>
  css({
    '&, & > a': {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      ...(textAlign === 'right' && { flexDirection: 'row-reverse' }),
    },
  });
