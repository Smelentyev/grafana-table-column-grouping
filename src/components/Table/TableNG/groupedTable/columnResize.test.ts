import { resizeColumnRange } from './columnResize';

describe('resizeColumnRange', () => {
  test('resizes a leaf column independently', () => {
    expect(resizeColumnRange([100], [50], 160)).toEqual({
      widths: [160],
      totalWidth: 160,
    });
  });

  test('expands grouped columns proportionally', () => {
    expect(resizeColumnRange([100, 200], [50, 50], 450)).toEqual({
      widths: [150, 300],
      totalWidth: 450,
    });
  });

  test('preserves the requested total after integer rounding', () => {
    expect(resizeColumnRange([100, 100, 100], [50, 50, 50], 401)).toEqual({
      widths: [134, 134, 133],
      totalWidth: 401,
    });
  });

  test('keeps constrained columns at their minimum width', () => {
    expect(resizeColumnRange([100, 300], [90, 50], 200)).toEqual({
      widths: [90, 110],
      totalWidth: 200,
    });
  });

  test('clamps the group to the sum of minimum widths', () => {
    expect(resizeColumnRange([100, 300], [90, 80], 100)).toEqual({
      widths: [90, 80],
      totalWidth: 170,
    });
  });
});
