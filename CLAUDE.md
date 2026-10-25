# CLAUDE.md

## What this is

`@nico/api-client`: a small TypeScript package, published to npm as compiled ESM + `.d.ts` with an `ApiClient` base class, API error handling and refresh-token storage. See [README.md](README.md) for the public API and usage.

## Layout

- `src/ApiClient.ts`: `ApiClient`, `ApiError`, `Fetcher`, `createPublicFetcher`, `errorMessage`, `parseJsonOrThrow`, `parseTextOrThrow`
- `src/tokenStorage.ts`: `createRefreshTokenStorage(key)`
- `src/constants.ts`: named constants (status codes, content type, default error message)
- `dist/`: build output (gitignored, published)
- `src/index.ts`: the only public entry point; everything exported there is public API
- `tests/`: vitest suites, one per source module

## Commands

```bash
npm test            # vitest run (jsdom)
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/
```

Run both before every commit.

## Rules

- **Generic only.** This package must stay application-agnostic: no app names, domain types, endpoints, storage keys or environment variables. Anything app-specific is passed in by the caller (`Fetcher`, storage `key`).
- **No runtime dependencies.** Browser and platform APIs only (`fetch`, `Response`, `localStorage`). Dev dependencies are limited to TypeScript, vitest and jsdom.
- **No UI, no framework imports.** No React, no Next. This is plain TypeScript.
- **Published output is `dist/`.** `exports` points at `dist/`, `files` is `["dist"]`. Tests import from `src`, never from `dist`.
- **Public API is a contract.** Do not rename or change the signature of an exported symbol without a major version bump. Add new capabilities as optional parameters or new exports.
- **No magic values.** Put status codes, header values and default messages in `src/constants.ts`.
- **Specific errors.** Failed responses throw `ApiError` with the HTTP status. Do not swallow errors, and do not throw bare `Error`.
- **No duplication.** Reuse `throwApiError`, `parseJsonOrThrow` and `parseTextOrThrow` rather than adding parallel parsing paths.
- **Every exported function gets a test**, and tests use realistic inputs (real `Response` objects, a real `localStorage` from jsdom). Cover the failure paths, not just the happy one.

## Commits

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`). Subject only, unless the reason is not obvious. No co-author trailers.

## Releasing

1. Update `version` in `package.json` (semver, see README).
2. Commit, then `git tag vX.Y.Z`.
3. `npm publish --access public` (`prepublishOnly` runs typecheck, tests and build first).
4. `git push --follow-tags`.
