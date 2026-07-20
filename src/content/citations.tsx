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
 * so a reconstructed corridor or schematic connector is never read as a
 * surveyed road just because it renders as a confident line.
 */
export function RouteGeometryNote({ grades }: { grades?: TGeometryGrade[] }) {
  const { t } = useTranslation();
  const used = [...new Set(grades ?? [])];
  if (used.length === 0) return null;
  return (
    <details className="geometry-note">
      <summary>{t('sourcing.geometry.title')}</summary>
      <ul className="geometry-note__list">
        {used.map((g) => (
          <li key={g}>
            <span className={`geometry geometry--${g}`} />
            {t(`sourcing.geometry.${g}`)}
          </li>
        ))}
      </ul>
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
