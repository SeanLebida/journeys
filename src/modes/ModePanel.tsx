import { useRef, type ReactNode, type CSSProperties } from 'react';
import { useSheetDrag } from '../components/useSheetDrag';

/**
 * Shared shell for a mode screen: an overlay panel above the persistent map.
 * Below the desktop breakpoint it behaves as a draggable bottom sheet (see
 * `useSheetDrag`) so the map + animation stay visible above it; at `lg` and up
 * it is the fixed left sidebar and the sheet behavior is inert.
 */
export function ModePanel({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const { bodyRef, handleProps, snap, isSheet } = useSheetDrag(panelRef);
  return (
    <section
      ref={panelRef}
      className="mode-panel"
      aria-labelledby="mode-title"
      style={style}
      data-snap={isSheet ? snap : undefined}
    >
      <div className="mode-panel__handle" {...handleProps}>
        <span className="mode-panel__grip" aria-hidden="true" />
      </div>
      <h2 id="mode-title" className="mode-panel__title">
        {title}
      </h2>
      <div className="mode-panel__body" ref={bodyRef}>
        {children}
      </div>
    </section>
  );
}
