import { useUiStore, type StreamedTranslation } from '../state/useUiStore';
import type { DownloadedTranslation } from './downloads';
import { isDownloadedId, isLicensedId, isTranslation, translationInfo, type TranslationId } from './translations';

/** How the reader names and credits whichever translation is showing. */
export interface TranslationMeta {
  id: TranslationId;
  /** Short tag shown beside chapter titles and quotes, e.g. `KJV` or `LSV`. */
  label: string;
  name: string;
  /** One line on where the text comes from and its terms. */
  sourcing: string;
  licenseUrl?: string;
  /** Publisher's copyright notice; licensed translations must show it with the text. */
  notice?: string;
  rtl: boolean;
}

export function translationMeta(id: TranslationId, downloaded: DownloadedTranslation[], streamed: StreamedTranslation[] = []): TranslationMeta {
  if (isTranslation(id)) {
    const t = translationInfo(id);
    return { id, label: id, name: t.name, sourcing: 'public domain, bundled for offline reading.', licenseUrl: t.infoUrl, rtl: false };
  }
  const d = isDownloadedId(id) ? downloaded.find((x) => x.id === id) : undefined;
  const online = !d && isLicensedId(id) ? streamed.find((x) => x.id === id) : undefined;
  if (online) {
    return {
      id,
      label: online.shortName,
      name: online.name,
      sourcing: 'used by permission, via YouVersion, read online (not stored on this device).',
      licenseUrl: online.publisherUrl ?? undefined,
      notice: online.notice ?? `© ${online.publisher ?? 'the publisher'}. Used by permission.`,
      rtl: online.rtl,
    };
  }
  if (!d) return { id, label: id, name: id, sourcing: 'downloaded to this device.', rtl: false };
  if (isLicensedId(id)) {
    return {
      id,
      label: d.shortName,
      name: d.name,
      sourcing: 'used by permission, via YouVersion, downloaded to this device.',
      licenseUrl: d.licenseUrl,
      notice: d.notice,
      rtl: false,
    };
  }
  return {
    id,
    label: d.shortName,
    name: d.name,
    sourcing: `${d.licenseLabel}, via AO Lab's Free Use Bible API, downloaded to this device.`,
    licenseUrl: d.licenseUrl,
    rtl: d.rtl,
  };
}

export function useTranslationMeta(): TranslationMeta {
  const translation = useUiStore((s) => s.translation);
  const downloaded = useUiStore((s) => s.downloaded);
  const streamed = useUiStore((s) => s.streamed);
  return translationMeta(translation, downloaded, streamed);
}
