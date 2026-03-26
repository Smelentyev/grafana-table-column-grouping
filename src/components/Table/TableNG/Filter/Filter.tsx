import React, { useMemo, useState } from 'react';
import { css, cx } from '@emotion/css';

import { DataFrame, Field, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, Icon, Popover } from '@grafana/ui';
import { FilterType } from '../types';

import { REGEX_OPERATOR } from './FilterList';
import { FilterPopup } from './FilterPopup';

interface Props {
  name: string;
  data: DataFrame;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  field?: Field;
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: number[] };
  iconClassName?: string;
}

export const Filter = ({
  name,
  data,
  filter,
  setFilter,
  field,
  crossFilterOrder,
  crossFilterRows,
  iconClassName,
}: Props) => {
  const filterValue = filter[name]?.filtered;

  const [buttonElement, setButtonElement] = useState<HTMLButtonElement | null>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);

  // Determine the index set to show in the popup for cross-filtering.
  // Only computed when the popup is open — avoids building an N-element array per
  // filterable column on every data refresh when no popup is visible.
  const filteredIndices = useMemo(() => {
    if (!isPopoverVisible) {
      return [];
    }
    const filterIndex = crossFilterOrder.indexOf(name);
    if (filterIndex > 0) {
      return crossFilterRows[crossFilterOrder[filterIndex - 1]] ?? [];
    }
    if (filterIndex === -1 && crossFilterOrder.length > 0) {
      return crossFilterRows[crossFilterOrder[crossFilterOrder.length - 1]] ?? [];
    }
    // No active cross-filters ahead of this one — show all rows.
    return Array.from({ length: data.length }, (_, i) => i);
  }, [isPopoverVisible, name, crossFilterOrder, crossFilterRows, data.length]);
  const styles = useStyles2(getStyles);
  const filterEnabled = Boolean(filterValue);
  const [searchFilter, setSearchFilter] = useState(filter[name]?.searchFilter || '');
  const [operator, setOperator] = useState<SelectableValue<string>>(filter[name]?.operator || REGEX_OPERATOR);

  return (
    <button
      className={styles.headerFilter}
      ref={setButtonElement}
      type="button"
      data-testid="table-filter-header-button"
      onClick={(ev) => {
        setPopoverVisible(true);
        ev.stopPropagation();
      }}
    >
      <Icon name="filter" className={cx(iconClassName, { [styles.filterIconEnabled]: filterEnabled })} />
      {isPopoverVisible && buttonElement && (
        <Popover
          content={
            <FilterPopup
              name={name}
              indices={filteredIndices}
              filterValue={filterValue}
              setFilter={setFilter}
              field={field}
              onClose={() => setPopoverVisible(false)}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
            />
          }
          onKeyDown={(event) => {
            if (event.key === ' ') {
              event.stopPropagation();
            }
          }}
          placement="bottom-start"
          referenceElement={buttonElement}
          show
        />
      )}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerFilter: css({
    background: 'transparent',
    border: 'none',
    label: 'headerFilter',
    padding: 0,
    alignSelf: 'flex-end',
  }),
  filterIconEnabled: css({
    label: 'filterIconEnabled',
    color: theme.colors.primary.text,
  }),
});
