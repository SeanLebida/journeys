import { useEffect, useState } from 'react';
import { BIBLE_PROXY_URL } from '../../content/youversion';

/**
 * A YouVersion version's copyright notice. The catalog list leaves `copyright`
 * empty, so the detail sheet asks the proxy for that one Bible (GET
 * /v1/bibles/{id}, metadata only: nothing is downloaded or reported).
 * Cached for the session so reopening a version is instant.
 */
const cache = new Map<number, string | null>();

export type NoticeState = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string | null; retry: () => void };

export function useVersionNotice(yvId: number | null): NoticeState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ status: NoticeState['status']; text: string | null }>(() =>
    yvId === null ? { status: 'idle', text: null } : cache.has(yvId) ? { status: 'ready', text: cache.get(yvId) ?? null } : { status: 'loading', text: null },
  );
  useEffect(() => {
    if (yvId === null) return setState({ status: 'idle', text: null });
    if (cache.has(yvId)) return setState({ status: 'ready', text: cache.get(yvId) ?? null });
    const ctl = new AbortController();
    setState({ status: 'loading', text: null });
    fetch(`${BIBLE_PROXY_URL}/v1/bibles/${yvId}`, { headers: { 'X-Journeys-Client': 'journeys' }, signal: ctl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { copyright?: unknown };
        const text = typeof body.copyright === 'string' && body.copyright.trim() ? body.copyright.trim() : null;
        cache.set(yvId, text);
        setState({ status: 'ready', text });
      })
      .catch(() => !ctl.signal.aborted && setState({ status: 'error', text: null }));
    return () => ctl.abort();
  }, [yvId, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
