import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Icon } from '@grafana/ui';
import { RowExpanderNGProps } from '../types';

export function RowExpander({ onCellExpand, isExpanded }: RowExpanderNGProps) {
  const styles = useStyles2(getStyles);
  function handleKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onCellExpand(e);
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.expanderCell}
      onClick={onCellExpand}
      onKeyDown={handleKeyDown}
      data-testid="table-row-expander"
    >
      <Icon
        aria-label={
          isExpanded
            ? 'Collapse row'
            : 'Expand row'
        }
        aria-expanded={isExpanded}
        name={isExpanded ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}

const getStyles = (_theme: GrafanaTheme2) => ({
  expanderCell: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    cursor: 'pointer',
  }),
});
