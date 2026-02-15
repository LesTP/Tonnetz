/**
 * Persistence/Data — Storage abstraction.
 *
 * Thin interface over key-value storage backends.
 * Memory backend for tests and fallback; localStorage backend for production.
 *
 * All backends implement the same StorageBackend interface so that
 * higher-level modules (progressions, settings, sharing) are backend-agnostic.
 */

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Minimal key-value storage contract.
 * Matches the subset of `Storage` (Web API) used by Persistence/Data.
 */
export interface StorageBackend {
  /** Retrieve value by key. Returns `null` if key does not exist. */
  getItem(key: string): string | null;
  /** Store a value under key. Overwrites any existing value. */
  setItem(key: string, value: string): void;
  /** Remove a key. No-op if key does not exist. */
  removeItem(key: string): void;
  /** Return all keys currently stored. */
  keys(): string[];
}

// ---------------------------------------------------------------------------
// Memory backend
// ---------------------------------------------------------------------------

/**
 * In-memory storage backend backed by a `Map<string, string>`.
 * Used for unit tests and as a fallback when localStorage is unavailable.
 */
export function createMemoryStorageBackend(): StorageBackend {
  const store = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      store.set(key, value);
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    keys(): string[] {
      return Array.from(store.keys());
    },
  };
}

// ---------------------------------------------------------------------------
// localStorage backend
// ---------------------------------------------------------------------------

/**
 * Browser localStorage backend.
 * Wraps `window.localStorage` with error handling for quota exceeded,
 * private browsing restrictions, and other runtime failures.
 *
 * @throws {StorageError} on setItem failure (quota exceeded, security error)
 */
export function createLocalStorageBackend(): StorageBackend {
  return {
    getItem(key: string): string | null {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        throw new StorageError(
          `Failed to write key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(key);
      } catch {
        // Swallow — removal failure is non-critical
      }
    },
    keys(): string[] {
      try {
        const result: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key !== null) result.push(key);
        }
        return result;
      } catch {
        return [];
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Typed error for storage operation failures. */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}
