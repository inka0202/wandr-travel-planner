# Wandr — Project Audit

_Original review: 2026-11-17, commit `137a15e` (read-only, no code changed) · Last updated: 2026-11-24 at `6360f9c`._

§1–§7 are the original findings, each with its current status; §8 is the plan of record.

## 1. Tech stack and folder structure

| Layer    | Technology                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime  | Node 22 (`.nvmrc`), `engines: >=20.11 <23` in both packages                                                                                                                                                          |
| Frontend | React 18.3, Vite 5.4, React Router 7.18 (data router), Tailwind CSS 3.4 (+forms, +typography), react-hook-form, axios, Leaflet 1.9 + react-leaflet 4, lucide-react, self-hosted fonts (@fontsource Inter / Fraunces) |
| Backend  | Express 4.22, Mongoose 8.24 (MongoDB Atlas), jsonwebtoken 9, bcryptjs 3, express-validator 7, express-rate-limit 8, helmet 8, cors, morgan, dotenv                                                                   |
| External | Open-Meteo (geocoding + forecast, no key), OpenTripMap (key), OpenStreetMap tiles (client-side)                                                                                                                      |
| Hosting  | Vercel (client), Render free plan (server), MongoDB Atlas M0                                                                                                                                                         |

Two independent npm packages, no workspace and no root `package.json`. Plain JavaScript (ESM), no TypeScript.

```
client/
  index.html, vite.config.js (alias @ → src, dev proxy /api → :5000), vercel.json (SPA rewrite)
  tailwind.config.js, postcss.config.js, eslint.config.js, .prettierrc, jsconfig.json
  public/            favicon.svg, icons.svg
  src/
    main.jsx, App.jsx, router.jsx      entry, AuthProvider, routes (+ ErrorPage as errorElement)
    api/               axios.js (instance + JWT interceptors), geocode, weather, attractions, trips
    contexts/          AuthContext.jsx (user state, login/register/logout, /auth/me on mount)
    hooks/             useFetch.js (generic loader), useAuthSubmit.js (Login/Register submit)
    lib/               constants (TOKEN_KEY), dates, tripDates, email, openMeteo, safeRedirect,
                       leaflet-fix, weatherIcons
    components/        attractions/, auth/ProtectedRoute, layout/(Navbar, RootLayout), map/(TripMap, orangeMarkerIcon),
                       search/SearchBar, trips/TripCard, weather/, ui/(Button, FormField, buttonClasses)
    pages/             Home, Login, Register, SearchResults, Dashboard, Trip, Profile (stub), NotFound, Error
  test/              node:test + jsdom (helpers/dom.js); *.parity.test.js import pure server utils
server/
  src/
    server.js          connect DB → listen, graceful shutdown
    app.js             helmet, cors, json(100kb), morgan, /health, /api router, 404, error handler
    config/            env.js (required-var check), db.js (Mongoose connect), jwtSecret.js, origins.js
    routes/            index + auth, geocode, weather, attractions, trips
    controllers/       one per route group
    services/          openMeteoService.js, openTripMapService.js
    middleware/        auth.js (verifyJWT), rateLimit.js, validate.js, errorHandler.js, notFound.js
    models/            User.js, Trip.js
    validators/        auth.validators.js, trip.validators.js
    utils/             ApiError, asyncHandler, cache (in-memory TTL, max 1000 entries), email, fetchWithTimeout,
                       forecast, generateToken, parseCoord, timezone, tripDates, weatherCodeMap
  scripts/           sync-indexes.js (npm run indexes)
  test/              node:test + supertest + mongodb-memory-server (helpers/testApp.js)
.github/workflows/   ci.yml
docs/                audit.md, decisions/ (0001–0003), screenshots (demo-week2, demo-week3)
```

### API surface

| Method & path                                            | Auth | Rate limit                                         | Notes                                     |
| -------------------------------------------------------- | ---- | -------------------------------------------------- | ----------------------------------------- |
| GET `/health` (`/api/health` removed in Group 3)         | –    | –                                                  | Render + UptimeRobot                      |
| POST `/api/auth/register`, `/api/auth/login`             | –    | registerLimiter 5/h; loginLimiter 10 failed/15 min |                                           |
| GET `/api/auth/me`, POST `/api/auth/logout`              | JWT  | –                                                  | logout is a no-op                         |
| GET `/api/geocode?q=`                                    | –    | publicApiLimiter 30/15 min                         | Open-Meteo                                |
| GET `/api/weather?lat&lng&tz`                            | –    | publicApiLimiter                                   | Open-Meteo; no client callers (dec. 0003) |
| GET `/api/attractions?lat&lng&radius`                    | –    | publicApiLimiter                                   | OpenTripMap                               |
| GET/POST `/api/trips`, GET/PATCH/DELETE `/api/trips/:id` | JWT  | tripLimiter 100/15 min (before JWT check)          | PATCH only updates `notes`                |

## 2. Run, build, deploy

### Local

```bash
cd server && cp .env.example .env && npm install && npm run dev   # nodemon, http://localhost:5000
cd client && cp .env.example .env && npm install && npm run dev   # Vite, http://localhost:5173, proxies /api → :5000
```

Server needs `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`. The process exits if any is missing, if `JWT_SECRET` is under
32 characters or the `.env.example` placeholder, or if `CLIENT_ORIGIN` has a `*` or a non-origin entry. Plus
`OPENTRIPMAP_API_KEY` (checked only when the attractions endpoint is called), and optional `PORT`, `NODE_ENV`,
`JWT_EXPIRES_IN` (default `7d`).

