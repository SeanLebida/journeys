import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBundle } from '../content/useBundle';
import { SourcingDisclosure } from './SourcingDisclosure';

function isWikiCredit(a: { name: string; url?: string }): boolean {
  // Name only — KJV/ASV credit links point at Wikipedia articles but are not
  // Wikipedia attributions; keep scripture/software credits above Wikimedia.
  const name = a.name.toLowerCase();
  return name.includes('wikipedia') || name.includes('wikimedia');
}

/** Scholarly / primary data credits above Wikipedia/Wikimedia in the list. */
function sortAttributionsForDisplay<T extends { name: string; url?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const wa = isWikiCredit(a) ? 1 : 0;
    const wb = isWikiCredit(b) ? 1 : 0;
    if (wa !== wb) return wa - wb;
    return 0; // keep relative order among non-wiki / among wiki
  });
}

export function CreditsView() {
  const { t } = useTranslation();
  const { bundle } = useBundle();
  const attributions = sortAttributionsForDisplay(bundle?.attributions ?? []);
  return (
    <section className="mode-panel mode-panel--page" aria-labelledby="about-title">
      <Link to="/" className="backlink">
        ← {t('nav.home')}
      </Link>
      <h1 id="about-title" className="mode-panel__title">
        About Journeys
      </h1>
      <p>
        {t('app.tagline')}. Built with open data and public-domain texts. Version{' '}
        {bundle?.version ?? '0.3.14'} · content {bundle?.integrity ?? '—'}.
      </p>

      <h2 className="home__heading">The biblical historical record</h2>
      <p>
        Journeys is an accurate, cited, offline atlas of the historical record in the Bible. The
        chronology runs from Creation through the patriarchs, the exodus and conquest, the kings and
        prophets, the battles of the Old Testament, the birth and ministry of Jesus, and on to the
        travels of the apostles. It is biblically, geographically, historically, and archaeologically
        grounded, with a denominationally neutral stance.
      </p>
      <p>
        Whether studying Scripture, teaching, or exploring ancient history, Journeys turns that
        record from flat paper maps into an interactive exploration across the ancient Mediterranean
        and Near East.
      </p>

      <h2 className="home__heading">Six ways to explore</h2>
      <ul className="credits-list">
        <li>
          <strong>Route Tracing (⟿)</strong> — Follow animated journeys on the ancient map. Trace the
          patriarchs, the exodus, the conquest, the kings, and the ministry routes of Jesus across
          Galilee and Judea, then Paul (First, Second, Third Missionary Journeys, and the voyage to
          Rome). Inspect terrain, travel legs, and stop-by-stop accounts.
        </li>
        <li>
          <strong>Sandbox Atlas (◍)</strong> — Freely explore the ancient Mediterranean and Near
          Eastern world with toggleable historical layers. Inspect Roman roads, trade lanes,
          provincial borders, and ancient settlements with rich topographical context.
        </li>
        <li>
          <strong>Biblical Timeline (≣)</strong> — A unified chronology from Creation through the
          apostolic age. Each era has its own proportional scale so Passion week is not flattened
          against three millennia. Parallel swimlanes track figures, prophets, kings, battles, finds,
          and the life and ministry of Jesus.
        </li>
        <li>
          <strong>Embedded Bible Reader (▤)</strong> — Read Scripture alongside the map. Complete
          public-domain translations (King James Version and American Standard Version) bundled in a
          fast, on-device SQLite database. Tap place names in Scripture to jump straight to their
          location on the map, with private highlighting and local notes.
        </li>
        <li>
          <strong>Guided Lessons (❖)</strong> — Paced, step-by-step deep dives into biblical events,
          examining cultural context, physical geography, and archaeological finds.
        </li>
        <li>
          <strong>Interactive Quizzes (?)</strong> — Test and deepen your knowledge of ancient
          geography, apostolic travels, and historical chronology.
        </li>
      </ul>

      <h2 className="home__heading">Archaeology &amp; primary sources</h2>
      <ul className="credits-list">
        <li>
          <strong>Cited claims</strong> — Every site and route stop is anchored to primary historical
          texts (Scripture, Josephus, Tacitus, cuneiform annals, Roman itineraries) and excavation
          records.
        </li>
        <li>
          <strong>Transparent confidence</strong> — Ratings (<code>high</code>, <code>medium</code>,{' '}
          <code>disputed</code>, <code>legendary</code>) distinguish between securely attested sites
          and contested traditions.
        </li>
        <li>
          <strong>Rival candidates shown</strong> — When scholars disagree on a biblical site’s
          location, Journeys displays documented rivals as hollow markers on the map rather than
          guessing a single pin.
        </li>
        <li>
          <strong>Graded route strokes</strong> — Surveyed Roman roads, reconstructed travel
          corridors, sea lanes, and schematic connectors are drawn distinctly so reconstructions are
          never mistaken for surveyed roads.
        </li>
      </ul>

      <h2 className="home__heading">100% offline &amp; privacy first</h2>
      <p>
        Journeys works anywhere — in church, in the classroom, on flights, or in the field:
      </p>
      <ul className="credits-list">
        <li>Complete 10 MB on-device SQLite Scripture database included in the binary.</li>
        <li>Offline vector map tiles bundled directly inside the app.</li>
        <li>No internet connection required after install.</li>
        <li>Zero data collection, zero tracking, no accounts required, and completely ad-free.</li>
        <li>Personal study notes and reading highlights stay exclusively on your device.</li>
      </ul>

      <h2 className="home__heading">How we handle accuracy</h2>
      <SourcingDisclosure />

      <h2 className="home__heading">Data &amp; software credits</h2>
      <ul className="credits-list">
        {attributions.map((a) => (
          <li key={a.id}>
            {a.url ? (
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.name}
              </a>
            ) : (
              a.name
            )}{' '}
            — <span className="credits-list__license">{a.license}</span>
          </li>
        ))}
        <li>
          Maps rendered with{' '}
          <a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">
            MapLibre GL JS
          </a>
          . Ancient-world geodata (Pleiades, AWMC, ORBIS) and basemap tiles are integrated under open
          redistribution licenses.
        </li>
        <li>
          Interface type is{' '}
          <a href="https://design.ubuntu.com/font" target="_blank" rel="noopener noreferrer">
            Ubuntu
          </a>{' '}
          — <span className="credits-list__license">Ubuntu Font Licence 1.0</span>
        </li>
        <li>
          Scripture and book-face labels use{' '}
          <a href="https://github.com/octaviopardo/EBGaramond12" target="_blank" rel="noopener noreferrer">
            EB Garamond
          </a>{' '}
          — <span className="credits-list__license">SIL Open Font Licence 1.1</span>
        </li>
      </ul>

      <p className="credits-note">
        Scripture quotations are from public-domain translations (King James Version; American
        Standard Version). The KJV is public domain worldwide except in the United Kingdom, where it
        is under Crown copyright.
      </p>
    </section>
  );
}

export const AboutView = CreditsView;
