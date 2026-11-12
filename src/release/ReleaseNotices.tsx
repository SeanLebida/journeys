import { useEffect, useState } from 'react';
import {
  DISMISSED_UPDATE_KEY,
  LAST_SEEN_VERSION_KEY,
  readKey,
  shouldShowWhatsNew,
  stepsSince,
  writeKey,
  type WhatsNewStep,
} from './whatsNew';
import { checkForUpdate, installedVersion, openStore } from './storeUpdate';

export interface ReleaseNoticesProps {
  /** Injected in tests; the app reads the installed build and the store. */
  getVersion?: () => Promise<string>;
  getUpdate?: (dismissed: string | null) => Promise<string | null>;
  onOpenStore?: () => Promise<unknown>;
  /** Overrides the steps worked out from the installed and last-seen versions. */
  steps?: WhatsNewStep[];
}

/**
 * After an update: a short What's new walkthrough, once per version.
 * Otherwise: a reminder when the store has a newer version with fixes.
 */
export function ReleaseNotices({
  getVersion = installedVersion,
  getUpdate = checkForUpdate,
  onOpenStore = openStore,
  steps: stepsOverride,
}: ReleaseNoticesProps) {
  const [version, setVersion] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [steps, setSteps] = useState<WhatsNewStep[]>([]);
  const [offer, setOffer] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const v = await getVersion();
      if (!live) return;
      setVersion(v);
      const lastSeen = readKey(LAST_SEEN_VERSION_KEY);
      if (lastSeen === null && v.trim()) writeKey(LAST_SEEN_VERSION_KEY, v.trim());
      const pending = stepsOverride ?? stepsSince(lastSeen, v);
      if (shouldShowWhatsNew(v, lastSeen, pending)) {
        setSteps(pending);
        setStep(0);
        return;
      }
      // Nothing new to say for this update: remember it so older notes never come back.
      if (lastSeen !== null && v.trim() && lastSeen !== v.trim()) writeKey(LAST_SEEN_VERSION_KEY, v.trim());
      const o = await getUpdate(readKey(DISMISSED_UPDATE_KEY));
      if (live) setOffer(o);
    })();
    return () => {
      live = false;
    };
  }, [getVersion, getUpdate, stepsOverride]);

  const finishWalkthrough = () => {
    writeKey(LAST_SEEN_VERSION_KEY, version);
    setStep(null);
  };

  if (step !== null) {
    const s = steps[step];
    const last = step === steps.length - 1;
    return (
      <div className="release-notice" role="dialog" aria-modal="false" aria-labelledby="whats-new-title">
        <p className="release-notice__eyebrow">
          What&apos;s new · {step + 1} of {steps.length}
        </p>
        <h2 id="whats-new-title" className="release-notice__title">
          {s.title}
        </h2>
        <p className="release-notice__body">{s.body}</p>
        <div className="release-notice__actions">
          {step > 0 ? (
            <button type="button" className="release-notice__btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="release-notice__btn" onClick={finishWalkthrough}>
              Skip
            </button>
          )}
          <button
            type="button"
            className="release-notice__btn release-notice__btn--primary"
            onClick={last ? finishWalkthrough : () => setStep(step + 1)}
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    );
  }

  if (offer) {
    return (
      <div className="release-notice" role="dialog" aria-modal="false" aria-labelledby="update-title">
        <h2 id="update-title" className="release-notice__title">
          Update available
        </h2>
        <p className="release-notice__body">Journeys {offer} is ready with bug fixes and improvements.</p>
        <div className="release-notice__actions">
          <button
            type="button"
            className="release-notice__btn"
            onClick={() => {
              writeKey(DISMISSED_UPDATE_KEY, offer);
              setOffer(null);
            }}
          >
            Later
          </button>
          <button
            type="button"
            className="release-notice__btn release-notice__btn--primary"
            onClick={() => void onOpenStore()}
          >
            Update
          </button>
        </div>
      </div>
    );
  }
  return null;
}
