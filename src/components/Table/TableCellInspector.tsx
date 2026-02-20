import React, { useState } from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Drawer, ClipboardButton, CodeEditor } from '@grafana/ui';

export enum TableCellInspectorMode {
  code = 'code',
  text = 'text',
}

interface TableCellInspectorProps {
  value: unknown;
  onDismiss: () => void;
  mode: TableCellInspectorMode;
}

const toString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  return value?.toString?.() ?? '';
};

export function TableCellInspector({ value, onDismiss, mode }: TableCellInspectorProps) {
  const [currentMode, setMode] = useState(mode);
  const text = toString(value).trim();
  const styles = useStyles2(getStyles);

  const changeTabs = () => {
    setMode(currentMode === TableCellInspectorMode.text ? TableCellInspectorMode.code : TableCellInspectorMode.text);
  };

  return (
    <Drawer onClose={onDismiss} title={'Inspect value'}>
      <div className={styles.container}>
        <div className={styles.toolbar}>
          <button
            onClick={changeTabs}
            className={styles.tabButton}
          >
            {currentMode === 'code' ? 'Switch to Plain Text' : 'Switch to Code Editor'}
          </button>
          <ClipboardButton icon="copy" getText={() => text}>
            Copy to Clipboard
          </ClipboardButton>
        </div>
        {currentMode === 'code' ? (
          <CodeEditor
            width="100%"
            height={500}
            language="json"
            showLineNumbers={true}
            showMiniMap={(text ? text.length : 0) > 100}
            value={text}
            readOnly={true}
          />
        ) : (
          <pre className={styles.textContainer}>{text}</pre>
        )}
      </div>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  }),
  toolbar: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(2),
  }),
  tabButton: css({
    padding: theme.spacing(1, 2),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.background.canvas,
    },
  }),
  textContainer: css({
    color: theme.colors.text.secondary,
    minHeight: 42,
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    overflow: 'auto',
  }),
});
