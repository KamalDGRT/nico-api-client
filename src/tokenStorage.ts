export type RefreshTokenStorage = {
  read: () => string | null;
  persist: (token: string) => void;
  clear: () => void;
};

// Only the refresh token is persisted (localStorage, so a cmd/ctrl+click tab
// stays logged in); the short-lived access token lives in memory.
// localStorage can throw (private mode, blocked site data) — reading treats
// that as "no token", writing/clearing as a no-op (session just won't survive
// a reload). `key` is per-app so apps on one origin never share a session.
export function createRefreshTokenStorage(key: string): RefreshTokenStorage {
  return {
    read() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    persist(token) {
      try {
        localStorage.setItem(key, token);
      } catch {
        // Session won't survive a reload.
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing to clear.
      }
    },
  };
}
