import { css } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, useTheme2, Button, ClickOutsideWrapper, FilterInput, Label, Stack, Select } from '@grafana/ui';
import { FilterType } from '../types';
import { getDisplayName } from '../utils';

import { FilterList } from './FilterList';
import { calculateUniqueFieldValuesCached, getFilteredOptions, valuesToOptions } from './utils';

export const operatorSelectableValues: { [key: string]: SelectableValue<string> } = {
  Contains: { label: 'Contains', value: 'Contains', description: 'Contains' },
  '=': { label: '=', value: '=', description: 'Equals' },
  '!=': { label: '!=', value: '!=', description: 'Not equals' },
  '>': { label: '>', value: '>', description: 'Greater' },
  '>=': { label: '>=', value: '>=', description: 'Greater or Equal' },
  '<': { label: '<', value: '<', description: 'Less' },
  '<=': { label: '<=', value: '<=', description: 'Less or Equal' },
  Expression: {
    label: 'Expression',
    value: 'Expression',
    description: 'Bool Expression (Char $ represents the column value in the expression, e.g. "$ >= 10 && $ <= 12")',
  },
};
const OPERATORS = Object.values(operatorSelectableValues);

interface Props {
  name: string;
  indices: number[];
  filterValue?: Array<SelectableValue<unknown>>;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  onClose: () => void;
  field?: Field;
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  operator: SelectableValue<string>;
  setOperator: (item: SelectableValue<string>) => void;
}

export const FilterPopup = ({
  name,
  indices,
  filterValue,
  setFilter,
  onClose,
  field,
  searchFilter,
  setSearchFilter,
  operator,
  setOperator,
}: Props) => {
  const theme = useTheme2();
  const uniqueValues = useMemo(() => calculateUniqueFieldValuesCached(indices, field), [indices, field]);
  const options = useMemo(() => valuesToOptions(uniqueValues), [uniqueValues]);
  const filteredOptions = useMemo(() => getFilteredOptions(options, filterValue), [options, filterValue]);
  const [values, setValues] = useState<SelectableValue[]>(filteredOptions);
  const [matchCase, setMatchCase] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onCancel = useCallback((event?: React.MouseEvent) => onClose(), [onClose]);

  const onFilter = useCallback(
    (event: React.MouseEvent) => {
      if (values.length !== 0) {
        // create a Set for faster filtering
        const filteredSet = new Set(values.map((item) => item.value));

        setFilter((filter: FilterType) => ({
          ...filter,
          [name]: { filtered: values, filteredSet, searchFilter, operator },
        }));
      } else {
        setFilter((filter: FilterType) => {
          const newFilter = { ...filter };
          delete newFilter[name];
          return newFilter;
        });
      }
      onClose();
    },
    [name, searchFilter, operator, setFilter, values, onClose]
  );

  const onClearFilter = useCallback(
    (event: React.MouseEvent) => {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[name];
        return newFilter;
      });
      onClose();
    },
    [name, setFilter, onClose]
  );

  const filterInputPlaceholder = 'Filter values';
  const clearFilterVisible = useMemo(() => filterValue !== undefined, [filterValue]);
  const styles = useStyles2(getStyles);

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      {/* This is just blocking click events from bubbeling and should not have a keyboard interaction. */}
      <div
        className={styles.filterContainer}
        onClick={stopPropagation}
        ref={containerRef}
      >
        <Stack direction="column">
          <Stack alignItems="center">{field && <Label className={styles.label}>{getDisplayName(field)}</Label>}</Stack>

          <Stack gap={1}>
            <div className={styles.inputContainer}>
              <FilterInput
                placeholder={filterInputPlaceholder}
                title={filterInputPlaceholder}
                onChange={setSearchFilter}
                value={searchFilter}
              />
            </div>
            <div className={styles.selectContainer}>
              <Select
                options={OPERATORS}
                onChange={setOperator}
                value={operator}
                width={20}
              />
            </div>
            <Button
              tooltip={'Match case'}
              variant="secondary"
              style={{ color: matchCase ? theme.colors.text.link : theme.colors.text.disabled }}
              onClick={() => {
                setMatchCase((s) => !s);
              }}
              icon={'text-fields'}
            />
          </Stack>

          <FilterList
            onChange={setValues}
            values={values}
            options={options}
            caseSensitive={matchCase}
            searchFilter={searchFilter}
            operator={operator}
          />

          <Stack justifyContent="end" direction="row-reverse">
            <Button size="sm" onClick={onFilter}>
              Ok
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            {clearFilterVisible && (
              <Button fill="text" size="sm" onClick={onClearFilter}>
                Clear filter
              </Button>
            )}
          </Stack>
        </Stack>
      </div>
    </ClickOutsideWrapper>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filterContainer: css({
    label: 'filterContainer',
    width: '100%',
    minWidth: '320px',
    height: '100%',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
  label: css({
    marginBottom: 0,
  }),
  inputContainer: css({
    width: 250,
  }),
  selectContainer: css({
    width: 120,
  }),
});

const stopPropagation = (event: React.MouseEvent) => {
  event.stopPropagation();
};