### Build

- Client: `npm run build` → `client/dist`; `npm run preview` to serve it.
- Server: no build step; `npm start` → `node src/server.js`.

### Deploy (configured in the dashboards; there is no `render.yaml` and no Vercel project config in the repo)

**Vercel (frontend)**: Root Directory `client`, Vite preset, build `npm run build`, output `dist`.
`vercel.json` rewrites every non-`/assets/` path to `index.html` for SPA routing.
Env: `VITE_API_BASE_URL` **must include the `/api` suffix** (e.g. `https://<service>.onrender.com/api`), because
it replaces the default `'/api'` base URL in [client/src/api/axios.js](../client/src/api/axios.js). The README only says "Render URL",
which is easy to get wrong. The variable is baked in at build time, so changing it requires a redeploy.

**Render (backend)**: Web Service, Root Directory `server`, build `npm install`, start `npm start`,
health check `/health`. Required env: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (a comma-separated list of exact
origins, no trailing path, no wildcard; a Vercel preview URL reaches the API only if its origin is listed),
`OPENTRIPMAP_API_KEY`, **`NODE_ENV=production`** (set, see §6), `JWT_EXPIRES_IN`. Atlas Network Access must allow
Render's egress (usually 0.0.0.0/0 on the free plan). Auto-deploy waits for the CI checks to pass.
README says UptimeRobot pings `/health` every 5 minutes to avoid cold starts.

## 3. Tests, linter, formatter, CI

|           | Status                                                                                                                                                                                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests     | `node:test` in both packages (decision 0002). Server: integration tests on mongodb-memory-server with supertest and stubbed fetch, plus unit tests. Client: jsdom + Testing Library, plus parity tests against the server utils. Playwright: no config or specs. |
| Linter    | ESLint 9 flat config in both packages (client: react, react-hooks, react-refresh, jsx-a11y, prettier). Runs in CI.                                                                                                                                               |
| Formatter | Prettier 3 in both (client uses prettier-plugin-tailwindcss); `format:check` on `src/` and `test/` runs in CI. `.gitattributes` forces LF. (At 137a15e: 6 server and 16 client files unformatted.)                                                               |
| CI        | `.github/workflows/ci.yml` on every push and PR: `npm ci` → lint → `format:check` → test (→ `vite build` for the client). Render auto-deploy waits for it; Vercel is not gated. No pre-commit hooks. (At 137a15e: no tests, no CI.)                              |

## 4. Data model, external APIs, JWT checks

### User — [server/src/models/User.js](../server/src/models/User.js)

| Field                 | Type   | Rules                                                           |
| --------------------- | ------ | --------------------------------------------------------------- |
| email                 | String | required, **unique**, lowercase, trim, regex match (`EMAIL_RE`) |
| passwordHash          | String | required, `select: false`, removed in `toJSON`                  |
| displayName           | String | trim, max 60                                                    |
| createdAt / updatedAt | Date   | timestamps                                                      |

### Trip — [server/src/models/Trip.js](../server/src/models/Trip.js)

| Field                 | Type                                                                    | Rules                                                                           |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| user                  | ObjectId → User                                                         | required, indexed                                                               |
| destination           | `{ name (req), country, latitude (req, ±90), longitude (req, ±180) }`   | embedded; name max 100, country max 80                                          |
| startDate, endDate    | Date                                                                    | required; `endDate >= startDate` validator (runs on create/save only)           |
| notes                 | String                                                                  | trim, max 1000                                                                  |
| savedAttractions      | `[{ xid (req), name (req), latitude, longitude (req), kind, address }]` | embedded subdocs with `_id`; max 50 and the same length limits as the validator |
| createdAt / updatedAt | Date                                                                    | timestamps                                                                      |

Indexes: `email` unique, `user`, and `{ user: 1, createdAt: -1 }`. `autoIndex` is **off in production**
([db.js](../server/src/config/db.js), `autoIndex`). `npm run indexes` ([scripts/sync-indexes.js](../server/scripts/sync-indexes.js))
reports missing indexes and builds them with `--apply`. In production they exist (checked in Atlas, no duplicate emails).

### External API calls (all go through the server except map tiles and, since decision 0003, the forecast)

| API                                                           | Server function                                                                                 | Endpoint                                                                                                  | Caller (client)                                                                                                                                                           | Cache TTL            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Open-Meteo Geocoding `geocoding-api.open-meteo.com/v1/search` | `geocodeCity` in [openMeteoService.js](../server/src/services/openMeteoService.js)              | GET `/api/geocode` ([geocode.controller.js](../server/src/controllers/geocode.controller.js))             | [api/geocode.js](../client/src/api/geocode.js) ← `SearchBar`                                                                                                              | 7 days               |
| Open-Meteo Forecast `api.open-meteo.com/v1/forecast`          | `getForecast` in [openMeteoService.js](../server/src/services/openMeteoService.js)              | GET `/api/weather` ([weather.controller.js](../server/src/controllers/weather.controller.js))             | none since decision 0003: the browser calls Open-Meteo directly ([lib/openMeteo.js](../client/src/lib/openMeteo.js) ← `api/weather.js` ← `SearchResultsPage`, `TripPage`) | 30 min (server only) |
| OpenTripMap `api.opentripmap.com/0.1/en/places/radius`        | `getAttractionsNearby` in [openTripMapService.js](../server/src/services/openTripMapService.js) | GET `/api/attractions` ([attractions.controller.js](../server/src/controllers/attractions.controller.js)) | [api/attractions.js](../client/src/api/attractions.js) ← `SearchResultsPage`                                                                                              | 24 h                 |
| OpenStreetMap tiles `{s}.tile.openstreetmap.org`              | – (browser)                                                                                     | –                                                                                                         | [TripMap.jsx](../client/src/components/map/TripMap.jsx)                                                                                                                   | browser              |

