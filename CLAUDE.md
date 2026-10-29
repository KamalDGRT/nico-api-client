# CLAUDE.md

## What this is

`@kamaldgrt/api-client`: a small TypeScript package, published to npm as compiled ESM + `.d.ts` with an `ApiClient` base class, API error handling and refresh-token storage. See [README.md](README.md) for the public API and usage.

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

Terse commit messages: subject line only, no body unless asked. Lowercase conventional prefix, imperative verb. No `Co-Authored-By` trailer.

| Prefix | Use when |
|---|---|
| `feat:` | New user-visible behaviour, endpoint, column, UI element or label change |
| `fix:` | Bug fix |
| `refactor:` | Restructure code, same behaviour |
| `perf:` | Performance improvement, same behaviour |
| `test:` | Add/change tests only |
| `docs:` | Docs only (CLAUDE.md, README) |
| `style:` | Formatting only, no logic change |
| `build:` | Build system or CI/deploy config |
| `deps:` | Add/bump/lock a dependency |
| `chore:` | Maintenance that fits nowhere else (seed data sync, tooling) |
| `bump:` | Semver bump commit, e.g. `bump: 1.2.0` |

## Releasing

1. Update `version` in `package.json` (semver, see README).
2. Commit, then `git tag vX.Y.Z`.
3. `npm publish --access public` (`prepublishOnly` runs typecheck, tests and build first).
4. `git push origin main vX.Y.Z` (`--follow-tags` skips lightweight tags).
5. Wait until the new version is installable. The registry's version endpoint (`https://registry.npmjs.org/<package>/<version>`) answers first. `npm view <package> version --prefer-online` and `npm install` can lag by a few minutes.
6. Update each consuming app: `npm i <package>@latest`, then its typecheck, tests, lint and build, then commit and push. While the major version is `0`, `^0.x.0` ranges do not cross a minor, so every minor release needs this explicit bump.

Staged publishes show as "Cannot publish over previously staged version" on retry. Do not republish; confirm approval on npm instead.
