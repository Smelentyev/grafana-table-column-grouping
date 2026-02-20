/**
 * Utility types and functions for Table components
 */

/**
 * Coordinates for data links/actions tooltip
 */
export interface DataLinksActionsTooltipCoords {
  clientX: number;
  clientY: number;
}

/**
 * State for data links/actions tooltip
 */
export interface DataLinksActionsTooltipState {
  coords: DataLinksActionsTooltipCoords;
  links?: any[];
  actions?: any[];
}
