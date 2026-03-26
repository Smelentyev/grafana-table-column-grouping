/**
 * virtualWindow.ts
 *
 * Pure, framework-free functions for computing the virtual render window in a
 * grouped-table tbody.
 *
 * "One record" = one logical data row that may span multiple visual <tr> elements
 * (when maxFieldDepth > 1).  The record height in pixels is:
 *   recordHeightPx = maxFieldDepth * rowHeightPx
 *
 * Spacer rows are emitted above and below the visible slice of records so that
 * the scrollable container maintains its full height without DOM nodes for every row.
 */

export const DEFAULT_ROW_HEIGHT_PX = 36; // visual <tr> height estimate (px)
export const DEFAULT_OVERSCAN = 3; // extra records to render above/below viewport

export interface VirtualWindow {
  /** Index (inclusive) of the first record to render. */
  startIndex: number;
  /** Index (exclusive) of the last record to render. */
  endIndex: number;
  /** Height in px of the spacer injected before the first rendered record. */
  topSpacerPx: number;
  /** Height in px of the spacer injected after the last rendered record. */
  bottomSpacerPx: number;
}

export interface ComputeVirtualWindowOptions {
  /**
   * Pixel height of non-virtualized content above the first record inside the
   * same scroll container, e.g. sticky multi-row thead.
   */
  leadingOffsetPx?: number;
}

/**
 * Computes the virtual window for a tbody with `totalRecords` logical records.
 *
 * @param scrollTop       Current scrollTop of the scroll container (px).
 * @param viewportHeight  Visible height of the scroll container (px).
 * @param totalRecords    Total number of logical records in the current page.
 * @param recordHeightPx  Estimated pixel height of one logical record.
 * @param overscan        Number of extra records to render above/below the viewport.
 */
export function computeVirtualWindow(
  scrollTop: number,
  viewportHeight: number,
  totalRecords: number,
  recordHeightPx: number,
  overscan: number = DEFAULT_OVERSCAN,
  options: ComputeVirtualWindowOptions = {}
): VirtualWindow {
  if (totalRecords === 0 || recordHeightPx <= 0) {
    return { startIndex: 0, endIndex: 0, topSpacerPx: 0, bottomSpacerPx: 0 };
  }

  const leadingOffsetPx = Math.max(0, options.leadingOffsetPx ?? 0);
  const adjustedScrollTop = Math.max(0, scrollTop - leadingOffsetPx);
  const adjustedViewportHeight = Math.max(recordHeightPx, viewportHeight - leadingOffsetPx);

  // The sticky thead offsets the visible tbody region slightly, but the overscan
  // buffer is large enough to absorb this without an extra measurement.
  const rawStart = Math.floor(adjustedScrollTop / recordHeightPx);
  const rawEnd = Math.ceil((adjustedScrollTop + adjustedViewportHeight) / recordHeightPx);

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(totalRecords, rawEnd + overscan);

  return {
    startIndex,
    endIndex,
    topSpacerPx: startIndex * recordHeightPx,
    bottomSpacerPx: (totalRecords - endIndex) * recordHeightPx,
  };
}
