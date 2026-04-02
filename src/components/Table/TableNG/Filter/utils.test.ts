import { FieldType } from '@grafana/data';

import {
  buildIndicesSignature,
  calculateUniqueFieldValuesCached,
  comparableValue,
  evaluateExpressionFilter,
  getFilterValueLabel,
  getMatchingFilterOptions,
  normalizeConditionalFilterInput,
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
    expect(options.find((item) => item.label === 'fail')?.value).toBe('fail');
  });

  test('comparableValue normalizes numbers and booleans', () => {
    expect(comparableValue(' 42 ')).toBe(42);
    expect(comparableValue('true')).toBe(true);
    expect(comparableValue('false')).toBe(false);
    expect(comparableValue('ok')).toBe('ok');
  });

  test('evaluateExpressionFilter supports safe arithmetic and comparison expressions', () => {
    expect(evaluateExpressionFilter('$ >= 10 && $ <= 12', '11')).toBe(true);
    expect(evaluateExpressionFilter('($ + 2) = 7', '5')).toBe(true);
    expect(evaluateExpressionFilter('$ = \"ok\" || $ = \"warn\"', 'warn')).toBe(true);
    expect(evaluateExpressionFilter('!($ = false)', 'true')).toBe(true);
  });

  test('evaluateExpressionFilter rejects unsupported identifiers and arbitrary code', () => {
    expect(() => evaluateExpressionFilter('alert(1)', '1')).toThrow(/Unsupported/);
    expect(() => evaluateExpressionFilter('window.location', '1')).toThrow(/Unsupported/);
    expect(() => evaluateExpressionFilter('$.constructor.constructor(\"alert(1)\")()', '1')).toThrow(/Unsupported/);
  });

  test('evaluateExpressionFilter returns false for non matching comparisons', () => {
    expect(evaluateExpressionFilter('$ > 12', '11')).toBe(false);
    expect(evaluateExpressionFilter('$ = \"fail\"', 'ok')).toBe(false);
  });

  test('normalizeConditionalFilterInput unwraps FilterInput escaping for conditional operators', () => {
    expect(normalizeConditionalFilterInput('\\$\\<=228556801')).toBe('$<=228556801');
    expect(normalizeConditionalFilterInput('\\\"ok\\\"')).toBe('"ok"');
  });

  test('getFilterValueLabel preserves blanks placeholder and display values', () => {
    const displayField = {
      name: 'amount',
      type: FieldType.number,
      values: [11, null],
      display: (value: unknown) => ({ text: value == null ? '' : `v:${value}` }),
    } as any;

    expect(getFilterValueLabel(displayField, 11)).toBe('v:11');
    expect(getFilterValueLabel(displayField, null)).toBe('(Blanks)');
  });

  test('calculateUniqueFieldValuesCached keeps raw values behind display labels', () => {
    const numericField = {
      name: 'amount',
      type: FieldType.number,
      values: [228556801],
      display: (value: unknown) => ({ text: '228,556,801' }),
    } as any;

    const uniqueValues = calculateUniqueFieldValuesCached([0], numericField);
    const options = valuesToOptions(uniqueValues);

    expect(options[0].label).toBe('228,556,801');
    expect(options[0].value).toBe(228556801);
    expect(evaluateExpressionFilter('$<=228556801', options[0].value)).toBe(true);
  });

  test('getMatchingFilterOptions supports escaped expression input from FilterInput', () => {
    const options = [
      { label: '228556801', value: 228556801 },
      { label: '228556802', value: 228556802 },
    ];

    expect(getMatchingFilterOptions(options, '\\$\\<=228556801', 'Expression')).toEqual([options[0]]);
  });
});
