import * as React from 'react';
import { css } from '@emotion/css';

import { StandardEditorProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { InlineField, Switch, useStyles2 } from '@grafana/ui';

export function PaginationEditor({ onChange, value, id }: StandardEditorProps<boolean>) {
  const styles = useStyles2(getStyles);

  const changeValue = (event: React.FormEvent<HTMLInputElement> | React.ChangeEvent<HTMLInputElement> | undefined) => {
    const nextValue = Boolean(event?.currentTarget?.checked);
    onChange(nextValue);
  };

  return (
    <div className={styles.wrapper}>
      <InlineField
        label={selectors.components.PanelEditor.OptionsPane.fieldLabel(`Enable pagination`)}
        labelWidth="auto"
        grow
      >
        <Switch
          id={id}
          value={Boolean(value)}
          checked={Boolean(value)}
          onChange={changeValue}
        />
      </InlineField>
      <div className={styles.debugValue}>Current value: {String(Boolean(value))}</div>
    </div>
  );
}

const getStyles = () => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  debugValue: css`
    font-size: 12px;
    opacity: 0.75;
  `,
});
