import { Field, formattedValueToString, SelectableValue } from '@grafana/data';

export function calculateUniqueFieldValues(indices: number[], field?: Field) {
  if (!field || indices.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};

  for (let i = 0; i < indices.length; i++) {
    const fieldValue = field.values[indices[i]];
    const value = field.display ? formattedValueToString(field.display(fieldValue)) : String(fieldValue ?? '');

    set[value || '(Blanks)'] = value;
  }

  return set;
}

export function getFilteredOptions(options: SelectableValue[], filterValues?: SelectableValue[]): SelectableValue[] {
  if (!filterValues) {
    return [];
  }

  return options.filter((option) => filterValues.some((filtered) => filtered.value === option.value));
}

export function valuesToOptions(unique: Record<string, unknown>): SelectableValue[] {
  return Object.keys(unique)
    .map((key) => ({ value: unique[key], label: key }))
    .sort(sortOptions);
}

function sortOptions(a: SelectableValue, b: SelectableValue): number {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
}
