import type { ReactNode } from 'react';

/**
 * Shared shell for a mode screen: an overlay panel above the persistent map.
 * Real mode UIs (trace/atlas/lessons/quiz) fill `children` in M3–M6.
 */
export function ModePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mode-panel" aria-labelledby="mode-title">
      <h2 id="mode-title" className="mode-panel__title">
        {title}
      </h2>
      <div className="mode-panel__body">{children}</div>
    </section>
  );
}
