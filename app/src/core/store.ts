// The one storage interface the core works against. The real one is the Android keystore
// (expo-secure-store, app/src/platform/secureStore.ts); the tests use the memory one.
//
// Deliberately tiny and synchronous-looking (promises, but no transactions): everything the app
// stores is a small value under a known key, and the only ordering that matters is "write the
// record before asking the wallet".
export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys are enumerated from an index the store keeps itself — SecureStore cannot list. */
  keys(): Promise<string[]>;
}

const INDEX = "__keys";

/** In-memory store for tests, with the same index behaviour as the real one. */
export class MemoryStore implements Store {
  private data = new Map<string, string>();
  /** Set in tests to make a write fail exactly once, like a phone dying mid-write. */
  failNextWrite = false;

  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("storage failed");
    }
    this.data.set(key, value);
    if (key !== INDEX) await this.addToIndex(key);
  }
  async delete(key: string) {
    this.data.delete(key);
    const keys = (await this.keys()).filter((k) => k !== key);
    this.data.set(INDEX, JSON.stringify(keys));
  }
  async keys() {
    const raw = this.data.get(INDEX);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
  private async addToIndex(key: string) {
    const keys = await this.keys();
    if (!keys.includes(key)) this.data.set(INDEX, JSON.stringify([...keys, key]));
  }
  /** Everything the store holds — for the diagnosis screen and for tests. */
  snapshot() {
    return Object.fromEntries(this.data);
  }
}

/** Reads a JSON value, or null if it is missing or unreadable. Never throws on bad data: a
 *  corrupt record must not keep the app from starting. */
export async function getJson<T>(store: Store, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setJson = (store: Store, key: string, value: unknown) =>
  store.set(key, JSON.stringify(value));