All three server calls go through `utils/fetchWithTimeout.js` (8 s timeout since Group 1, no retry). The OpenTripMap key goes in the query string, server-side only.

### Where the JWT is issued and checked

- **Issued:** `generateToken` in [utils/generateToken.js](../server/src/utils/generateToken.js) (HS256, `sub` = user id, `expiresIn` from env), called from `register` and `login` in [auth.controller.js](../server/src/controllers/auth.controller.js).
- **Verified:** `verifyJWT` in [middleware/auth.js](../server/src/middleware/auth.js). It reads `Authorization: Bearer`, runs `jwt.verify` (HS256 only), loads the user from the DB (`findById`) and sets `req.user`. It is mounted on:
  - [auth.routes.js](../server/src/routes/auth.routes.js): `GET /me`, `POST /logout`
  - [trip.routes.js](../server/src/routes/trip.routes.js): `router.use(tripLimiter)` then `router.use(verifyJWT)` cover all trip routes; every query is also filtered by `user: req.user._id`.
- **Errors:** `TokenExpiredError` and `JsonWebTokenError` are mapped to 401 in [errorHandler.js](../server/src/middleware/errorHandler.js).
- **Client:** [api/axios.js](../client/src/api/axios.js) attaches the token from `localStorage` and, on any 401, clears it and fires `auth:expired`. [AuthContext.jsx](../client/src/contexts/AuthContext.jsx) calls `/auth/me` on mount. [ProtectedRoute.jsx](../client/src/components/auth/ProtectedRoute.jsx) is a UX gate only.

## 5. State kept in server memory (lost on every Render restart, deploy or spin-down)

| What                                                                                                                                   | Where                                                            | Effect of losing it                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API response cache: a `Map` with TTLs (geocode 7 d, weather 30 min, attractions 24 h) plus a `setInterval` cleanup every 10 min        | [utils/cache.js](../server/src/utils/cache.js) (`store`)         | After a restart every lookup goes upstream again. The main concern is the OpenTripMap free quota. Capped at 1000 entries, oldest evicted (Group 1 stopgap; at 137a15e it had no size limit, see §6). |
| Rate-limit counters: express-rate-limit default `MemoryStore` for `loginLimiter`, `registerLimiter`, `tripLimiter`, `publicApiLimiter` | [middleware/rateLimit.js](../server/src/middleware/rateLimit.js) | Counters reset on restart, so the brute-force limit on login resets too. They would also not be shared if there were ever more than one instance.                                                    |
| `process.uptime()` in `/health`                                                                                                        | [app.js](../server/src/app.js)                                   | Cosmetic.                                                                                                                                                                                            |

Not in memory: sessions (JWT is stateless) and a token blacklist (none exists, `logout` is a no-op).
Client-side but similar: favourited attractions on the search page are only React state. If a logged-out user clicks
"Save trip", they are sent to `/login`, and **their selections are lost**.

## 6. Weak spots

### Security

1. **Vulnerable dependencies (npm audit).**
   - Server: `mongoose` (critical, direct), `proxy-addr` (critical, used by Express `trust proxy`), `body-parser`, `ip-address` (high), `qs`, `morgan` (moderate). All have fixes available within the current majors (`npm audit fix`).
   - Client: `react-router` / `react-router-dom` (high, including an open redirect through `useNavigate`, fixed in ≥7.18.2), `axios`, `follow-redirects`, `form-data` (high), and `vite`, `esbuild`, `postcss`, `nanoid`, `source-map-js` and others (mostly dev/build-time).
   - Fixed by fix/security (§8 Group 1): `npm audit --omit=dev` reports 0 in both packages; the dev/build-only rest is accepted in decision 0001.
