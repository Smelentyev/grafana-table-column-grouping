import { Field, formattedValueToString, SelectableValue } from '@grafana/data';

const uniqueValueCache = new WeakMap<Field, Map<string, Record<string, string>>>();

export function buildIndicesSignature(indices: number[]): string {
  let hash = 0;
  for (let i = 0; i < indices.length; i++) {
    hash = (hash * 31 + indices[i]) >>> 0;
  }
  const first = indices[0] ?? -1;
  const last = indices.length > 0 ? indices[indices.length - 1] : -1;
  return `${indices.length}:${first}:${last}:${hash}`;
}

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

export function calculateUniqueFieldValuesCached(indices: number[], field?: Field) {
  if (!field || indices.length === 0) {
    return {};
  }

  const signature = buildIndicesSignature(indices);
  const fieldCache = uniqueValueCache.get(field);
  if (fieldCache?.has(signature)) {
    return fieldCache.get(signature)!;
  }

  const calculated = calculateUniqueFieldValues(indices, field);
  const nextFieldCache = fieldCache ?? new Map<string, Record<string, string>>();
  nextFieldCache.set(signature, calculated);
  uniqueValueCache.set(field, nextFieldCache);
  return calculated;
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
