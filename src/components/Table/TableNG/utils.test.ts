import { FieldType } from '@grafana/data';

import { frameToRecords, parseStyleJson } from './utils';

function makeField(name: string, values: unknown[], type: FieldType = FieldType.string, displayName?: string) {
  return {
    name,
    type,
    values,
    config: {},
    state: displayName ? { displayName } : undefined,
  } as any;
}

describe('frameToRecords', () => {
  test('maps rows without dynamic code execution assumptions', () => {
    const frame = {
      length: 2,
      fields: [makeField('name', ['alice', 'bob']), makeField('count', [1, 2], FieldType.number, 'Count')],
    } as any;

    expect(frameToRecords(frame)).toEqual([
      { __depth: 0, __index: 0, name: 'alice', Count: 1 },
      { __depth: 0, __index: 1, name: 'bob', Count: 2 },
    ]);
  });

  test('adds nested child rows when nested frame field is present', () => {
    const childFrame = { fields: [], length: 0 } as any;
    const frame = {
      length: 1,
      fields: [makeField('nested', [[childFrame]], FieldType.nestedFrames), makeField('name', ['parent'])],
    } as any;

    expect(frameToRecords(frame, 'nested')).toEqual([
      { __depth: 0, __index: 0, nested: [childFrame], name: 'parent' },
      { __depth: 1, __index: 0, data: childFrame },
    ]);
  });
});

describe('parseStyleJson', () => {
  test('logs a generic error message without echoing the raw value', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    parseStyleJson('{not-json}');

    expect(consoleSpy).toHaveBeenCalledWith('encountered invalid cell style JSON', expect.any(SyntaxError));

    consoleSpy.mockRestore();
  });
});