2. **Stack traces and internal messages can leak.** [errorHandler.js](../server/src/middleware/errorHandler.js) included `err.stack` whenever `NODE_ENV !== 'production'`, and `NODE_ENV` defaults to `development` ([env.js](../server/src/config/env.js)). If it is not set on Render, every error response includes a stack trace. Separately, unexpected 500s return the raw `err.message` even in production; the `isOperational` flag on `ApiError` is never checked. `CastError` echoes the user's input back. Fixed by fix/security (§8 Group 1): generic 5xx and no stack unless `NODE_ENV=development`.
3. **Mass assignment on trip create.** [trip.controller.js](../server/src/controllers/trip.controller.js) spread `...req.body` into `Trip.create`. `user` is overwritten safely, but a client can set `_id` (and possibly timestamps). Unvalidated subfields (`savedAttractions.*.kind/address`) go through with no length limit. The fix is `matchedData(req)` or an explicit pick. Fixed by fix/security (§8 Group 1): explicit pick, `pickCreateTripFields`.
4. **Unique email index may be missing in production.** `autoIndex: false` in production, and register does a check-then-insert. If the Atlas index was never built (for example the prod DB was never touched in dev mode), two parallel registrations can create duplicate accounts. Check in Atlas. Fixed by fix/security (§8 Group 1): `npm run indexes`; checked in Atlas, the indexes exist and there are no duplicates.
5. **Open redirect via `?next=`.** [LoginPage.jsx](../client/src/pages/LoginPage.jsx) and [RegisterPage.jsx](../client/src/pages/RegisterPage.jsx) passed `next` straight to `navigate()`. Together with the react-router advisory above, a crafted login link can send users off-site. Accept only values that start with `/` and not with `//` or `/\`. Fixed by fix/security (§8 Group 1): `lib/safeRedirect.js`.
6. **JWT in `localStorage`** (any XSS can steal it). There is no revocation: logout is client-side only and tokens stay valid for 7 days. `jwt.verify` doesn't pin `algorithms`. `JWT_SECRET` strength isn't checked at startup. This is acceptable for a portfolio app, but should be decided before adding anything sensitive.
   - `localStorage`: Accepted — kept for now by decision (the decision record is still to be written, Group 4).
   - Revocation: Open → Group 4.
   - `algorithms` and `JWT_SECRET` strength: Fixed by fix/security (§8 Group 1).
7. **Rate-limiter design.**
   - `authLimiter` is one shared instance for login and register: 5 attempts in total per IP per 15 min, and **successful** logins count too (`skipSuccessfulRequests` is not set). Users behind a shared NAT can lock each other out. Fixed by fix/security (§8 Group 1): `loginLimiter` and `registerLimiter`.
   - `publicApiLimiter` is one instance shared by geocode, weather and attractions. One search costs 3 requests (at 137a15e; 2 since decision 0003), so a user is blocked after about 10 searches in 15 min. Open → Group 4.
   - Trip routes have no limit, and `apiLimiter` is defined but never used. Fixed: `tripLimiter` by fix/security (§8 Group 1), `apiLimiter` removed by chore/cleanup (§8 Group 3).
8. **`dns.setServers(['8.8.8.8','1.1.1.1'])`** ([db.js](../server/src/config/db.js)) is a Windows-dev workaround that also applies in production, which overrides Render's resolver for the whole process. It should only run in development. Fixed by fix/security (§8 Group 1).
9. Upstream calls have no timeout, so a hanging Open-Meteo or OpenTripMap request ties up the request until the client gives up (the client allows 15 s, or 90 s for geocode). Fixed by fix/security (§8 Group 1): `utils/fetchWithTimeout.js`, 8 s.

### Input validation

- `GET /api/weather` `tz` is not validated at all ([weather.controller.js](../server/src/controllers/weather.controller.js)). It is forwarded upstream and used in the cache key. Any string up to the URL length creates a new cache entry, so memory can be grown on purpose. Limit it to IANA zone names or `auto`. Fixed by fix/security (§8 Group 1): `utils/timezone.js`.
- `parseCoord` accepts `""` as `0` (`Number('') === 0`), so `?lat=&lng=` returns weather for (0, 0). Fixed by fix/security (§8 Group 1).
- `ISO_DATE` regex ([trip.validators.js](../server/src/validators/trip.validators.js)) accepts `2026-13-45`. Mongoose then throws a CastError (400), but the message is unclear. Use `isISO8601({ strict: true })`. There is no upper bound on trip length or year. Fixed by fix/security (§8 Group 1): strict ISO dates, `utils/tripDates.js` (max 30 days, start at most 2 years ahead).
- `savedAttractions.*.xid` and `.name` are `optional()` in the validator but `required` in the schema, so the error comes from Mongoose instead of the validator. There are no length limits on name, kind or address. Fixed by fix/security (§8 Group 1).
- `validate.js` comment promises a `details` array that is never returned. Fixed by chore/cleanup (§8 Group 3).
- Geocode "no results" (404) is not cached, so repeated misspellings always go upstream. Open → Group 4.
- The cache has no in-flight de-duplication, so concurrent identical cold requests each go upstream. Open → Group 4.

### Duplicated and dead code

- `parseCoord` is copied in `weather.controller.js` and `attractions.controller.js`. Fixed by fix/security (§8 Group 1): `server/src/utils/parseCoord.js`.
- `fmtRange` is copied in `SearchResultsPage.jsx`, `TripPage.jsx` and `TripCard.jsx` (with slight differences). Fixed by chore/cleanup (§8 Group 3).
- `wmoCodeToGroup` exists in the server's `weatherCodeMap.js` (unused there) and in the client's `weatherIcons.jsx`. Fixed by chore/cleanup (§8 Group 3): server copy removed.
- The health route is defined twice (`/health` in app.js and `/api/health` in routes/index.js). Fixed by chore/cleanup (§8 Group 3): `/api/health` removed.
- Login and Register pages repeat the same `next` redirect and error-handling logic. The email regex is in both `User.js` and `RegisterPage.jsx`. Fixed by chore/cleanup (§8 Group 3): `useAuthSubmit`; one regex + parity test.
- The delete-trip flow is implemented separately in `TripCard` and `TripPage`, with different UX (inline confirm vs `window.confirm`). Open → Group 5.
- Dead code: `client/src/App.css` (Vite template), `client/README.md` (Vite boilerplate), the unused `ui/Input`, `ui/Card`, `ui/Spinner` and `ui/index.js` barrel (`FormField` and `Button` are imported directly), `apiLimiter`, server `wmoCodeToGroup`, and `ProfilePage` (a routed stub that shows only a heading). The `PATCH /trips/:id` notes endpoint has no UI, and trips are always created with `notes: ''`. Fixed by chore/cleanup (§8 Group 3), except `ProfilePage` and the notes endpoint: Open → Group 5.

### Bugs and robustness (client)

- **Users get logged out on Render cold start.** In [AuthContext.jsx](../client/src/contexts/AuthContext.jsx), `/auth/me` deleted the token on _any_ error, including timeouts, network errors and 5xx. The axios timeout is 15 s and a free Render cold start takes about 30–60 s. Only a 401 should clear the token. Fixed by fix/security (§8 Group 1): 401 only, 60 s timeout for `/auth/me`.
- **Dates show one day early in timezones west of UTC.** `new Date('2026-11-20')` is UTC midnight, so `toLocaleDateString` in the Americas shows Nov 19. This affects `fmtRange` (3 places) and `ForecastStrip`'s `formatDay`/`formatDate`. `SearchBar`'s `today()` uses `toISOString()` (a UTC date), so around midnight the date picker's minimum is off by one day. Fixed by chore/cleanup (§8 Group 3): `client/src/lib/dates.js`, also TripPage's "trip has passed" check.
- On `TripPage`, weather loading and errors are not shown (just empty space). Delete failures in `TripPage` and `TripCard` are silent. Open → Group 5.
- The router has no `errorElement`, so any render error shows React Router's default developer error screen. Fixed by chore/cleanup (§8 Group 3): `pages/ErrorPage.jsx`.
- No code splitting: Leaflet and every page are in the main bundle. Open → Group 5.
- Upstream failures were logged without the upstream status or reason (only `WEATHER_UPSTREAM` etc.), so production 502s couldn't be diagnosed. Fixed by fix/weather-upstream (§8, Phase 1).
- Privacy: morgan `combined` logs the full request URL in production, so the search query (`q`), destination coords, `tz` and the client IP end up in the Render log. Separate from the upstream logging, which redacts these. Open → Group 5.
- `TripPage` creates a new `Set` on every render, and `orangeMarker()` creates a new `divIcon` per marker per render, so all markers are re-created on every re-render. Open → Group 5.

### Responsive layout and accessibility

- **ForecastStrip** uses `grid-cols-7` at every width. On 320–375 px phones each column is about 36–40 px including `p-2`, so the date and temperature text is cramped or overflows. Use a horizontal scroll or 4+3 columns below `sm`. Open → Group 5.
- **Sticky sub-header** on the Search and Trip pages (`sticky top-16`) wraps to two rows on phones (title and dates, then the Save button). Together with the 64 px navbar it covers about a third of a small screen. The map's `lg:top-44` / `lg:top-48` and `calc(100vh-12rem/14rem)` values are magic numbers tied to the header height and break if the title wraps on desktop. Open → Group 5.
- `<Link><Button/></Link>` puts a button inside a link (invalid HTML, confusing for screen readers) in the Navbar, Dashboard, NotFound and Trip (error state) pages. Open → Group 5.
- Touch targets are small: the TripCard trash icon is about 24 px and the AttractionCard heart about 32 px, below the 44 px guideline. Open → Group 5.
- On mobile the map is the first block and Leaflet captures touch drag, so it is easy to get "stuck" scrolling the map instead of the page. Open → Group 5.

### Outdated dependencies (`npm outdated`)

- Within-range updates (safe): helmet, morgan, mongoose 8.24.10, express-rate-limit, axios 1.21, react-router-dom 7.18.5, react-hook-form, lucide-react, postcss, playwright, prettier. Fixed by fix/security (§8 Group 1).
- Major versions behind (plan separately): Open → Group 5 (not during this project).
  - Server: Express 4 → 5, Mongoose 8 → 9, dotenv 17 → 18, ESLint 9 → 10.
  - Client: React 18 → 19, react-leaflet 4 → 5 (needs React 19), Vite 5 → 8, @vitejs/plugin-react 4 → 6, Tailwind 3 → 4, eslint-plugin-react-hooks 5 → 7.
- `engines: "<23"` will block Node 24 LTS. Open → Group 5.

## 7. Fix before adding new features

**P0: security and correctness (small, high value)**

1. Run `npm audit fix` in both packages and bump `react-router-dom` to ≥7.18.5, `axios` and `mongoose` to the latest patch versions. Leave majors for later. Re-run the build and smoke test. _Done (fix/security)._
2. On Render, confirm `NODE_ENV=production`. In Atlas, confirm the `email_1` unique index and the `trips` indexes exist. _Done (manual checks, Group 1)._
3. Error handler: return a generic message for non-operational 5xx errors in production, and stop echoing input in `CastError`. _Done (fix/security)._
4. `createTrip`: save only validated fields (`matchedData`), require `xid` and `name` on attractions with length limits, and use strict ISO-8601 dates. _Done (fix/security; explicit pick instead of `matchedData`)._
5. Validate `tz` against a whitelist, cap the cache size (simple LRU or max entries), and add `AbortSignal.timeout()` to upstream `fetch` calls. _Done (fix/security; the cap is a stopgap → Group 4)._
6. Sanitise `?next=` to same-origin paths only. _Done (fix/security)._
7. AuthContext: clear the token only on a 401 from `/auth/me`, not on network or timeout errors. _Done (fix/security)._
8. Rate limits: separate limiter instances for each endpoint group, `skipSuccessfulRequests` on login, a realistic public limit, and a limit on trip routes. _Login/register split, `skipSuccessfulRequests` and the trip limit done (fix/security); the public limiter → Group 4._
9. Run `dns.setServers` in development only. _Done (fix/security)._

**P1: foundation, so new features don't pile onto problems**

10. Add tests: _Done (setup/quality; node:test instead of Vitest, decision 0002)._
    - Server: Vitest (or node:test) + supertest + mongodb-memory-server. Cover auth flow, trip ownership (user A cannot read or delete B's trip), validators and the error handler.
    - Client: Vitest + Testing Library for `useFetch` and the date helpers.
11. Add GitHub Actions CI (both packages): `npm ci` → `eslint` → `prettier --check` → tests → `vite build`. First run `prettier --write` once in a dedicated formatting-only commit. _Done (setup/quality)._
12. Fix the timezone date bug (parse `YYYY-MM-DD` as a local date, or format with `timeZone: 'UTC'`). _Done (chore/cleanup)._
13. Move shared helpers to one place: `parseCoord` → `server/src/utils`, `fmtRange` and date helpers → `client/src/lib/dates.js`, a single `/health`. Delete the dead files listed in §6. _Done (`parseCoord`: fix/security; the rest: chore/cleanup); ProfilePage → Group 5._
14. Responsive and a11y fixes: ForecastStrip on mobile, sticky header height and map offsets, no buttons inside links, 44 px touch targets. _→ Group 5._
15. Add a router `errorElement`. Show weather and delete errors on TripPage. _`errorElement` done (chore/cleanup); TripPage errors → Group 5._
16. Keep favourites through the login redirect (store them in `sessionStorage` or the `next` URL). _→ Group 5._
17. README: say that `VITE_API_BASE_URL` must end with `/api`, and document the Render and Vercel settings (or add a `render.yaml`). _→ Group 5._

**P2: later, as planned upgrades**

- Express 5, React 19 + react-leaflet 5, Vite 6+/plugin-react, Tailwind 4, ESLint 10. Do them one at a time, each with CI green. _→ Group 5._
- Consider httpOnly cookie auth plus token revocation, and a persistent cache or rate-limit store (Mongo TTL collection, or Upstash Redis free tier) if restarts become a real quota problem. _→ Group 4._
- Lazy-load the map and pages with `React.lazy` to shrink the first bundle. _→ Group 5._

## 8. Fix plan

| Group / branch         | Status         | Merge commit                             | Open leftovers (→ group)                                                                        |
| ---------------------- | -------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Group 1, fix/security  | done           | `481acbb`                                | shared `publicApiLimiter`, persistent cache instead of the 1000-entry cap, JWT revocation (→ 4) |
| Group 2, setup/quality | done           | `0fa42fc`                                | client tests to Vitest with the Vite major upgrade (→ 5)                                        |
| fix/weather-upstream   | done           | `8d7386c` (Phase 1), `c29c3df` (Phase 2) | TripPage shows nothing on a weather error (→ 5)                                                 |
| fix/usefetch-stale     | done           | `4128fd6`                                | aborting stale requests (→ 5)                                                                   |
| Group 3, chore/cleanup | done           | `6360f9c`                                | `publicApiLimiter` still uses `max` (→ 4); ProfilePage stub, notes endpoint (→ 5)               |
| Group 4                | open           | –                                        | –                                                                                               |
| Group 5                | open (backlog) | –                                        | –                                                                                               |

### Group 1. Security: fix first, branch fix/security (done)

Merged in `481acbb` (PR #1).

- Dependencies: `npm audit fix` and in-range updates in both packages (react-router-dom 7.18.5, axios, mongoose 8.24.10
  and the other safe updates); no majors. `npm audit --omit=dev` reports 0 in both.
- Error handler: 5xx responses say `Internal Server Error` and have no stack unless `NODE_ENV=development`
  (`env.IS_DEVELOPMENT`); validation and cast errors never echo input; the 404 handler doesn't echo the URL.
- createTrip: saves only validated fields through `pickCreateTripFields` (not `matchedData`, which returns raw arrays);
  attractions require `xid` and `name`; length limits in the validator and the schema; strict ISO-8601 dates; trips
  at most 30 days, starting at most 2 years ahead (`utils/tripDates.js`).
- Public API inputs: `tz` must be an IANA zone or `auto` (`utils/timezone.js`); one `utils/parseCoord.js` that rejects
  empty and non-decimal values; upstream calls go through `utils/fetchWithTimeout.js` (8 s; 504 `UPSTREAM_TIMEOUT`,
  502 on network errors); the cache is capped at 1000 entries (stopgap until Group 4).
- Auth: JWT pinned to HS256 on sign and verify; startup refuses a `JWT_SECRET` under 32 characters or the placeholder;
  `loginLimiter` (10 failed/15 min, successful logins don't count) and `registerLimiter` (5/h); `tripLimiter`
  (100/15 min) before `verifyJWT`; `npm run indexes` (`scripts/sync-indexes.js`) checks and builds the indexes.
- `dns.setServers` only in development. CORS: `CLIENT_ORIGIN` is a comma-separated exact-match list
  (`config/origins.js`), wildcards rejected at startup; Vercel previews reach the API only if listed.
- Client: `?next=` goes through `lib/safeRedirect.js#safeNext` (same-origin paths only); AuthContext clears the token
  only on a 401 from `/auth/me`, which gets a 60 s timeout for cold starts.
