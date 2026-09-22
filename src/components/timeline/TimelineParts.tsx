import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Era } from '../../content/eras';
import { formatYear, formatYearSpan } from '../../content/eras';
import {
  eraTicks,
  lifeGroup,
  spanWithinEra,
  type LifeGroup,
  type TimelineBeat,
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

/** Measured legend for the chronology: time down, a ruler per era, lanes aside. */
export function ChartKey() {
  const { t } = useTranslation();
  return (
    <figure className="tl-key">
      <figcaption className="tl-key__title">{t('modes.timeline.chart.keyTitle')}</figcaption>
      <div className="tl-key__row">
        <div className="tl-key__item">
          <svg className="tl-key__fig" viewBox="0 0 88 104" aria-hidden="true">
            <path className="tl-key__ink" d="M16 8v78M10 80l6 12 6-12" />
            <path className="tl-key__ink" d="M12 24h8M12 48h8M12 72h8" />
            <rect className="tl-key__sea" x="32" y="36" width="16" height="18" rx="1.5" />
            <rect className="tl-key__clay" x="54" y="28" width="16" height="44" rx="1.5" />
            <path className="tl-key__ink" d="M78 28v44M74 32l4-4 4 4M74 68l4 4 4-4" />
          </svg>
          <p>{t('modes.timeline.chart.keyDown')}</p>
        </div>
        <div className="tl-key__item">
          <svg className="tl-key__fig" viewBox="0 0 104 104" aria-hidden="true">
            <path className="tl-key__ink" d="M18 10v78M14 22h8M14 34h8M14 46h8M14 58h8M14 70h8M14 82h8" />
            <path className="tl-key__ink" d="M86 10v78M82 28h8M82 52h8M82 76h8" />
            <rect className="tl-key__clay" x="30" y="46" width="12" height="22" rx="1.5" />
            <rect className="tl-key__sea" x="62" y="46" width="12" height="22" rx="1.5" />
            <path className="tl-key__ink" d="M46 90l6 8 6-8" />
          </svg>
          <p>{t('modes.timeline.chart.keyScale')}</p>
        </div>
        <div className="tl-key__item">
          <svg className="tl-key__fig" viewBox="0 0 120 104" aria-hidden="true">
            <path className="tl-key__ink" d="M8 18h96M98 14l8 4-8 4" />
            <rect className="tl-key__gold" x="8" y="32" width="10" height="62" rx="1" />
            <rect className="tl-key__clay" x="26" y="32" width="28" height="62" rx="1.5" />
            <rect className="tl-key__sea" x="60" y="32" width="28" height="62" rx="1.5" />
            <rect className="tl-key__fade" x="94" y="32" width="22" height="62" rx="1.5" />
          </svg>
          <p>{t('modes.timeline.chart.keyLanes')}</p>
        </div>
      </div>
    </figure>
  );
}

function bandOf(eraId: string): HTMLElement | null {
  return document.getElementById(eraId)?.querySelector<HTMLElement>('.tl-era__body') ?? null;
}

function scrollBand(eraId: string, dir: -1 | 1) {
  const body = bandOf(eraId);
  if (!body) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  body.scrollBy({
    left: dir * Math.max(180, body.clientWidth * 0.72),
    behavior: reduce ? 'auto' : 'smooth',
  });
}

function jumpMeter(eraId: string, meter: HTMLElement, clientX: number) {
  const body = bandOf(eraId);
  if (!body) return;
  const rect = meter.getBoundingClientRect();
  const ratio = rect.width ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  body.scrollLeft = ratio * Math.max(0, body.scrollWidth - body.clientWidth);
}

/** Cartographic continuation mark: this chart keeps going past the gutter.
 *  CSS hides it unless the band really overflows, so a chart that fits on a
 *  wide screen never tells the reader to scroll. Arrows and the meter are
 *  the how; they page the band and show how much of it is in view. */
export function ChartScrollCue({
  eraId,
  lanes,
  overflow,
}: {
  eraId: string;
  lanes: string[];
  overflow: string;
}) {
  const { t } = useTranslation();
  if (lanes.length < 2) return null;
  const atStart = !overflow.includes('start');
  const atEnd = !overflow.includes('end');
  return (
    <div className="tl-era__scroll-cue">
      <p className="tl-era__scroll-cue-text">
        <span className="tl-era__scroll-cue-mark" aria-hidden="true">
          <svg viewBox="0 0 28 12" width="28" height="12" focusable="false">
            <path d="M1 2.5h7M1 9.5h7" />
            <path d="M12 1.5l4.5 4.5L12 10.5M18.5 1.5L23 6l-4.5 4.5" />
          </svg>
        </span>
        <span>{t('modes.timeline.chart.scrollCue', { lanes: lanes.join(' · ') })}</span>
      </p>
      <div className="tl-scroll">
        <button
          type="button"
          className="tl-scroll__btn"
          aria-label={t('modes.timeline.chart.scrollBack')}
          disabled={atStart}
          onClick={() => scrollBand(eraId, -1)}
        >
          <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
            <path d="M10 2L2 10l8 8" />
          </svg>
        </button>
        <div
          className="tl-scroll__meter"
          aria-hidden="true"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const meter = e.currentTarget;
            meter.setPointerCapture(e.pointerId);
            jumpMeter(eraId, meter, e.clientX);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            jumpMeter(eraId, e.currentTarget, e.clientX);
          }}
        >
          <span className="tl-scroll__thumb" />
        </div>
        <button
          type="button"
          className="tl-scroll__btn"
          aria-label={t('modes.timeline.chart.scrollOn')}
          disabled={atEnd}
          onClick={() => scrollBand(eraId, 1)}
        >
          <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
            <path d="M2 2l8 8-8 8" />
          </svg>
        </button>
      </div>
      <p className="tl-scroll__how">
        <span className="tl-scroll__how-touch">{t('modes.timeline.chart.howTouch')}</span>
        <span className="tl-scroll__how-desk">{t('modes.timeline.chart.howDesk')}</span>
      </p>
    </div>
  );
}

