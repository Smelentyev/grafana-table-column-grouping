import React, { useState } from 'react';
import { css } from '@emotion/css';
import { merge } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellOptions } from '@grafana/schema';
import { Combobox, ComboboxOption, Field, TableCellDisplayMode, useStyles2 } from '@grafana/ui';

import { BarGaugeCellOptionsEditor } from './cells/BarGaugeCellOptionsEditor';
import { ColorBackgroundCellOptionsEditor } from './cells/ColorBackgroundCellOptionsEditor';
import { ImageCellOptionsEditor } from './cells/ImageCellOptionsEditor';
import { MarkdownCellOptionsEditor } from './cells/MarkdownCellOptionsEditor';
import { SparklineCellOptionsEditor } from './cells/SparklineCellOptionsEditor';

// The props that any cell type editor are expected
// to handle. In this case the generic type should
// be a discriminated interface of TableCellOptions
export interface TableCellEditorProps<T> {
  cellOptions: T;
  onChange: (value: T) => void;
}

interface Props {
  value: TableCellOptions;
  onChange: (v: TableCellOptions) => void;
  id?: string;
}

export const TableCellOptionEditor = ({ value, onChange, id }: Props) => {
  const cellType = value.type;
  const styles = useStyles2(getStyles);
  const cellDisplayModeOptions: Array<ComboboxOption<TableCellOptions['type']>> = [
    { value: TableCellDisplayMode.Auto, label: 'Auto' },
    { value: TableCellDisplayMode.ColorText, label: 'Colored text' },
    {
      value: TableCellDisplayMode.ColorBackground,
      label: 'Colored background',
    },
    { value: TableCellDisplayMode.DataLinks, label: 'Data links' },
    { value: TableCellDisplayMode.Gauge, label: 'Gauge' },
    { value: TableCellDisplayMode.Sparkline, label: 'Sparkline' },
    { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
    { value: TableCellDisplayMode.Pill, label: 'Pill' },
    { value: TableCellDisplayMode.Markdown, label: 'Markdown + HTML' },
    { value: TableCellDisplayMode.Image, label: 'Image' },
    { value: TableCellDisplayMode.Actions, label: 'Actions' },
  ];
  const currentMode = cellDisplayModeOptions.find((o) => o.value === cellType)!;

  let [settingCache, setSettingCache] = useState<Record<string, TableCellOptions>>({});

  // Update display mode on change
  const onCellTypeChange = (v: ComboboxOption<TableCellOptions['type']>) => {
    if (v !== null) {
      // Set the new type of cell starting
      // with default settings
      value = { type: v.value };

      // When changing cell type see if there were previously stored
      // settings and merge those with the changed value
      if (settingCache[value.type] !== undefined && Object.keys(settingCache[value.type]).length > 1) {
        value = merge({}, value, settingCache[value.type]);
      }

      onChange(value);
    }
  };

  // When options for a cell change we merge
  // any option changes with our options object
  const onCellOptionsChange = (options: TableCellOptions) => {
    settingCache[value.type] = merge({}, value, options);
    setSettingCache(settingCache);
    onChange(settingCache[value.type]);
  };

  // Setup and inject editor
  return (
    <div className={styles.fixBottomMargin}>
      <Field>
        <Combobox id={id} options={cellDisplayModeOptions} value={currentMode} onChange={onCellTypeChange} />
      </Field>
      {cellType === TableCellDisplayMode.Gauge && (
        <BarGaugeCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.ColorBackground && (
        <ColorBackgroundCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.Sparkline && (
        <SparklineCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.Image && (
        <ImageCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
      {cellType === TableCellDisplayMode.Markdown && (
        <MarkdownCellOptionsEditor cellOptions={value} onChange={onCellOptionsChange} />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fixBottomMargin: css({
    position: 'relative',
    marginBottom: theme.spacing(-2),
  }),
});
