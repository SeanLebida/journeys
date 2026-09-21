import { useMemo, useRef, useState } from 'react';
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
  ChartKey,
  ChartOverflowEdge,
  ChartScrollCue,
  EraAxis,
  EraHeader,
  TimelineDetailCard,
  TimelineFilters,
  TimelineLaneColumn,
} from '../../components/timeline/TimelineParts';
import { useFoldOut, usePrefersReducedMotion } from '../../components/timeline/useFoldOut';
import { useScrollOverflow } from '../../components/timeline/useScrollOverflow';
import { Citations, ConfidenceBadge, ReferenceStack } from '../../content/citations';
import { bibleHref } from '../../content/scriptureIndex';
import { useUiStore } from '../../state/useUiStore';

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

  // The fold-out effect: on unless the reader has opted out, and always off
  // under prefers-reduced-motion. See useFoldOut for the readability rules.
  const foldPref = useUiStore((s) => s.timelineFold);
  const setFoldPref = useUiStore((s) => s.setTimelineFold);
  const reducedMotion = usePrefersReducedMotion();
  const foldEnabled = foldPref && !reducedMotion;
  const erasRef = useRef<HTMLOListElement>(null);

  const toggleLane = (id: string) =>
    setLanes((cur) =>
      cur.includes(id as TimelineLaneId)
        ? cur.filter((x) => x !== id)
        : [...cur, id as TimelineLaneId],
    );

  const sections = model.sections
    .map((s) => ({ ...s, lanes: s.lanes.filter((l) => lanes.includes(l.lane.id)) }))
    .filter((s) => s.lanes.length > 0);

  // Rebind the fold listeners whenever the rendered lanes change.
  useFoldOut(erasRef, foldEnabled, lanes.join(','));
  const overflow = useScrollOverflow(erasRef, lanes.join(','));

  return (
    <section className="mode-panel mode-panel--page mode-panel--wide timeline" aria-labelledby="timeline-title">
      <header className="home__header">
        <h1 id="timeline-title" className="home__title">
          {t('modes.timeline.title')}
        </h1>
        <p className="home__tagline">{t('modes.timeline.tagline')}</p>
      </header>

      <div className="tl-guide">
        <ChartKey />
        <p className="tl-scale-note">
          <strong>Dates stay as written.</strong> Every date shown is the range the content was authored with, never a
          single year the app inferred.
        </p>
        <p className="tl-scale-note">
          <strong>Where the zero is.</strong> The BC/AD scale on every band is reckoned from the Incarnation — Dionysius
          Exiguus set it in 525 to fix the date of Easter, and Bede carried it into common use. The anchor is a few years
          off its own event: Herod the Great died in 4 BC, so the Nativity falls c. 6–4 BC and this timeline draws the life
          of Jesus from 6 BC. The eras before and after it are counted from that point, not from a neutral origin.
        </p>
        <p className="tl-scale-note">
          <strong>Where the chart begins.</strong> The first band opens at Creation (Genesis 1:1). Its years are those of
          Scripture’s genealogies — Ussher’s Masoretic sum is 4004 BC, so the Earth is about six thousand years old on
          this reckoning. Archaeology dates the human layers in that story, not the forming of the planet.
        </p>
      </div>

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

      <fieldset className="atlas-toggles tl-filters">
        <legend>Presentation</legend>
        <label title="Panels hinge away as they scroll past the edge of a band, like opening a folded chart. Only panels already leaving the view move; whatever you are reading stays flat.">
          <input
            type="checkbox"
            checked={foldPref}
            disabled={reducedMotion}
            onChange={(e) => setFoldPref(e.target.checked)}
          />{' '}
          Fold-out chart effect
        </label>
        {reducedMotion && (
          <span className="tl-filters__note">off — your system asks for reduced motion</span>
        )}
      </fieldset>

      <ol className="tl-eras" ref={erasRef} data-fold={foldEnabled ? 'on' : 'off'}>
        {sections.map((section) => (
          <li className="tl-era" key={section.era.id} id={section.era.id}>
            <EraHeader era={section.era} count={section.itemCount} />
            <ChartScrollCue
              eraId={section.era.id}
              lanes={section.lanes.map((l) => l.lane.label)}
              overflow={overflow[section.era.id] ?? ''}
            />
            <div
              className="tl-era__body"
              // The band's height is data-driven (see eraBandHeight): the axis
              // and every lane track read it, so ticks and bars stay aligned.
              style={{ '--band-h': `${eraBandHeight(section)}px` } as React.CSSProperties}
              role="region"
              tabIndex={0}
              // Says what the visible cues say: the sideways instruction is
              // only true while this band actually overflows.
              aria-label={
                overflow[section.era.id]?.includes('x')
                  ? t('modes.timeline.chart.regionLabelLanes', {
                      era: section.era.label,
                      laneCount: section.lanes.length,
                    })
                  : t('modes.timeline.chart.regionLabel', { era: section.era.label })
              }
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
              <ChartOverflowEdge />
            </div>
            {/* The detail card belongs to the band it was opened from, not to
                the top of the page: a reader who taps Jeremiah after scrolling
                through four eras should not be thrown back to the header to
                read about him. */}
            {selected && section.lanes.some((l) => l.items.some((i) => i.id === selected.id)) && (
              <TimelineEntryDetail item={selected} bundle={bundle} onClose={() => setSelected(null)} />
            )}
            {section.lanes.length > 1 && (
              <p className="tl-era__pan-hint">{t('modes.timeline.chart.panHint')}</p>
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
            The content dates these figures nowhere, so they are listed rather than given an invented position.
            Genesis 1–11 is dated from Scripture’s genealogies; a name appears here only when that span was not
            authored.
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
      {item.detail && <p className="claim-prose">{item.detail}</p>}
      {person && <p className="claim-prose">{person.summary.en}</p>}

      {person && (
        <ul className="tl-detail__facts">
          {person.category && (
            <li>
              <strong>{PERSON_CATEGORY_LABEL[person.category] ?? person.category}</strong>
            </li>
          )}
          {person.realm && <li>{person.realm.en}</li>}
          {person.books && person.books.length > 0 && <li>Book(s): {person.books.join(', ')}</li>}
          {site && <li>Based at {shortSiteName(site.ancientName.en)}</li>}
        </ul>
      )}

      <ReferenceStack>
        {item.datingNote && (
          <details className="dispute">
            <summary>About this dating</summary>
            <p>{item.datingNote}</p>
          </details>
        )}
        {(journey || site || item.scriptureRef || (person?.journeyIds?.length ?? 0) > 1) && (
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
        )}
        <Citations ids={item.citations} bundle={bundle} />
      </ReferenceStack>

      <button type="button" className="miracle-card__read" onClick={onClose}>
        Close
      </button>
    </TimelineDetailCard>
  );
}
