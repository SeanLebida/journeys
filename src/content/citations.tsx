import { useTranslation } from 'react-i18next';
import type { BundleIndex } from './useBundle';
import { useScripture } from './useBible';
import { useUiStore } from '../state/useUiStore';
import type { TConfidence, TGeometryGrade } from './schema';

export function ConfidenceBadge({ confidence }: { confidence: TConfidence }) {
  const { t } = useTranslation();
  return (
    <span className={`confidence confidence--${confidence}`} title={t(`sourcing.confidence.${confidence}`)}>
      {confidence}
    </span>
  );
}

export function DisputeNote({ text }: { text?: string }) {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <details className="dispute">
      <summary>{t('common.disputes')}</summary>
      <p>{text}</p>
    </details>
  );
}

/**
 * Honest per-journey geometry caveat: names every grade the drawn path uses,
 * explains the historical/archaeological basis (including water crossings),
 * and lists route citations.
 */
export function RouteGeometryNote({
  grades,
  note,
  citations,
  bundle,
}: {
  grades?: TGeometryGrade[];
  note?: string;
  citations?: string[];
  bundle?: BundleIndex;
}) {
  const { t } = useTranslation();
  const used = [...new Set(grades ?? [])];
  if (used.length === 0 && !note && (!citations || citations.length === 0)) return null;
  return (
    <details className="geometry-note">
      <summary>{t('sourcing.geometry.title')}</summary>
      <div className="geometry-note__content" style={{ marginTop: '0.4rem' }}>
        {note && <p className="geometry-note__text" style={{ margin: '0 0 0.4rem', color: 'var(--text-muted)' }}>{note}</p>}
        {used.length > 0 && (
          <ul className="geometry-note__list">
            {used.map((g) => (
              <li key={g}>
                <span className={`geometry geometry--${g}`} />
                {t(`sourcing.geometry.${g}`)}
              </li>
            ))}
          </ul>
        )}
        {citations && citations.length > 0 && bundle && (
          <Citations ids={citations} bundle={bundle} />
        )}
      </div>
    </details>
  );
}

/** Inline, collapsible list of sources for a set of citation ids. */
export function Citations({ ids, bundle }: { ids: string[]; bundle: BundleIndex }) {
  const { t } = useTranslation();
  const resolved = ids.map((id) => bundle.citation(id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (resolved.length === 0) return null;
  return (
    <details className="citations">
      <summary>
        {t('common.citations')} ({resolved.length})
      </summary>
      <ul className="citations__list">
        {resolved.map((c) => (
          <li key={c.id}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                {c.source.en}
              </a>
            ) : (
              c.source.en
            )}
            <span className="citations__kind"> · {c.kind}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Render the verse text for a scripture reference in the current translation. */
export function ScripturePassage({ raw }: { raw: string }) {
  const translation = useUiStore((s) => s.translation);
  const { rows, loading, error } = useScripture(raw, translation);
  if (loading) return <span className="scripture scripture--loading">{raw}…</span>;
  if (error || rows.length === 0) return <span className="scripture scripture--missing">{raw}</span>;
  return (
    <blockquote className="scripture">
      <p className="scripture__text">
        {rows.map((r) => (
          <span key={r.verse}>
            <sup className="scripture__num">{r.verse}</sup> {r.text}{' '}
          </span>
        ))}
      </p>
      <cite className="scripture__ref">
        {raw} ({translation})
      </cite>
    </blockquote>
  );
}
