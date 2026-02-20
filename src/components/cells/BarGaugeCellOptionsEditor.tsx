import React from 'react';
import { SelectableValue } from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeValueMode, TableBarGaugeCellOptions } from '@grafana/schema';
import { Field, RadioButtonGroup, Stack } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

type Props = TableCellEditorProps<TableBarGaugeCellOptions>;

export function BarGaugeCellOptionsEditor({ cellOptions, onChange }: Props) {
  // Set the display mode on change

  const onCellOptionsChange = (v: BarGaugeDisplayMode) => {
    onChange({ ...cellOptions, mode: v });
  };

  const onValueModeChange = (v: BarGaugeValueMode) => {
    onChange({ ...cellOptions, valueDisplayMode: v });
  };

  return (
    <Stack direction="column" gap={0}>
      <Field label="Gauge display mode">
        <RadioButtonGroup
          value={cellOptions?.mode ?? BarGaugeDisplayMode.Gradient}
          onChange={onCellOptionsChange}
          options={barGaugeOpts}
        />
      </Field>
      <Field label="Value display">
        <RadioButtonGroup
          value={cellOptions?.valueDisplayMode ?? BarGaugeValueMode.Text}
          onChange={onValueModeChange}
          options={valueModes}
        />
      </Field>
    </Stack>
  );
}

const barGaugeOpts: SelectableValue[] = [
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
];

const valueModes: SelectableValue[] = [
  { value: BarGaugeValueMode.Color, label: 'Value color' },
  { value: BarGaugeValueMode.Text, label: 'Text color' },
  { value: BarGaugeValueMode.Hidden, label: 'Hidden' },
];
