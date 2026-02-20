import React from 'react';
import { css } from '@emotion/css';
import { Button } from '@grafana/ui';

import { ActionCellProps, TableCellStyles } from '../types';

export const ActionsCell = ({ field, rowIdx, getActions }: ActionCellProps) => {
  const actions = getActions(field, rowIdx);

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      {actions.map((action, i) => (
        <Button
          key={i}
          onClick={action.onClick}
          variant="secondary"
          size="sm"
        >
          {action.title || 'Action'}
        </Button>
      ))}
    </>
  );
};

export const getStyles: TableCellStyles = (theme) => css({ gap: theme.spacing(0.75) });
