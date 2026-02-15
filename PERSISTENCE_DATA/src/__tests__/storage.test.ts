import { describe, it, expect, vi } from "vitest";
import {
  createMemoryStorageBackend,
  createLocalStorageBackend,
  StorageError,
  type StorageBackend,
} from "../storage.js";

// ---------------------------------------------------------------------------
// Memory backend
// ---------------------------------------------------------------------------

describe("createMemoryStorageBackend", () => {
  it("returns a StorageBackend", () => {
    const backend = createMemoryStorageBackend();
    expect(typeof backend.getItem).toBe("function");
    expect(typeof backend.setItem).toBe("function");
    expect(typeof backend.removeItem).toBe("function");
    expect(typeof backend.keys).toBe("function");
  });

  it("set/get round-trip", () => {
    const b = createMemoryStorageBackend();
    b.setItem("a", "hello");
    expect(b.getItem("a")).toBe("hello");
  });

  it("getItem returns null for missing key", () => {
    const b = createMemoryStorageBackend();
    expect(b.getItem("nonexistent")).toBeNull();
  });

  it("removeItem deletes key", () => {
    const b = createMemoryStorageBackend();
    b.setItem("x", "1");
    expect(b.getItem("x")).toBe("1");
    b.removeItem("x");
    expect(b.getItem("x")).toBeNull();
  });

  it("removeItem on missing key is a no-op", () => {
    const b = createMemoryStorageBackend();
    expect(() => b.removeItem("missing")).not.toThrow();
  });

  it("keys() lists all stored keys", () => {
    const b = createMemoryStorageBackend();
    b.setItem("k1", "v1");
    b.setItem("k2", "v2");
    b.setItem("k3", "v3");
    const keys = b.keys();
    expect(keys).toHaveLength(3);
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
    expect(keys).toContain("k3");
  });

  it("keys() returns empty array when empty", () => {
    const b = createMemoryStorageBackend();
    expect(b.keys()).toEqual([]);
  });

  it("overwrite existing key", () => {
    const b = createMemoryStorageBackend();
    b.setItem("key", "first");
    b.setItem("key", "second");
    expect(b.getItem("key")).toBe("second");
    expect(b.keys()).toHaveLength(1);
  });

  it("stores empty string values", () => {
    const b = createMemoryStorageBackend();
    b.setItem("empty", "");
    expect(b.getItem("empty")).toBe("");
  });

  it("handles keys with special characters", () => {
    const b = createMemoryStorageBackend();
    b.setItem("tonnetz:prog:abc-123", '{"data":true}');
    expect(b.getItem("tonnetz:prog:abc-123")).toBe('{"data":true}');
  });

  it("instances are isolated from each other", () => {
    const a = createMemoryStorageBackend();
    const b = createMemoryStorageBackend();
    a.setItem("shared-key", "from-a");
    expect(b.getItem("shared-key")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// localStorage backend (mock-based)
// ---------------------------------------------------------------------------

describe("createLocalStorageBackend", () => {
  // Minimal localStorage mock
  function mockLocalStorage() {
    const store = new Map<string, string>();
    const mock = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      key: vi.fn((index: number) => {
        const keys = Array.from(store.keys());
        return keys[index] ?? null;
      }),
      get length() {
        return store.size;
      },
    };
    vi.stubGlobal("localStorage", mock);
    return mock;
  }

  it("getItem delegates to localStorage", () => {
    const mock = mockLocalStorage();
    mock.setItem("k", "v");
    const b = createLocalStorageBackend();
    expect(b.getItem("k")).toBe("v");
    expect(mock.getItem).toHaveBeenCalledWith("k");
  });

  it("getItem returns null for missing key", () => {
    mockLocalStorage();
    const b = createLocalStorageBackend();
    expect(b.getItem("nope")).toBeNull();
  });

  it("setItem delegates to localStorage", () => {
    const mock = mockLocalStorage();
    const b = createLocalStorageBackend();
    b.setItem("a", "b");
    expect(mock.setItem).toHaveBeenCalledWith("a", "b");
  });

  it("removeItem delegates to localStorage", () => {
    const mock = mockLocalStorage();
    const b = createLocalStorageBackend();
    b.removeItem("gone");
    expect(mock.removeItem).toHaveBeenCalledWith("gone");
  });

  it("keys() enumerates all localStorage keys", () => {
    const mock = mockLocalStorage();
    mock.setItem("x", "1");
    mock.setItem("y", "2");
    const b = createLocalStorageBackend();
    const keys = b.keys();
    expect(keys).toHaveLength(2);
    expect(keys).toContain("x");
    expect(keys).toContain("y");
  });

  it("getItem returns null when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    const b = createLocalStorageBackend();
    expect(b.getItem("key")).toBeNull();
  });

  it("setItem throws StorageError when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    const b = createLocalStorageBackend();
    expect(() => b.setItem("key", "value")).toThrow(StorageError);
    expect(() => b.setItem("key", "value")).toThrow(/QuotaExceededError/);
  });

  it("removeItem swallows errors silently", () => {
    vi.stubGlobal("localStorage", {
      removeItem: () => {
        throw new Error("fail");
      },
    });
    const b = createLocalStorageBackend();
    expect(() => b.removeItem("key")).not.toThrow();
  });

  it("keys() returns empty array when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      get length(): number {
        throw new Error("fail");
      },
    });
    const b = createLocalStorageBackend();
    expect(b.keys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// StorageError
// ---------------------------------------------------------------------------

describe("StorageError", () => {
  it("is an instance of Error", () => {
    const err = new StorageError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StorageError);
  });

  it('has name "StorageError"', () => {
    const err = new StorageError("msg");
    expect(err.name).toBe("StorageError");
  });

  it("preserves message", () => {
    const err = new StorageError("quota exceeded");
    expect(err.message).toBe("quota exceeded");
  });
});

// ---------------------------------------------------------------------------
// Interface contract: both backends satisfy StorageBackend
// ---------------------------------------------------------------------------

describe("StorageBackend contract", () => {
  const backends: [string, () => StorageBackend][] = [
    ["memory", createMemoryStorageBackend],
  ];

  for (const [name, factory] of backends) {
    describe(name, () => {
      it("full CRUD cycle", () => {
        const b = factory();
        // empty
        expect(b.keys()).toEqual([]);
        expect(b.getItem("k")).toBeNull();
        // create
        b.setItem("k", "v");
        expect(b.getItem("k")).toBe("v");
        expect(b.keys()).toEqual(["k"]);
        // update
        b.setItem("k", "v2");
        expect(b.getItem("k")).toBe("v2");
        expect(b.keys()).toHaveLength(1);
        // delete
        b.removeItem("k");
        expect(b.getItem("k")).toBeNull();
        expect(b.keys()).toEqual([]);
      });
    });
  }
});