/** Right-edge fade + "more lanes" plate. The frame pins it; it is not a
 *  child of the scroller. Hidden when the band fits or the reader has already
 *  panned to the end (`data-overflow` on the body). */
export function ChartOverflowEdge() {
  const { t } = useTranslation();
  return (
    <div className="tl-era__edge" aria-hidden="true">
      <svg className="tl-era__edge-arrow" viewBox="0 0 12 20" width="12" height="20" focusable="false">
        <path d="M2 2l8 8-8 8" />
      </svg>
      <span className="tl-era__edge-label">{t('modes.timeline.chart.moreLanes')}</span>
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
  bandPx,
  selectedId,
  onSelect,
}: {
  lane: TimelineLane;
  era: Era;
  items: TimelineItem[];
  trackCount: number;
  bandPx: number;
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
            bandPx={bandPx}
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
  bandPx,
  selected,
  onSelect,
}: {
  item: TimelineItem;
  era: Era;
  trackCount: number;
  bandPx: number;
  selected: boolean;
  onSelect: (item: TimelineItem) => void;
}) {
  const { top, height } = spanWithinEra(item, era, bandPx);
  const width = 100 / trackCount;
  const names = item.beats && item.beats.length > 1 ? item.beats.map((b) => b.label).join(', ') : item.label;
  return (
    <li
      className={`tl-bar__slot${selected ? ' tl-bar__slot--selected' : ''}`}
      style={{ top, height, left: `${item.track * width}%`, width: `${width}%` }}
    >
      <button
        type="button"
        className={`tl-bar tl-bar--${item.kind}${selected ? ' tl-bar--selected' : ''}`}
        style={item.color ? ({ '--bar-color': item.color } as React.CSSProperties) : undefined}
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        title={`${names} — ${item.display}`}
      >
        <span className="tl-bar__label">{item.label}</span>
        <span className="tl-bar__date">{item.display}</span>
      </button>
    </li>
  );
}

const LIFE_HEADINGS: { id: LifeGroup; label: string }[] = [
  { id: 'birth', label: 'Birth and boyhood' },
  { id: 'ministry', label: 'Ministry' },
  { id: 'later', label: 'Later visions' },
];

/**
 * The readable list of the life-of-Jesus bars. Shared year windows are one bar
 * on the chart; here every stop keeps its own name and the date it was given.
 */
export function LifeListing({
  rows,
  selectedBeatId,
  onSelect,
}: {
  rows: { item: TimelineItem; beat: TimelineBeat }[];
  selectedBeatId: string | null;
  onSelect: (item: TimelineItem, beatId: string) => void;
}) {
  if (rows.length === 0) return null;
  const groups = LIFE_HEADINGS.map((g) => ({
    ...g,
    rows: rows.filter((r) => lifeGroup(r.beat) === g.id),
  })).filter((g) => g.rows.length > 0);
  return (
    <div className="tl-life">
      <p className="tl-life__note">
        Each line is an event from the ministry journey, with the date it was given. Events that share a year
        window share one bar on the chart.
      </p>
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="tl-life__heading">{g.label}</h3>
          <ol className="tl-life__list">
            {g.rows.map(({ item, beat }) => (
              <li key={beat.id}>
                <button
                  type="button"
                  className={`tl-life__row${selectedBeatId === beat.id ? ' tl-life__row--selected' : ''}`}
                  aria-pressed={selectedBeatId === beat.id}
                  onClick={() => onSelect(item, beat.id)}
                >
                  <span className="tl-life__label">{beat.label}</span>
                  <span className="tl-life__date">{beat.display}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
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
    <article id="tl-open-detail" className="stop-panel tl-detail" aria-live="polite">
      <header className="stop-panel__head">
        <h3>{title}</h3>
      </header>
      {meta && <p className="stop-panel__modern">{meta}</p>}
      {children}
    </article>
  );
}
