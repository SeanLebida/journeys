import type { ReactNode } from 'react';
import type { Era } from '../../content/eras';
import { formatYear, formatYearSpan } from '../../content/eras';
import {
  eraTicks,
  spanWithinEra,
  type TimelineItem,
  type TimelineLane,
} from '../../content/timeline';

/**
 * The timeline's reusable parts.
 *
 * Everything here is presentational and takes plain data, so the same pieces
 * build the full timeline screen, the compact per-figure strip in a detail
 * panel, and anything later that needs a dated bar. Nothing in this file reads
 * the bundle or the router.
 */

/** Era heading: label, authored range, blurb, and the dating dispute if any. */
export function EraHeader({ era, count }: { era: Era; count: number }) {
  return (
    <header className="tl-era__head">
      <div className="tl-era__titles">
        <h3 className="tl-era__title" id={`tl-${era.id}`}>
          {era.label}
        </h3>
        <p className="tl-era__range">{era.display}</p>
      </div>
      <p className="tl-era__blurb">{era.blurb}</p>
      <p className="tl-era__count">
        {count} {count === 1 ? 'entry' : 'entries'}
      </p>
      {era.dispute && (
        <details className="dispute tl-era__dispute">
          <summary>Why these dates are debated</summary>
          <p>{era.dispute}</p>
        </details>
      )}
    </header>
  );
}

/**
 * The year rail for one era band — the "linear" part. Ticks are evenly spaced
 * because within a band the scale really is linear; the scale-change notch
 * between bands is drawn by the section, not here.
 */
