import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ModePanel } from '../ModePanel';
import { useBundle, type BundleIndex } from '../../content/useBundle';
import {
  buildTimeline,
  eraBandHeight,
  PERSON_CATEGORY_LABEL,
  TIMELINE_LANES,
  type TimelineItem,
  type TimelineLaneId,
} from '../../content/timeline';
import { formatYearSpan } from '../../content/eras';
import {
  EraAxis,
  EraHeader,
  TimelineDetailCard,
  TimelineFilters,
  TimelineLaneColumn,
} from '../../components/timeline/TimelineParts';
import { Citations, ConfidenceBadge } from '../../content/citations';
import { bibleHref } from '../../content/scriptureIndex';

/**
 * The linear timeline — the app's chronological spine, laid out the way a
 * printed study Bible lays it out: eras running top to bottom, parallel lanes
 * (journeys, prophets, kings, apostles, events, finds) running down beside each
 * other, so a reader can pick a date and see who was alive, what was happening
 * and which journey was under way at that moment.
 *
 * Each era band is drawn to its own linear scale — a single scale across four
 * millennia would leave the entire New Testament a few pixels tall — and the
 * scale change is stated at every boundary rather than hidden.
 */
export default function TimelineMode() {
  const { bundle, loading, error } = useBundle();
  const { t } = useTranslation();
  if (loading) return <ModePanel title={t('modes.timeline.title')}>{t('common.loading')}</ModePanel>;
  if (error || !bundle)
    return <ModePanel title={t('modes.timeline.title')}>Could not load content. {error?.message}</ModePanel>;
  return <Timeline bundle={bundle} />;
}

const ALL_LANES = TIMELINE_LANES.map((l) => l.id);

