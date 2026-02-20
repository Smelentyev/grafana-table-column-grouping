import React, { FormEvent } from 'react';

import { TableMarkdownCellOptions } from '@grafana/schema';
import { Badge, Field, Switch } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const MarkdownCellOptionsEditor = ({
  cellOptions,
  onChange,
}: TableCellEditorProps<TableMarkdownCellOptions>) => {
  const onDynamicHeightChange = (e: FormEvent<HTMLInputElement>) => {
    onChange({ ...cellOptions, dynamicHeight: e.currentTarget.checked });
  };

  return (
    <Field
      label={
        <span>
          Dynamic height{' '}
          <Badge
            text="Alpha"
            color="blue"
            style={{ fontSize: '11px', marginLeft: '5px', lineHeight: '1.2' }}
          />
        </span>
      }
      description="We recommend enabling pagination with this option to avoid performance issues."
    >
      <Switch onChange={onDynamicHeightChange} value={cellOptions.dynamicHeight} />
    </Field>
  );
};
