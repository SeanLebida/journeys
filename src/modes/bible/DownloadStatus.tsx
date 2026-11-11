import { useBibleDownloads } from '../../state/useBibleDownloads';

/** A one-line note, outside the Translations tab, that a Bible is still downloading. */
export function DownloadStatus({ onOpen }: { onOpen: () => void }) {
  const active = useBibleDownloads((s) => s.active);
  const items = Object.values(active).filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (items.length === 0) return null;
  const text = items
    .map(({ name, progress }) =>
      progress.phase === 'chapters' && progress.total > 0
        ? `${name}: ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} chapters`
        : progress.phase === 'installing'
          ? `${name}: installing`
          : `${name}: downloading`,
    )
    .join(' · ');
  return (
    <p className="bible__download-status" role="status">
      {text}{' '}
      <button type="button" className="backlink" onClick={onOpen}>
        Details
      </button>
    </p>
  );
}
