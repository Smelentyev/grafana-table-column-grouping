import React, { FormEvent, useId } from 'react';

import { TableImageCellOptions } from '@grafana/schema';
import { Field, Input } from '@grafana/ui';

import { TableCellEditorProps } from '../TableCellOptionEditor';

export const ImageCellOptionsEditor = ({ cellOptions, onChange }: TableCellEditorProps<TableImageCellOptions>) => {
  const onAltChange = (e: FormEvent<HTMLInputElement>) => {
    onChange({ ...cellOptions, alt: e.currentTarget.value });
  };

  const onTitleChange = (e: FormEvent<HTMLInputElement>) => {
    onChange({ ...cellOptions, title: e.currentTarget.value });
  };

  const altTextInputId = useId();
  const titleTextInputId = useId();

  return (
    <>
      <Field
        label="Alt text"
        description="Alternative text that will be displayed if an image can't be displayed or for users who use a screen reader"
      >
        <Input id={altTextInputId} onChange={onAltChange} defaultValue={cellOptions.alt} />
      </Field>

      <Field
        label="Title text"
        description="Text that will be displayed when the image is hovered by a cursor"
      >
        <Input id={titleTextInputId} onChange={onTitleChange} defaultValue={cellOptions.title} />
      </Field>
    </>
  );
};
