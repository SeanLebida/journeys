import { CHAPTER_WAITING, ReaderNotice } from '../../content/bibleCopy';

export function readerStatusText(input: {
  loading: boolean;
  waiting: boolean;
  error: unknown;
  chapterLabel: string;
}): string | null {
  if (input.loading && input.waiting) return CHAPTER_WAITING;
  if (input.loading) return 'Loading…';
  if (input.error instanceof ReaderNotice) return input.error.message;
  if (input.error instanceof Error) return `Could not load ${input.chapterLabel}: ${input.error.message}`;
  return null;
}
