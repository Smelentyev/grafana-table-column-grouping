import { computeVirtualWindow, DEFAULT_OVERSCAN, DEFAULT_ROW_HEIGHT_PX } from './virtualWindow';

describe('computeVirtualWindow', () => {
  const RH = DEFAULT_ROW_HEIGHT_PX; // 36
  const OS = DEFAULT_OVERSCAN; // 3

  test('returns empty window when totalRecords is 0', () => {
    const w = computeVirtualWindow(0, 600, 0, RH);
    expect(w).toEqual({ startIndex: 0, endIndex: 0, topSpacerPx: 0, bottomSpacerPx: 0 });
  });

  test('returns empty window when recordHeightPx is 0', () => {
    const w = computeVirtualWindow(0, 600, 100, 0);
    expect(w).toEqual({ startIndex: 0, endIndex: 0, topSpacerPx: 0, bottomSpacerPx: 0 });
  });

  test('at scrollTop=0 startIndex is 0 (clamped) with overscan', () => {
    const w = computeVirtualWindow(0, 600, 1000, RH);
    expect(w.startIndex).toBe(0); // max(0, 0 - overscan) = 0
  });

  test('endIndex never exceeds totalRecords', () => {
    const w = computeVirtualWindow(0, 600, 10, RH);
    expect(w.endIndex).toBeLessThanOrEqual(10);
  });

  test('topSpacerPx = startIndex * recordHeightPx', () => {
    const w = computeVirtualWindow(500, 400, 1000, RH, OS);
    expect(w.topSpacerPx).toBe(w.startIndex * RH);
  });

  test('bottomSpacerPx = (totalRecords - endIndex) * recordHeightPx', () => {
    const w = computeVirtualWindow(500, 400, 1000, RH, OS);
    expect(w.bottomSpacerPx).toBe((1000 - w.endIndex) * RH);
  });

  test('spacers + rendered records covers full content height', () => {
    const total = 200;
    const w = computeVirtualWindow(1000, 400, total, RH, OS);
    const renderedCount = w.endIndex - w.startIndex;
    const totalHeight = w.topSpacerPx + renderedCount * RH + w.bottomSpacerPx;
    expect(totalHeight).toBe(total * RH);
  });

  test('visible records include overscan above and below viewport', () => {
    // scrollTop=360 (record 10), viewport=360 (records 10-19)
    const scrollTop = 10 * RH;
    const viewportHeight = 10 * RH;
    const w = computeVirtualWindow(scrollTop, viewportHeight, 100, RH, OS);
    // rawStart = floor(360/36) = 10; startIndex = max(0, 10-3) = 7
    expect(w.startIndex).toBe(7);
    // rawEnd = ceil((360+360)/36) = 20; endIndex = min(100, 20+3) = 23
    expect(w.endIndex).toBe(23);
  });

  test('startIndex clamps to 0 near top of content', () => {
    const w = computeVirtualWindow(RH, 400, 100, RH, OS);
    // rawStart = 1; startIndex = max(0, 1-3) = 0
    expect(w.startIndex).toBe(0);
    expect(w.topSpacerPx).toBe(0);
  });

  test('endIndex clamps to totalRecords near bottom', () => {
    const total = 20;
    const scrollTop = 18 * RH;
    const w = computeVirtualWindow(scrollTop, 400, total, RH, OS);
    expect(w.endIndex).toBe(total);
    expect(w.bottomSpacerPx).toBe(0);
  });

  test('when all records fit in viewport, full range is returned with no spacers', () => {
    const total = 5;
    const w = computeVirtualWindow(0, 1000, total, RH, OS);
    expect(w.startIndex).toBe(0);
    expect(w.endIndex).toBe(total);
    expect(w.topSpacerPx).toBe(0);
    expect(w.bottomSpacerPx).toBe(0);
  });

  test('custom overscan is respected', () => {
    const scrollTop = 20 * RH;
    const w = computeVirtualWindow(scrollTop, 5 * RH, 100, RH, 10);
    // rawStart = 20; startIndex = max(0, 20-10) = 10
    expect(w.startIndex).toBe(10);
    // rawEnd = 25; endIndex = min(100, 25+10) = 35
    expect(w.endIndex).toBe(35);
  });

  test('leadingOffsetPx removes sticky header height from calculations', () => {
    const leadingOffsetPx = 2 * RH;
    const scrollTop = leadingOffsetPx + 10 * RH;
    const viewportHeight = leadingOffsetPx + 5 * RH;
    const w = computeVirtualWindow(scrollTop, viewportHeight, 100, RH, 0, {
      leadingOffsetPx,
    });
    expect(w.startIndex).toBe(10);
    expect(w.endIndex).toBe(15);
  });
});
