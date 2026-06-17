import { useTranslation } from 'react-i18next';

const CONFIDENCE_KEYS = ['high', 'medium', 'legendary', 'disputed'] as const;

/**
 * The standing "How we source" disclosure. The accuracy decision is "cited,
 * reviewed — not definitive", so this is always reachable and explains the
 * confidence levels and dispute handling honestly.
 */
export function SourcingDisclosure() {
  const { t } = useTranslation();
  return (
    <details className="sourcing">
      <summary>{t('sourcing.title')}</summary>
      <div className="sourcing__body">
        <p>{t('sourcing.body')}</p>
        <dl className="sourcing__confidence">
          {CONFIDENCE_KEYS.map((k) => (
            <div key={k} className="sourcing__row">
              <dt className={`confidence confidence--${k}`}>{k}</dt>
              <dd>{t(`sourcing.confidence.${k}`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
