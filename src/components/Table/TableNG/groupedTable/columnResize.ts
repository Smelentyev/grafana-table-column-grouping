export interface ResizedColumnRange {
  widths: number[];
  totalWidth: number;
}

/**
 * Resizes a contiguous range of leaf columns while preserving their current
 * proportions. Columns that reach their minimum width are excluded from the
 * remaining proportional distribution.
 */
export function resizeColumnRange(
  startWidths: number[],
  minWidths: number[],
  requestedTotalWidth: number
): ResizedColumnRange {
  if (startWidths.length === 0 || startWidths.length !== minWidths.length) {
    return { widths: startWidths, totalWidth: sum(startWidths) };
  }

  const normalizedStarts = startWidths.map((width, index) =>
    Math.max(Math.round(width), Math.round(minWidths[index]))
  );
  const normalizedMins = minWidths.map((width) => Math.max(0, Math.round(width)));
  const minimumTotal = sum(normalizedMins);
  const targetTotal = Math.max(minimumTotal, Math.round(requestedTotalWidth));

  if (normalizedStarts.length === 1) {
    return { widths: [targetTotal], totalWidth: targetTotal };
  }

  const widths = new Array<number>(normalizedStarts.length).fill(0);
  let remainingIndices = normalizedStarts.map((_, index) => index);
  let remainingTarget = targetTotal;

  while (remainingIndices.length > 0) {
    const remainingStartTotal = sum(remainingIndices.map((index) => normalizedStarts[index]));
    const constrained = remainingIndices.filter((index) => {
      const proportionalWidth =
        remainingStartTotal > 0
          ? (normalizedStarts[index] / remainingStartTotal) * remainingTarget
          : remainingTarget / remainingIndices.length;
      return proportionalWidth < normalizedMins[index];
    });

    if (constrained.length === 0) {
      const rawWidths = remainingIndices.map((index) =>
        remainingStartTotal > 0
          ? (normalizedStarts[index] / remainingStartTotal) * remainingTarget
          : remainingTarget / remainingIndices.length
      );
      const roundedWidths = roundToTotal(rawWidths, remainingTarget);
      remainingIndices.forEach((index, position) => {
        widths[index] = roundedWidths[position];
      });
      break;
    }

    for (const index of constrained) {
      widths[index] = normalizedMins[index];
      remainingTarget -= normalizedMins[index];
    }
    const constrainedSet = new Set(constrained);
    remainingIndices = remainingIndices.filter((index) => !constrainedSet.has(index));
  }

  return { widths, totalWidth: sum(widths) };
}

function roundToTotal(values: number[], targetTotal: number): number[] {
  const rounded = values.map(Math.floor);
  let remainder = targetTotal - sum(rounded);
  const fractions = values
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < remainder; index++) {
    rounded[fractions[index % fractions.length].index] += 1;
  }

  return rounded;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
