/** First id in the list that actually exists on the bundle, if any. */
export function firstExistingJourneyId(
  bundle: { journey: (id: string) => unknown },
  ids: readonly string[] | undefined,
): string | undefined {
  if (!ids) return undefined;
  return ids.find((id) => Boolean(bundle.journey(id)));
}

/** The journey id if this bundle has that journey, otherwise undefined. */
export function existingJourneyId(
  bundle: { journey: (id: string) => unknown },
  journeyId: string | undefined | null,
): string | undefined {
  return firstExistingJourneyId(bundle, journeyId ? [journeyId] : undefined);
}
