# @kamaldgrt/api-client

Framework-agnostic TypeScript building blocks for talking to a JSON REST API from a browser app:

- **`ApiClient`**: base class for per-domain services, with typed `get`, `getText`, `post`, `put`, `patch` and `delete` helpers. `URLSearchParams` and `FormData` bodies (login forms, file uploads) are sent as-is instead of as JSON.
- **Error handling**: `ApiError`, `errorMessage`, `parseJsonOrThrow` and `parseTextOrThrow` turn non-2xx responses into a single `ApiError` carrying the server's message, every individual message (`messages`) and the HTTP status.
- **`createPublicFetcher`**: a `Fetcher` for APIs that need no authentication.
- **`createRefreshTokenStorage`**: `localStorage` persistence for a refresh token that never throws.

Ships compiled ESM with type declarations and has no runtime dependencies.

## Install

```bash
npm i @kamaldgrt/api-client
```

No bundler configuration is needed: the package is plain compiled JavaScript with bundled types.

## Usage

### Services

Subclass `ApiClient` and expose one typed method per endpoint.

```ts
import { ApiClient } from "@kamaldgrt/api-client";

export class HouseService extends ApiClient {
  list(): Promise<House[]> {
    return this.get("/houses");
  }
  create(body: NewHouse): Promise<House> {
    return this.post("/houses", body);
  }
  remove(id: string): Promise<void> {
    return this.delete(`/houses/${id}`);
  }
}
```

A service takes a `Fetcher`, which is `(path, init?) => Promise<Response>`. The app decides how requests get authenticated (base URL, bearer token, refresh on 401) by supplying that function. For an unauthenticated API, use the built-in one:

```ts
const houses = new HouseService(createPublicFetcher("https://api.example.com"));
```

Each helper takes optional extra `headers`, which are merged over the defaults. Use them for things like `If-Match` or an idempotency key.

### Errors

```ts
try {
  await houses.create(body);
} catch (err) {
  toast.error(errorMessage(err, "Could not create the house"));
}
```

`errorMessage` returns the server's message for an `ApiError` and your fallback for anything else, such as a network failure.

The server error body is expected to look like this. Several `detail` values are joined into one message:

```json
{ "errors": [{ "detail": "Already a member" }] }
```

A plain string body is also accepted. Anything else produces the message `Request failed`. A `204 No Content` response resolves to `undefined`.

### Refresh token storage

```ts
const refreshToken = createRefreshTokenStorage("myapp_refresh_token");

refreshToken.persist(token);
refreshToken.read();   // string | null
refreshToken.clear();
```

Only the refresh token should be persisted. Keep the short-lived access token in memory. Use a distinct key per app so apps served from the same origin never share a session. If `localStorage` throws (private mode, blocked site data), `read` returns `null` and `persist` and `clear` do nothing.

## Development

```bash
npm install
npm test            # vitest (jsdom)
npm run typecheck   # tsc --noEmit
npm run build       # tsup -> dist/ (ESM + .d.ts)
```

## Updating

Check the latest version with `npm view @kamaldgrt/api-client version`, then bump it in the consuming app:

```bash
npm i @kamaldgrt/api-client@latest
```

While the major version is `0`, a caret range such as `^0.2.0` only accepts patch releases (`0.2.x`). A new minor (`0.3.0`) is never picked up automatically, so bump it explicitly. From `1.0.0` on, `^1.x.y` accepts every minor and patch.

After updating, run the app's typecheck, tests and build.

## API changes

Every consumer imports from the package root (`src/index.ts`). Treat exported names and signatures as a public API:

- Additive changes bump the minor version.
- Breaking changes bump the major version.
- Tag each release (`vX.Y.Z`) to match the published version.