- Unit tests: `errorHandler`, `createTrip`, `tripDates`, `publicApiInputs`, `authHardening`, `origins` (server),
  `safeRedirect` (client).

Manual checks: `NODE_ENV=production` on Render: done. Atlas `email_1` and trips indexes: exist, no duplicate emails.
`JWT_SECRET` long and random: done. Render build command stays `npm install` (CI runs `npm ci`, which checks the lockfile).

Accepted risks: the dev/build-only advisories in decision 0001 (server: minimatch via nodemon; client: vite (high),
esbuild, postcss-selector-parser). `npm audit` on 2026-11-24 shows the same set.

Deferred → Group 4: the shared `publicApiLimiter`, a persistent cache instead of the cap, JWT revocation.
→ Group 5: the Vite major upgrade that clears the accepted advisories (after the project).

### Group 2. Quality tools: second, branch setup/quality (done)

Merged in `0fa42fc` (PR #2). Test stack and reasons: decision 0002.

- Formatting-only commit: `prettier --write` in both packages; `.gitattributes` forces LF.
- Server integration tests: node:test + supertest + mongodb-memory-server. `test/helpers/testApp.js` starts the real
  app on an in-memory MongoDB with test env vars (never `server/.env`); a fetch guard fails any unstubbed upstream call;
  each test uses its own IP, so the limiters keep their production limits. Covers register / login / `/auth/me`,
  trip ownership (404 for another user's trip), createTrip ignoring `_id`, timestamps and extra fields, validation
  400s, the generic production 5xx, HS512 and `alg: none` tokens, successful logins never blocked, CORS, upstream
  timeout, invalid `tz`, cache hits.
- Client tests: node:test + jsdom + Testing Library (`node --import ./test/helpers/dom.js`), `useFetch` tests. Vitest
  was dropped: every version that supports Vite 5 brings critical dev-only tinypool advisories (fixed only in
  Vitest ≥ 4.1.12, which needs Vite ≥ 6). No `@/` imports or JSX in tested code until then.
- The stale-response bug these tests found was skipped with `TODO(bug)` and fixed in fix/usefetch-stale.
- CI: `.github/workflows/ci.yml` on push and pull_request, server and client jobs, Node from `.nvmrc`,
  `npm ci` → lint → `format:check` → test (→ `vite build`), mongod binary cached. No secrets.
- Docs: decisions 0001 (revisit after the project) and 0002; CLAUDE.md commands and testing lines.

Manual checks: Render auto-deploy waits for CI checks: on. GitHub Actions is green on main: yes.

Deferred → Group 5: client tests to Vitest ≥ 4.1.12 with the Vite major upgrade.
Out of scope: Playwright e2e (at the end of the project), husky / pre-commit hooks, Vercel deploy gating, coverage thresholds.

### Production bug, out of band: branch fix/weather-upstream (done)

On Render, `GET /api/weather` always returned 502 `WEATHER_UPSTREAM`; the same request worked
locally. The Open-Meteo URL has no date or TZ-dependent parts, and the error meant a response
did arrive (non-2xx or non-JSON), so not DNS or timeout.

- Phase 1 (diagnostics, done): `fetchWithTimeout` logs one `[upstream]` line per failed upstream
  response: service label, status, Retry-After, the upstream reason (cut to 200 chars). Never the
  URL, the API key or request values (redacted). No change to what the user sees.
- **Cause (from that log):** 429 "Daily API request limit exceeded". Open-Meteo limits per IP
  (10,000/day) and Render's free plan shares outbound IPs with other apps, so other traffic uses
  up the limit. No server-side fix makes this reliable.
- Phase 2 (done), see decision 0003 (forecast from the browser):
  - The browser fetches the forecast directly (`client/src/lib/openMeteo.js`): same params, same
    response shape, plain fetch (never the axios instance with the JWT), no referrer, 10 s timeout,
    `WeatherError` codes. "Weather data by Open-Meteo.com" is shown next to the forecast.
  - The mapping is duplicated on purpose (`server/src/utils/forecast.js` + `weatherCodeMap.js`);
    `client/test/openMeteo.parity.test.js` fails if the copies drift.
  - `/api/weather` stays with no client callers; an upstream 429 maps to 503 `WEATHER_RATE_LIMITED`
    (no retry). The "blocked until Retry-After" design is parked in decision 0003 for future
    server-side weather jobs.
  - Geocoding is unchanged. If the log shows `open-meteo-geocode` 429, move it to the browser the
    same way (amend decision 0003).
- Related, not fixed here: `useFetch` kept old `data` when a new request failed (fixed by
  fix/usefetch-stale); TripPage shows nothing on a weather error (Group 5).

### fix/usefetch-stale (done)

- Ignore stale responses when deps change, un-skip the test.
  (Found by the Group 2 client tests: `useFetch` shared one `cancelRef` across effect runs, so a
  slow response for the previous deps overwrote the current data.)
  - Each effect run has its own `ignore` flag; every state update (`data`, `error`, `isLoading`)
    sits behind it, so a superseded request (deps change, `refetch()`, `skip` on, unmount)
    changes nothing, and can't end the loading state of the current one.
  - Also clears `data` when the current request fails (no old forecast next to the error).
    While a new request loads, the old `data` still shows.
  - Ignore only, no abort: superseded requests still finish. Aborting is deferred (Group 5).
  - Tests: `client/test/useFetch.test.js` (stale response in both orders, stale rejection, refetch and
    skip mid-flight, clear on error, old data kept while loading).

### Group 3. Clean-up: third, branch chore/cleanup (done)

User-visible changes only: correct dates west of UTC, date limits on the SearchBar, and a router
error screen. Everything else is behaviour-neutral.

- Dead code deleted (grep-checked): App.css, client README boilerplate, ui/Input, ui/Card,
  ui/Spinner, ui/index.js, apiLimiter, server wmoCodeToGroup. One health route: GET `/health`
  (`/api/health` had no callers; a test checks it is now 404). validate.js comment fixed.
- `client/src/lib/dates.js`: date-only strings (and the date part of Mongo's UTC-midnight
  datetimes) are parsed as local dates; one `fmtRange` (`Nov 20 — Nov 27, 2026`, start year added
  across years, `Nov 20, 2026` for one day), all formatters pinned to 'en-US'. Used by
  SearchResultsPage, TripPage, TripCard, ForecastStrip and SearchBar. TripPage's "trip has passed"
  check now uses the local date. Tests run in 6 zones (UTC−10 … UTC+14).
- SearchBar: `min`/`max` on both date inputs plus react-hook-form `validate` for typed dates
  (`client/src/lib/tripDates.js`). Min start = local today; max start is UTC-based like the
  server, so the client can only be stricter, never looser; end ≤ start + 29 days.
  `tripDates.parity.test.js` checks the boundaries against `server/src/utils/tripDates.js`.
- Router `errorElement`: `pages/ErrorPage.jsx` (no message or stack in production; "Go home" is a
  Link styled with the new `buttonClasses()`, not a nested Button). Page errors keep the navbar;
  a layout crash shows the page alone.
- One email regex: `server/src/utils/email.js` (User model) with a client copy for Register and
  `email.parity.test.js`. Same pattern as before, so no account changes; login has no pattern.
- `hooks/useAuthSubmit.js`: the shared `?next=` redirect (through the unchanged `safeNext`) and
  connection error for Login and Register; each page keeps its own error-code messages.

Deferred: publicApiLimiter still uses `max` (Group 4 limiter work).

### Group 4. Not fixed now: will be replaced by shared modules (architecture work, later)

The shared server modules for these items (a quota service with a MongoDB cache and counters, a persistent
rate-limit store, one API error format) will be described in docs/architecture.md (not written yet).

- Caching 404 results, in-flight de-duplication, a persistent cache → a quota service with a MongoDB TTL cache.
  (The max-entries cap is in place since Group 1, as a stopgap.)
- The shared publicApiLimiter → per-user daily search limits by plan (30/60/150).
- Rate-limit counters reset on every restart → keep them in a persistent store (MongoDB),
  together with the per-user limits. Add tests for `tripLimiter` and `registerLimiter` when the limiters move there.
- The error format → one standard API error format. (Generic 5xx in production is done since Group 1;
  `ApiError.isOperational` is still set but never read.)
- JWT revocation → a tokenVersion field, added with the password reset feature.
- httpOnly cookies: decision to keep localStorage for now; record it in docs/decisions/.

### Group 5. Backlog: fix inside later features or at the end

- With trip editing: delete flow implemented twice, notes endpoint without UI, TripPage weather
  errors, TripPage and TripCard delete errors, map markers re-created on every render, keeping favourites through the
  login redirect (draft trip on the device). Also the Login ↔ Register links drop `?next=`, so
  registering from the "Save trip" redirect lands on `/trips` instead of returning to the search:
  pass `next` through both links, via `safeNext`.
  Save trip during a new search's loading can save the previous destination's favourites
  ("Save trip" is disabled only while saving, `favoritedIds` isn't reset on a new search, and
  the old attractions stay in `data` while the new ones load).
- Abort stale requests (AbortController via `api/*` and `lib/openMeteo.js`). Worthwhile only with
  search-as-you-type or many in-flight requests. `useFetch` calls `fetchFn()` with no arguments,
  so adding `{ signal }` later is not a breaking change.
- With account settings: replace the ProfilePage stub.
- With the auth pages: LoginPage maps every non-RATE_LIMITED error, including 5xx/504 on a Render
  cold start, to "Invalid email or password." Show a generic server/timeout message for
  status >= 500.
- With password reset: login timing difference for unknown emails (use a dummy bcrypt compare),
  and forgot-password must respond the same way and in the same time whether the email exists
  or not (don't await the email send).
- With anonymous search logging (trend reports): in production, log without the query string and the client IP,
  so the logs match the anonymous-logging promise.
- When touching those pages, or at the end: responsive and accessibility fixes (ForecastStrip,
  sticky header, buttons inside links, 44 px touch targets, map catching touch scroll).
- With the PWA: code splitting / React.lazy.
- With the Vite major upgrade: move client tests to Vitest ≥ 4.1.12 (lifts the no-`@/`/no-JSX
  rule for tested code).
- At the end: README. Say that VITE_API_BASE_URL must end with /api, and document the Render
  and Vercel settings (root directories, build/start commands, env vars, health check), or add
  a render.yaml.
- Not during this project: major upgrades (Express 5, React 19, Vite 8, Tailwind 4, ESLint 10).
  Exception: check engines "<23" against Render's Node version and change it only if it blocks the build.
