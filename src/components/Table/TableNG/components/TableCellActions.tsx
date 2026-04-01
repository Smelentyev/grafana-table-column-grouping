import React, { memo } from 'react';

import { IconButton } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellActionsProps } from '../types';
import { buildInspectValue } from '../utils';

export const TableCellActions = memo(
  ({ field, value, setInspectCell, onCellFilterAdded, className, cellInspect, showFilters }: TableCellActionsProps) => (
    // stopping propagation to prevent clicks within the actions menu from triggering the cell click events
    // for things like the data links tooltip.
    <div className={className} data-role="cell-actions" onClick={(ev) => ev.stopPropagation()}>
      {cellInspect && (
        <IconButton
          name="eye"
          aria-label={'Inspect value'}
          onClick={() => {
            const [inspectValue, mode] = buildInspectValue(value, field);
            setInspectCell({ value: inspectValue, mode });
          }}
        />
      )}
      {showFilters && (
        <>
          <IconButton
            name={'filter-plus'}
            aria-label={'Filter for value'}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_FOR_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
          <IconButton
            name={'filter-minus'}
            aria-label={'Filter out value'}
            onClick={() => {
              onCellFilterAdded?.({
                key: field.name,
                operator: FILTER_OUT_OPERATOR,
                value: String(value ?? ''),
              });
            }}
          />
        </>
      )}
    </div>
  )
);
TableCellActions.displayName = 'TableCellActions';
