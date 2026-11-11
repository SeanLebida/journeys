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

      <h2 className="home__heading">Why Journeys exists</h2>
      <p>
        Journeys is here to equip Christians with the knowledge of God&apos;s word and the evidence
        that it speaks of real people, real places and real events. The Bible names kings, cities
        and governors, and over the last two centuries excavations have turned up many of them:
        Pontius Pilate on a dedication stone at Caesarea, the &ldquo;House of David&rdquo; on the
        Tel Dan stele, King Hezekiah&apos;s name pressed into a clay seal. Journeys sets those finds
        beside the passages they speak to, so you can study, teach and answer questions with
        confidence.
      </p>
      <p>
        It follows the whole story, from Creation and the patriarchs through the exodus, the kings
        and prophets, the life and ministry of Jesus, and the travels of the apostles, on a map of
        the world where it happened. Journeys takes no side between denominations.
      </p>

      <h2 className="home__heading">Six ways to explore</h2>
      <ul className="credits-list">
        <li>
          <strong>Journeys</strong>: watch a route unfold leg by leg and read the story at every
          stop, from Abraham&apos;s travels and the exodus to Jesus in Galilee, the Twelve, and
          Paul&apos;s three journeys and his voyage to Rome.
        </li>
        <li>
          <strong>Atlas</strong>: explore the ancient Mediterranean and Near East freely, with Roman
          roads, borders and settlements, and tap any place for its Scripture, history and finds.
        </li>
        <li>
          <strong>Timeline</strong>: see who lived at the same time, from Creation to the apostles.
          Each era is drawn to its own scale, so the week of the Passion isn&apos;t lost against
          three thousand years.
        </li>
        <li>
          <strong>Bible reader</strong>: read Scripture beside the map and tap a place name to fly
          to it. Six complete translations are built in: the King James Version, American Standard
          Version, Berean Standard Bible, World English Bible, Young&apos;s Literal Translation and
          the Geneva Bible (1599). You can download more from the Translations tab, including the
          NASB 1995 and 2020. Highlights and notes stay on your device.
        </li>
        <li>
          <strong>Lessons</strong>: step-by-step walk-throughs of key events, with the map moving as
          you read.
        </li>
        <li>
          <strong>Quizzes</strong>: test what you&apos;ve learned about places, people and the order
          of events.
        </li>
      </ul>

      <h2 className="home__heading">Honest about the evidence</h2>
      <p>
        Faith is not afraid of the facts, so Journeys shows you how strong each piece of evidence
        really is.
      </p>
      <ul className="credits-list">
        <li>
          <strong>Every claim is cited</strong> to Scripture, ancient historians such as Josephus
          and Tacitus, royal annals, Roman itineraries, excavation reports or museum records, and
          never to Wikipedia alone.
        </li>
        <li>
          <strong>Every stop, find, battle, miracle and witness is graded</strong> as{' '}
          <code>high</code>, <code>medium</code>, <code>disputed</code> or <code>legendary</code>, so
          a site confirmed by excavation is never confused with a later tradition.
        </li>
        <li>
          <strong>Rival locations are shown.</strong> When scholars disagree about where a place
          was, you see each candidate on the map as a hollow marker instead of a single guess.
        </li>
        <li>
          <strong>Routes are drawn honestly.</strong> Surveyed Roman roads, reconstructed routes,
          sea lanes and simple connecting lines each look different, so a reconstruction is never
          mistaken for a surveyed road.
        </li>
      </ul>

      <h2 className="home__heading">Works anywhere, private by design</h2>
      <ul className="credits-list">
        <li>
          The built-in Bibles, the journeys and the base map work offline after install: in church,
          in class, on a plane or in the Holy Land.
        </li>
        <li>
          Satellite, ancient-map and video layers need a connection, and so does downloading another
          translation. Once downloaded, a translation reads offline.
        </li>
        <li>No account, no ads and no tracking.</li>
        <li>Your highlights and notes stay on your device.</li>
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
        Scripture quotations are from public-domain translations: the American Standard Version,
        King James Version, Berean Standard Bible, World English Bible, Young&apos;s Literal
        Translation and Geneva Bible (1599), with the newer four drawn from AO Lab&apos;s Free Use
        Bible API. The KJV is public domain worldwide except in the United Kingdom, where it
        is under Crown copyright. Translations you download from the reader&apos;s Translations tab
        also come from the Free Use Bible API; each one&apos;s license and attribution are shown beside
        it there and under its text in the reader. The New American Standard Bible (NASB 1995 and
        NASB 2020), when you download it, is copyright The Lockman Foundation, used by permission
        through YouVersion, and shown with Lockman&apos;s notice wherever it is quoted;{' '}
        <a href="https://www.lockman.org" target="_blank" rel="noreferrer">lockman.org</a>.
      </p>
    </section>
  );
}

export const AboutView = CreditsView;
