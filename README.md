# @nico/api-client

Shared by elm-web, web and house-setup-web:

- `ApiClient` base class (get/getText/post/put/delete), `ApiError`, `errorMessage`, `parseJsonOrThrow`, `parseTextOrThrow`, `createPublicFetcher`
- `createRefreshTokenStorage(key)` — localStorage refresh-token persistence that never throws

Source-only TypeScript, no build step. Consumers must add it to `transpilePackages` in `next.config.ts`.

```bash
npm i github:KamalDGRT/nico-api-client   # or: npm i ../nico-api-client while developing
npm test
```
