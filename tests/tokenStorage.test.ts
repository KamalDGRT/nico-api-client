import { afterEach, describe, expect, it, vi } from "vitest";
import { createRefreshTokenStorage } from "../src";

const KEY = "app_refresh_token";
const OTHER_KEY = "other_app_refresh_token";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("createRefreshTokenStorage", () => {
  it("round-trips under its own key and clears", () => {
    const storage = createRefreshTokenStorage(KEY);
    storage.persist("abc");
    expect(localStorage.getItem(KEY)).toBe("abc");
    expect(storage.read()).toBe("abc");
    storage.clear();
    expect(storage.read()).toBeNull();
  });

  it("keeps apps on one origin separate via their key", () => {
    const a = createRefreshTokenStorage(KEY);
    const b = createRefreshTokenStorage(OTHER_KEY);
    a.persist("a-token");
    expect(b.read()).toBeNull();
    b.clear();
    expect(a.read()).toBe("a-token");
  });

  it("treats a throwing localStorage (private mode) as no token, never crashes", () => {
    const storage = createRefreshTokenStorage(KEY);
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new Error("blocked");
      });
    }
    expect(storage.read()).toBeNull();
    expect(() => storage.persist("x")).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });
});
