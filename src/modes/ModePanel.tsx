import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { useSheetDrag } from '../components/useSheetDrag';

/**
 * Shared shell for a mode screen: an overlay panel above the persistent map.
 * Below the desktop breakpoint it behaves as a draggable bottom sheet (see
 * `useSheetDrag`) so the map + animation stay visible above it; at `lg` and up
 * it is the fixed left sidebar and the sheet behavior is inert.
 *
 * `eyebrow` is a small line above the title for context that shouldn't compete
 * with it (trace puts the journey name there so the title can be the stop).
 * `footer` is pinned below the scrolling body — the place for the primary
 * action, so it stays reachable however far the reader has scrolled.
 *
 * `scrollKey` identifies what the body is currently showing. When it changes the
 * body returns to the top: arriving at a new stop otherwise drops the reader
 * wherever the *previous* stop's scroll left them, halfway down a section that
 * no longer exists. With `rememberScroll`, returning to a key restores where
 * the reader was on it (Atlas: closing a place's details lands back on the
 * layer controls exactly where they left them).
 */
export function ModePanel({
  title,
  eyebrow,
  children,
  footer,
  style,
  scrollKey,
  rememberScroll = false,
}: {
  title: string;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  style?: CSSProperties;
  scrollKey?: string | number;
  rememberScroll?: boolean;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const { bodyRef, handleProps, snap, isSheet } = useSheetDrag(panelRef);
  const saved = useRef(new Map<string | number, number>());
  const lastKey = useRef(scrollKey);
  useEffect(() => {
    if (scrollKey === undefined) return;
    const body = bodyRef.current;
    if (rememberScroll && lastKey.current !== undefined && body) {
      saved.current.set(lastKey.current, body.scrollTop);
    }
    lastKey.current = scrollKey;
    body?.scrollTo({ top: rememberScroll ? (saved.current.get(scrollKey) ?? 0) : 0 });
  }, [scrollKey, bodyRef, rememberScroll]);
  return (
    <section
      ref={panelRef}
      className="mode-panel"
      aria-labelledby="mode-title"
      style={style}
      data-snap={isSheet ? snap : undefined}
    >
      <div className="mode-panel__header" {...handleProps}>
        <div className="mode-panel__handle">
          <span className="mode-panel__grip" aria-hidden="true" />
        </div>
        <div className="mode-panel__heading">
          {eyebrow && <p className="mode-panel__eyebrow">{eyebrow}</p>}
          <h2 id="mode-title" className="mode-panel__title">
            {title}
          </h2>
        </div>
      </div>
      <div className="mode-panel__body" ref={bodyRef}>
        {children}
      </div>
      {footer && <div className="mode-panel__footer">{footer}</div>}
    </section>
  );
}
