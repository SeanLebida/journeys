import { Link } from 'react-router-dom';
import { existingJourneyId } from '../../content/existingJourney';
import type { BundleIndex } from '../../content/useBundle';
import { traceJourneyHref } from './traceHref';

/** Renders a trace link only when the bundle actually has that journey. */
export function TraceJourneyLink({
  bundle,
  journeyId,
  stop,
  className,
  children,
}: {
  bundle: BundleIndex;
  journeyId?: string;
  stop?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const id = existingJourneyId(bundle, journeyId);
  if (!id) return null;
  return (
    <Link to={traceJourneyHref(id, stop)} className={className}>
      {children}
    </Link>
  );
}
