import { FieldType } from '@grafana/data';

import {
  buildIndicesSignature,
  calculateUniqueFieldValuesCached,
  valuesToOptions,
} from './utils';

describe('Filter utils', () => {
  const field = {
    name: 'status',
    type: FieldType.string,
    values: ['ok', 'fail', 'ok', null],
  } as any;

  test('buildIndicesSignature is stable for same indices', () => {
    expect(buildIndicesSignature([1, 3, 5])).toBe(buildIndicesSignature([1, 3, 5]));
  });

  test('calculateUniqueFieldValuesCached reuses cached result for same field/signature', () => {
    const first = calculateUniqueFieldValuesCached([0, 1, 2], field);
    const second = calculateUniqueFieldValuesCached([0, 1, 2], field);
    expect(second).toBe(first);
  });

  test('valuesToOptions sorts labels and preserves blanks placeholder', () => {
    const uniqueValues = calculateUniqueFieldValuesCached([0, 1, 2, 3], field);
    const options = valuesToOptions(uniqueValues);
    expect(options.map((item) => item.label)).toEqual(['(Blanks)', 'fail', 'ok']);
  });
});
