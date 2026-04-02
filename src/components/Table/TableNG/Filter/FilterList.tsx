import React, { useCallback, useMemo } from 'react';
import { css } from '@emotion/css';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, useTheme2, Checkbox, Label, Stack } from '@grafana/ui';

import { operatorSelectableValues } from './FilterPopup';
import { getMatchingFilterOptions } from './utils';

interface Props {
  values: SelectableValue[];
  options: SelectableValue[];
  onChange: (options: SelectableValue[]) => void;
  caseSensitive?: boolean;
  searchFilter: string;
  operator: SelectableValue<string>;
}

const ITEM_HEIGHT = 28;
const MIN_HEIGHT = ITEM_HEIGHT * 4.5; // split an item in the middle to imply there are more items to scroll

export const REGEX_OPERATOR = operatorSelectableValues['Contains'];

export const FilterList = ({ options, values, caseSensitive, onChange, searchFilter, operator }: Props) => {
  const items = useMemo(
    () => getMatchingFilterOptions(options, searchFilter, operator.value, caseSensitive),
    [options, caseSensitive, operator.value, searchFilter]
  );
  const selectedItems = useMemo(() => items.filter((item) => values.includes(item)), [items, values]);

  const selectCheckValue = useMemo(() => items.length === selectedItems.length, [items, selectedItems]);
  const selectCheckIndeterminate = useMemo(
    () => selectedItems.length > 0 && items.length > selectedItems.length,
    [items, selectedItems]
  );
  const selectCheckLabel = useMemo(() => {
    if (!values.length) {
      return 'Select all';
    }
    if (values.length !== selectedItems.length) {
      return `${values.length} selected (${values.length - selectedItems.length} hidden)`;
    }
    return `${values.length} selected`;
  }, [selectedItems.length, values.length]);
  const selectCheckDescription = useMemo(
    () =>
      items.length !== selectedItems.length
        ? 'Add all displayed values to the filter'
        : 'Remove all displayed values from the filter',
    [items, selectedItems]
  );

  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const gutter = theme.spacing.gridSize / 2;
  const height = useMemo(() => Math.min(items.length * ITEM_HEIGHT, MIN_HEIGHT) + gutter, [gutter, items.length]);

  const onCheckedChanged = useCallback(
    (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => {
      const newValues = event.currentTarget.checked
        ? values.concat(option)
        : values.filter((c) => c.value !== option.value);

      onChange(newValues);
    },
    [onChange, values]
  );

  const onSelectChanged = useCallback(() => {
    if (items.length === selectedItems.length) {
      const newValues = values.filter((item) => !items.includes(item));
      onChange(newValues);
    } else {
      const newValues = [...new Set([...values, ...items])];
      onChange(newValues);
    }
  }, [onChange, values, items, selectedItems]);

  return (
    <Stack direction="column">
      {items.length > 0 ? (
        <>
          <List
            height={height}
            itemCount={items.length}
            itemSize={ITEM_HEIGHT}
            itemData={{ items, values: selectedItems, onCheckedChanged, className: styles.filterListRow }}
            width="100%"
            className={styles.filterList}
          >
            {ItemRenderer}
          </List>
          <div
            className={styles.filterListRow}
            data-testid="table-filter-select-all"
          >
            <Checkbox
              value={selectCheckValue}
              indeterminate={selectCheckIndeterminate}
              label={selectCheckLabel}
              description={selectCheckDescription}
              onChange={onSelectChanged}
            />
          </div>
        </>
      ) : (
        <Label className={styles.noValuesLabel}>
          No values
        </Label>
      )}
    </Stack>
  );
};

interface ItemRendererProps {
  index: number;
  style: React.CSSProperties;
  data: {
    onCheckedChanged: (option: SelectableValue) => (event: React.FormEvent<HTMLInputElement>) => void;
    items: SelectableValue[];
    values: SelectableValue[];
    className: string;
  };
}

function ItemRenderer({ index, style, data: { onCheckedChanged, items, values, className } }: ItemRendererProps) {
  const option = items[index];
  const { value, label } = option;
  const isChecked = values.find((s) => s.value === value) !== undefined;

  return (
    <div className={className} style={style} title={label}>
      <Checkbox value={isChecked} label={label} onChange={onCheckedChanged(option)} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  filterList: css({
    label: 'filterList',
    marginBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  filterListRow: css({
    label: 'filterListRow',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    padding: theme.spacing(0.5),

    ':hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  noValuesLabel: css({
    paddingTop: theme.spacing(1),
  }),
});
