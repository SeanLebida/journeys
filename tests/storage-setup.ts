/** Node 26 exposes localStorage as an empty getter unless --localstorage-file is set, which hides jsdom's storage. */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

function usable(storage: Storage | undefined): boolean {
  return typeof storage?.clear === 'function' && typeof storage?.getItem === 'function';
}

if (!usable(globalThis.localStorage) || !usable(globalThis.sessionStorage)) {
  const local = memoryStorage();
  const session = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: local, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: session, configurable: true });
  }
}
