import { loadManifest, type ContentManifest } from '../platform/assets';
import { useDownloadStore } from '../state/useDownloadStore';

// Over-the-air content channel. Content is versioned independently of the app
// binary, so a citation/coordinate correction can ship without a store
// resubmission. The remote manifest URL is configurable; when unset (default),
// the app simply runs on its bundled content. The integrity hash changes
// whenever any content changes, so it is the update signal.
const REMOTE_MANIFEST_URL: string | undefined = import.meta.env.VITE_CONTENT_MANIFEST_URL;

export interface UpdateCheck {
  updateAvailable: boolean;
  local: ContentManifest;
  remote?: ContentManifest;
}

/** Record the installed content version on startup. */
export async function initContentVersion(): Promise<void> {
  try {
    const local = await loadManifest();
    useDownloadStore.getState().setContentVersion(local.version);
  } catch {
    /* bundled content missing in dev before build:content — ignore */
  }
}

/**
 * Compare the bundled content against the remote manifest, if a remote URL is
 * configured. Network/parse failures degrade to "no update" so offline use is
 * unaffected. Applying an update (downloading the new bundle + DB and swapping
 * the cached copies) is the next step on top of this signal.
 */
export async function checkForContentUpdate(): Promise<UpdateCheck | null> {
  let local: ContentManifest;
  try {
    local = await loadManifest();
  } catch {
    return null;
  }
  if (!REMOTE_MANIFEST_URL) return { updateAvailable: false, local };
  try {
    const res = await fetch(REMOTE_MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return { updateAvailable: false, local };
    const remote = (await res.json()) as ContentManifest;
    return { updateAvailable: remote.integrity !== local.integrity, local, remote };
  } catch {
    return { updateAvailable: false, local };
  }
}