export function EraAxis({ era }: { era: Era }) {
  return (
    <div className="tl-axis" aria-hidden="true">
      {/* Inset scale: overflow-x on the band also clips overflow-y, so a tick
          at 0%/100% with translateY(-50%) would lose half the year label. */}
      <div className="tl-axis__scale">
        {eraTicks(era).map((t) => (
          <span className="tl-axis__tick" key={t.pct} style={{ top: `${t.pct}%` }}>
            <span className="tl-axis__label">{formatYear(t.year)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cartographic continuation mark: this chart keeps going past the gutter. */
export function ChartScrollCue({ lanes }: { lanes: string[] }) {
  if (lanes.length < 2) return null;
  return (
    <p className="tl-era__scroll-cue">
      <span className="tl-era__scroll-cue-mark" aria-hidden="true">
        <svg viewBox="0 0 28 12" width="28" height="12" focusable="false">
          <path d="M1 2.5h7M1 9.5h7" />
          <path d="M12 1.5l4.5 4.5L12 10.5M18.5 1.5L23 6l-4.5 4.5" />
        </svg>
      </span>
      <span>
        {lanes.join(' · ')} share this year rail. If the chart runs past the
        edge, swipe sideways.
      </span>
    </p>
  );
}

/** Sticky right-edge fade + "more lanes" plate. Hidden when the band fits or
 *  the reader has already panned to the end (`data-overflow` on the body). */
export function ChartOverflowEdge() {
  return (
    <div className="tl-era__edge" aria-hidden="true">
      <span className="tl-era__edge-label">more lanes</span>
    </div>
  );
}

/**
 * One lane (Prophets, Kings & rulers, …) inside an era band. Bars are
 * positioned by year within the band and packed onto sub-tracks so overlapping
 * lives never cover each other.
 */
export function TimelineLaneColumn({
  lane,
  era,
  items,
  trackCount,
  selectedId,
  onSelect,
}: {
  lane: TimelineLane;
  era: Era;
  items: TimelineItem[];
  trackCount: number;
  selectedId: string | null;
  onSelect: (item: TimelineItem) => void;
}) {
  return (
    // `--tracks` drives the lane's width: a lane packed onto six sub-tracks
    // needs six times the room of a single-track lane, or its labels shrink to
    // initials while a one-bar lane sits half empty beside it.
    <div className="tl-lane" style={{ '--tracks': trackCount } as React.CSSProperties}>
      <h4 className="tl-lane__title" title={lane.hint}>
        {lane.label}
      </h4>
      <ul className="tl-lane__track">
        {items.map((item) => (
          <TimelineBar
            key={item.id}
            item={item}
            era={era}
            trackCount={trackCount}
            selected={selectedId === item.id}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * One dated entry. The bar is a button: the whole thing is the tap target, and
 * the accessible name carries the label and the authored date range so the
 * timeline is usable without seeing the geometry at all.
 */
export function TimelineBar({
  item,
  era,
  trackCount,
  selected,
  onSelect,
}: {
  item: TimelineItem;
  era: Era;
  trackCount: number;
  selected: boolean;
  onSelect: (item: TimelineItem) => void;
}) {
  const { top, height } = spanWithinEra(item, era);
  const width = 100 / trackCount;
  return (
    <li
      className="tl-bar__slot"
      style={{ top, height, left: `${item.track * width}%`, width: `${width}%` }}
    >
      <button
        type="button"
        className={`tl-bar tl-bar--${item.kind}${selected ? ' tl-bar--selected' : ''}`}
        style={item.color ? ({ '--bar-color': item.color } as React.CSSProperties) : undefined}
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        title={`${item.label} — ${item.display}`}
      >
        <span className="tl-bar__label">{item.label}</span>
        <span className="tl-bar__date">{item.display}</span>
      </button>
    </li>
  );
}

/**
 * A standalone linear strip for a single set of spans — the same scale logic as
 * the main timeline, in one row. Used where a panel needs "when was this,
 * relative to everything else" without the full chart.
 */
export function TimelineStrip({
  items,
  startYear,
  endYear,
  caption,
}: {
  items: { id: string; label: string; startYear: number; endYear: number; kind?: string }[];
  startYear?: number;
  endYear?: number;
  caption?: string;
}) {
  if (items.length === 0) return null;
  const min = startYear ?? Math.min(...items.map((i) => i.startYear));
  const max = endYear ?? Math.max(...items.map((i) => i.endYear));
  const span = Math.max(1, max - min);
  return (
    <div className="tl-strip">
      {caption && <h6 className="tl-strip__caption">{caption}</h6>}
      <div className="tl-strip__track" aria-hidden="true">
        {items.map((i) => (
          <span
            key={i.id}
            className={`tl-strip__seg tl-strip__seg--${i.kind ?? 'default'}`}
            style={{
              left: `${((i.startYear - min) / span) * 100}%`,
              width: `${Math.max(2.5, ((i.endYear - i.startYear) / span) * 100)}%`,
            }}
          />
        ))}
      </div>
      <div className="tl-strip__axis" aria-hidden="true">
        <span>{formatYear(min)}</span>
        <span>{formatYear(max)}</span>
      </div>
      <ul className="tl-strip__legend">
        {items.map((i) => (
          <li key={i.id}>
            <span className={`tl-strip__key tl-strip__key--${i.kind ?? 'default'}`} /> {i.label}:{' '}
            {formatYearSpan(i.startYear, i.endYear)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Checkbox row for toggling lanes/kinds on and off. */
export function TimelineFilters({
  legend,
  options,
  active,
  onToggle,
}: {
  legend: string;
  options: { id: string; label: string; hint?: string }[];
  active: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="atlas-toggles tl-filters">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.id} title={o.hint}>
          <input type="checkbox" checked={active.includes(o.id)} onChange={() => onToggle(o.id)} /> {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/** Wrapper for the selected-entry card, so the layout is defined in one place. */
export function TimelineDetailCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="stop-panel tl-detail" aria-live="polite">
      <header className="stop-panel__head">
        <h3>{title}</h3>
      </header>
      {meta && <p className="stop-panel__modern">{meta}</p>}
      {children}
    </article>
  );
}
