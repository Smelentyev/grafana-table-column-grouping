/**
 * useVirtualScroll.ts
 *
 * React hook that tracks scroll position on a container element and returns
 * the current virtual render window for the tbody.
 *
 * Usage:
 *   const { scrollContainerRef, virtualWindow } = useVirtualScroll({
 *     totalRecords,
 *     recordHeightPx,
 *   });
 *   // Attach ref to the scrollable div:
 *   <div ref={scrollContainerRef} style={{ overflow: 'auto' }}>
 */

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import {
  computeVirtualWindow,
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT_PX,
  VirtualWindow,
} from './virtualWindow';

export interface UseVirtualScrollOptions {
  /** Total number of logical records in the current view (page). */
  totalRecords: number;
  /** Estimated pixel height of one logical record (maxFieldDepth × rowHeight). */
  recordHeightPx?: number;
  /** Number of extra records to render outside the visible viewport. */
  overscan?: number;
  /** Pixel height of sticky/non-virtualized content above tbody records. */
  leadingOffsetPx?: number;
}

export interface UseVirtualScrollResult {
  /** Attach to the scrollable container element. */
  scrollContainerRef: RefObject<HTMLDivElement>;
  /** Current virtual window — drives which records are rendered. */
  virtualWindow: VirtualWindow;
}

export function useVirtualScroll({
  totalRecords,
  recordHeightPx = DEFAULT_ROW_HEIGHT_PX,
  overscan = DEFAULT_OVERSCAN,
  leadingOffsetPx = 0,
}: UseVirtualScrollOptions): UseVirtualScrollResult {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [virtualWindow, setVirtualWindow] = useState<VirtualWindow>(() =>
    // Conservative initial window: render up to ~800px worth of records.
    computeVirtualWindow(0, 800, totalRecords, recordHeightPx, overscan, { leadingOffsetPx })
  );

  const updateWindow = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    setVirtualWindow(
      computeVirtualWindow(el.scrollTop, el.clientHeight, totalRecords, recordHeightPx, overscan, {
        leadingOffsetPx,
      })
    );
  }, [totalRecords, recordHeightPx, overscan, leadingOffsetPx]);

  // Attach scroll listener.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    el.addEventListener('scroll', updateWindow, { passive: true });
    updateWindow(); // Compute initial window with real viewport dimensions.
    return () => {
      el.removeEventListener('scroll', updateWindow);
    };
  }, [updateWindow]);

  // Recompute when the container is resized (panel resize, sidebar open/close).
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    const ro = new ResizeObserver(updateWindow);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [updateWindow]);

  return { scrollContainerRef, virtualWindow };
}
