import { expect, it } from 'vitest';
import { CHAPTER_OFFLINE, VERSION_LIST_FAILED } from '../../src/content/bibleCopy';
import { fetchCatalog, loadCatalog, loadLanguages } from '../../src/content/youversionCatalog';

it('a failed version list uses the plain sentence and keeps the English language fallback', async () => {
  const fetchImpl = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch;
  await expect(fetchCatalog('en', { fetchImpl })).rejects.toThrow(VERSION_LIST_FAILED);
  const storage = { getItem: async () => null, setItem: async () => undefined };
  const catalog = await loadCatalog('en', { fetchImpl, storage });
  expect(catalog.error).toBe(VERSION_LIST_FAILED);
  expect(catalog.error).not.toMatch(/\d{3}/);
  const languages = await loadLanguages('en', { fetchImpl, storage });
  expect(languages.map((l) => l.tag)).toEqual(['en']);
});

it('states the offline sentence exactly', () => {
  expect(CHAPTER_OFFLINE).toBe("You're offline. Your downloaded versions are still here.");
});