function Timeline({ bundle }: { bundle: BundleIndex }) {
  const { t } = useTranslation();
  const model = useMemo(() => buildTimeline(bundle), [bundle]);
  const [lanes, setLanes] = useState<TimelineLaneId[]>(ALL_LANES);
  const [selected, setSelected] = useState<TimelineItem | null>(null);

  const toggleLane = (id: string) =>
    setLanes((cur) =>
      cur.includes(id as TimelineLaneId)
        ? cur.filter((x) => x !== id)
        : [...cur, id as TimelineLaneId],
    );

  const sections = model.sections
    .map((s) => ({ ...s, lanes: s.lanes.filter((l) => lanes.includes(l.lane.id)) }))
    .filter((s) => s.lanes.length > 0);

  return (
    <section className="mode-panel mode-panel--page mode-panel--wide timeline" aria-labelledby="timeline-title">
      <header className="home__header">
        <h1 id="timeline-title" className="home__title">
          {t('modes.timeline.title')}
        </h1>
        <p className="home__tagline">{t('modes.timeline.tagline')}</p>
      </header>

      <p className="tl-scale-note">
        <strong>How to read this.</strong> Time runs down the page. Within an era the scale is linear — a bar twice as
        long covers twice as many years — but <em>each era is drawn to its own scale</em>, because one scale from the
        patriarchs to the apostles would compress the New Testament to a sliver. Every date shown is the range the
        content was authored with, never a single year the app inferred.
      </p>

      <nav className="tl-jump" aria-label="Jump to an era">
        {model.sections.map((s) => (
          <a key={s.era.id} className="tl-jump__link" href={`#${s.era.id}`}>
            {s.era.label}
          </a>
        ))}
      </nav>

      <TimelineFilters
        legend="Lanes"
        options={TIMELINE_LANES.map((l) => ({ id: l.id, label: l.label, hint: l.hint }))}
        active={lanes}
        onToggle={toggleLane}
      />

      <ol className="tl-eras">
        {sections.map((section) => (
          <li className="tl-era" key={section.era.id} id={section.era.id}>
            <EraHeader era={section.era} count={section.itemCount} />
            <div
              className="tl-era__body"
              // The band's height is data-driven (see eraBandHeight): the axis
              // and every lane track read it, so ticks and bars stay aligned.
              style={{ '--band-h': `${eraBandHeight(section)}px` } as React.CSSProperties}
            >
              <EraAxis era={section.era} />
              <div className="tl-era__lanes">
                {section.lanes.map((l) => (
                  <TimelineLaneColumn
                    key={l.lane.id}
                    lane={l.lane}
                    era={section.era}
                    items={l.items}
                    trackCount={l.trackCount}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
            {/* The detail card belongs to the band it was opened from, not to
                the top of the page: a reader who taps Jeremiah after scrolling
                through four eras should not be thrown back to the header to
                read about him. */}
            {selected && section.lanes.some((l) => l.items.some((i) => i.id === selected.id)) && (
              <TimelineEntryDetail item={selected} bundle={bundle} onClose={() => setSelected(null)} />
            )}
            {section.lanes.length > 1 && (
              <p className="tl-era__pan-hint">
                {section.lanes.map((l) => l.lane.label).join(' · ')} — scroll the band sideways for the lanes past the
                edge; every lane reads against the same year rail on the left.
              </p>
            )}
            <p className="tl-era__scale-break" aria-hidden="true">
              scale changes ▾
            </p>
          </li>
        ))}
      </ol>

      {model.undated.length > 0 && (
        <section className="tl-undated">
          <h3>Not on the axis</h3>
          <p className="tl-undated__note">
            The content dates these figures nowhere, so they are listed rather than given an invented position —
            Genesis 1–11 in particular carries no external chronological anchor.
          </p>
          <ul>
            {model.undated.map((u) => (
              <li key={u.id}>
                <strong>{u.label}</strong>
                {u.detail ? ` — ${u.detail}` : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.unplaced.length > 0 && (
        <section className="tl-undated">
          <h3>Outside the charted eras</h3>
          <ul>
            {model.unplaced.map((u) => (
              <li key={u.id}>
                <strong>{u.label}</strong> — {u.display}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/**
 * Ancient names carry their glosses — "Bethlehem of Judea (Hebrew Beit Lehem,
 * 'house of bread'; Ephrathah)" — which belong in the site panel, not in the
 * middle of a link. Keep the name, drop the parenthetical.
 */
function shortSiteName(ancientName: string): string {
  return ancientName.split(' (')[0];
}

/** True when the authored display does not already name the plotted years. */
function plottedSpanNeeded(item: TimelineItem): boolean {
  const digits = item.display.replace(/\D+/g, ' ');
  const has = (y: number) => new RegExp(`(^| )${Math.abs(y)}( |$)`).test(digits);
  return !(has(item.startYear) && has(item.endYear));
}

/** The card for a tapped bar: what it is, when, and every way out of it. */
function TimelineEntryDetail({
  item,
  bundle,
  onClose,
}: {
  item: TimelineItem;
  bundle: BundleIndex;
  onClose: () => void;
}) {
  const person = item.personId ? bundle.person(item.personId) : undefined;
  const site = item.siteId ? bundle.site(item.siteId) : undefined;
  const journey = item.journeyId ? bundle.journey(item.journeyId) : undefined;

  return (
    <TimelineDetailCard
      title={item.label}
      meta={
        <>
          {item.display}
          {/* The authored display is the source of truth. Add the plotted span
              only when the display is prose that does not already state it
              ("date disputed: 9th century BC or post-exilic") — otherwise the
              line reads "c. 1025–970 BC · 1025–970 BC". */}
          {plottedSpanNeeded(item) ? <> · plotted {formatYearSpan(item.startYear, item.endYear)}</> : null}
          {item.confidence ? (
            <>
              {' '}
              <ConfidenceBadge confidence={item.confidence} />
            </>
          ) : null}
        </>
      }
    >
      {item.detail && <p>{item.detail}</p>}

      {person && (
        <ul className="tl-detail__facts">
          {person.category && (
            <li>
              <strong>{PERSON_CATEGORY_LABEL[person.category] ?? person.category}</strong>
            </li>
          )}
          {person.realm && <li>{person.realm.en}</li>}
          {person.books && person.books.length > 0 && <li>Book(s): {person.books.join(', ')}</li>}
          {site && <li>Based at {site.ancientName.en}</li>}
        </ul>
      )}

      {person && <p>{person.summary.en}</p>}

      {item.datingNote && (
        <details className="dispute">
          <summary>About this dating</summary>
          <p>{item.datingNote}</p>
        </details>
      )}

      <div className="tl-detail__links">
        {journey && <Link to={`/trace/${journey.id}`}>Trace this journey →</Link>}
        {site && <Link to={`/atlas?site=${site.id}`}>Show {shortSiteName(site.ancientName.en)} on the atlas →</Link>}
        {item.scriptureRef && <Link to={bibleHref(item.scriptureRef)}>Read {item.scriptureRef} →</Link>}
        {person?.journeyIds
          ?.slice(1)
          .map((jid) => bundle.journey(jid))
          .filter((j): j is NonNullable<typeof j> => Boolean(j))
          .map((j) => (
            <Link key={j.id} to={`/trace/${j.id}`}>
              Also: {j.title.en} →
            </Link>
          ))}
      </div>

      <Citations ids={item.citations} bundle={bundle} />

      <button type="button" className="miracle-card__read" onClick={onClose}>
        Close
      </button>
    </TimelineDetailCard>
  );
}
