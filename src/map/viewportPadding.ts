/**
 * Keep MapLibre's camera padding in sync with the chrome that covers the map
 * (mobile bottom sheet, landscape side rail, desktop sidebar). With padding set,
 * easeTo/flyTo/fitBounds center a POI in the *visible* uncovered viewport instead
 * of the geometric center of the full canvas (which buries places under the sheet).
 */

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const LG = 1024;
const DESKTOP_LEFT = 450;
const SHEET_MQ = `(max-width: ${LG - 1}px) and (orientation: portrait)`;
const RAIL_MQ = `(max-width: ${LG - 1}px) and (orientation: landscape)`;

function readCssPx(el: Element, prop: string): number {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute the padding MapLibre should use right now. Pure DOM/CSS read so it
 * can run from resize, sheet-drag, and orientation changes without React.
 */
export function computeMapPadding(root: ParentNode = document): MapPadding {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const shell = root.querySelector('.app-shell') as HTMLElement | null;
  const main = root.querySelector('.app-main') as HTMLElement | null;
  const dockH = shell ? readCssPx(shell, '--dock-h') : 0;
  const safeTop = shell ? readCssPx(shell, '--safe-top') : 0;

  // Desktop sidebar floats over the left edge of the map.
  if (window.matchMedia(`(min-width: ${LG}px)`).matches) {
    return { top: safeTop, bottom: dockH, left: DESKTOP_LEFT, right: 0 };
  }

  // Landscape phone/tablet: panel is a left rail; map keeps the rest.
  if (window.matchMedia(RAIL_MQ).matches) {
    const railW = main ? readCssPx(main, '--rail-w') : 0;
    return { top: safeTop, bottom: dockH, left: railW, right: 0 };
  }

  // Portrait sheet: --sheet-h is the live sheet height inside .app-main.
  // The sheet sits above the dock (`bottom: var(--dock-h)`), so the covered
  // band from the bottom of the map canvas is sheet + dock.
  let sheetH = 0;
  if (window.matchMedia(SHEET_MQ).matches && main) {
    sheetH = readCssPx(main, '--sheet-h');
    // Before useSheetDrag publishes --sheet-h, the CSS fallback height is 50%.
    if (sheetH <= 0) {
      sheetH = main.clientHeight * 0.5;
    }
    // Page modes (Home/Bible/Timeline) cover most of the map as a card —
    // don't invent a sheet pad; there is no travel POI to keep in view.
    if (main.querySelector('.mode-panel--page')) {
      sheetH = 0;
    }
  }

  return { top: safeTop, bottom: sheetH + dockH, left: 0, right: 0 };
}

export function paddingsEqual(a: MapPadding, b: MapPadding): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;
}

export { DESKTOP_LEFT, LG, SHEET_MQ, RAIL_MQ };
