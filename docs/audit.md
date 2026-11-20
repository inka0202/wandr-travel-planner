# Wandr — Project Audit

_Date: 2026-11-17 · Scope: entire repo at commit `137a15e` · Read-only review, no code changed._

## 1. Tech stack and folder structure

| Layer    | Technology                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime  | Node 22 (`.nvmrc`), `engines: >=20.11 <23` in both packages                                                                                                                                                          |
| Frontend | React 18.3, Vite 5.4, React Router 7.15 (data router), Tailwind CSS 3.4 (+forms, +typography), react-hook-form, axios, Leaflet 1.9 + react-leaflet 4, lucide-react, self-hosted fonts (@fontsource Inter / Fraunces) |
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
    main.jsx, App.jsx, router.jsx      entry, AuthProvider, routes
    api/               axios.js (instance + JWT interceptors), geocode, weather, attractions, trips
    contexts/          AuthContext.jsx (user state, login/register/logout, /auth/me on mount)
    hooks/             useFetch.js (generic loader)
    lib/               constants (TOKEN_KEY), leaflet-fix, weatherIcons
    components/        attractions/, auth/ProtectedRoute, layout/(Navbar, RootLayout), map/, search/SearchBar,
                       trips/TripCard, weather/, ui/(Button, Card, FormField, Input, Spinner)
    pages/             Home, Login, Register, SearchResults, Dashboard, Trip, Profile (stub), NotFound
    App.css            leftover Vite template (not imported)
server/
  src/
    server.js          connect DB → listen, graceful shutdown
    app.js             helmet, cors, json(100kb), morgan, /health, /api router, 404, error handler
    config/            env.js (required-var check), db.js (Mongoose connect)
    routes/            index + auth, geocode, weather, attractions, trips
    controllers/       one per route group
    services/          openMeteoService.js, openTripMapService.js
    middleware/        auth.js (verifyJWT), rateLimit.js, validate.js, errorHandler.js, notFound.js
    models/            User.js, Trip.js
    validators/        auth.validators.js, trip.validators.js
    utils/             ApiError, asyncHandler, cache (in-memory TTL), generateToken, weatherCodeMap
docs/                screenshots (demo-week2, demo-week3)
```

### API surface

| Method & path                                            | Auth | Rate limit                 | Notes                      |
| -------------------------------------------------------- | ---- | -------------------------- | -------------------------- |
| GET `/health`, GET `/api/health`                         | –    | –                          | duplicated                 |
| POST `/api/auth/register`, `/api/auth/login`             | –    | authLimiter 5/15 min       |                            |
| GET `/api/auth/me`, POST `/api/auth/logout`              | JWT  | –                          | logout is a no-op          |
| GET `/api/geocode?q=`                                    | –    | publicApiLimiter 30/15 min | Open-Meteo                 |
| GET `/api/weather?lat&lng&tz`                            | –    | publicApiLimiter           | Open-Meteo                 |
| GET `/api/attractions?lat&lng&radius`                    | –    | publicApiLimiter           | OpenTripMap                |
| GET/POST `/api/trips`, GET/PATCH/DELETE `/api/trips/:id` | JWT  | –                          | PATCH only updates `notes` |

## 2. Run, build, deploy

### Local

```bash
cd server && cp .env.example .env && npm install && npm run dev   # nodemon, http://localhost:5000
cd client && cp .env.example .env && npm install && npm run dev   # Vite, http://localhost:5173, proxies /api → :5000
```

Server needs `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (if any is missing the process exits), plus `OPENTRIPMAP_API_KEY`
(checked only when the attractions endpoint is called), and optional `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN` (default `7d`).

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
health check `/health`. Required env: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` (the exact Vercel origin, no trailing slash;
Vercel preview URLs will fail CORS because only one origin is allowed), `OPENTRIPMAP_API_KEY`, **`NODE_ENV=production`**
(see §6), `JWT_EXPIRES_IN`. Atlas Network Access must allow Render's egress (usually 0.0.0.0/0 on the free plan).
README says UptimeRobot pings `/health` every 5 minutes to avoid cold starts.

## 3. Tests, linter, formatter, CI

|           | Status                                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests     | **None.** No test runner, no `test` script, no test files. `playwright` and `@playwright/test` are client devDependencies with no config or specs (they seem to have been used only for the screenshots in `docs/`). |
| Linter    | ESLint 9 flat config in both packages (client: react, react-hooks, react-refresh, jsx-a11y, prettier). `eslint .` currently reports **0 problems** on both.                                                          |
| Formatter | Prettier 3 in both (client uses prettier-plugin-tailwindcss). `prettier --check` **fails**: 6 server files and 16 client files are not formatted.                                                                    |
| CI        | **None.** No `.github/workflows`, no pre-commit hooks (husky / lint-staged). Vercel and Render auto-deploy without any lint, format or test gate.                                                                    |

## 4. Data model, external APIs, JWT checks

### User — [server/src/models/User.js](../server/src/models/User.js)

| Field                 | Type   | Rules                                              |
| --------------------- | ------ | -------------------------------------------------- |
| email                 | String | required, **unique**, lowercase, trim, regex match |
| passwordHash          | String | required, `select: false`, removed in `toJSON`     |
| displayName           | String | trim, max 60                                       |
| createdAt / updatedAt | Date   | timestamps                                         |

### Trip — [server/src/models/Trip.js](../server/src/models/Trip.js)

| Field                 | Type                                                                    | Rules                                                                    |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| user                  | ObjectId → User                                                         | required, indexed                                                        |
| destination           | `{ name (req), country, latitude (req, ±90), longitude (req, ±180) }`   | embedded                                                                 |
| startDate, endDate    | Date                                                                    | required; `endDate >= startDate` validator (runs on create/save only)    |
| notes                 | String                                                                  | trim, max 1000                                                           |
| savedAttractions      | `[{ xid (req), name (req), latitude, longitude (req), kind, address }]` | embedded subdocs with `_id`; schema has no max (the validator allows 50) |
| createdAt / updatedAt | Date                                                                    | timestamps                                                               |

Indexes: `email` unique, `user`, and `{ user: 1, createdAt: -1 }`. `autoIndex` is **off in production**
([db.js:15](../server/src/config/db.js#L15)), so these indexes exist only if they were built earlier (see §6).

### External API calls (all go through the server except map tiles)

| API                                                           | Server function                                                                                     | Endpoint                                                                                                  | Caller (client)                                                                  | Cache TTL |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------- |
| Open-Meteo Geocoding `geocoding-api.open-meteo.com/v1/search` | `geocodeCity` [openMeteoService.js:18](../server/src/services/openMeteoService.js#L18)              | GET `/api/geocode` ([geocode.controller.js](../server/src/controllers/geocode.controller.js))             | [api/geocode.js](../client/src/api/geocode.js) ← `SearchBar`                     | 7 days    |
| Open-Meteo Forecast `api.open-meteo.com/v1/forecast`          | `getForecast` [openMeteoService.js:71](../server/src/services/openMeteoService.js#L71)              | GET `/api/weather` ([weather.controller.js](../server/src/controllers/weather.controller.js))             | [api/weather.js](../client/src/api/weather.js) ← `SearchResultsPage`, `TripPage` | 30 min    |
| OpenTripMap `api.opentripmap.com/0.1/en/places/radius`        | `getAttractionsNearby` [openTripMapService.js:31](../server/src/services/openTripMapService.js#L31) | GET `/api/attractions` ([attractions.controller.js](../server/src/controllers/attractions.controller.js)) | [api/attractions.js](../client/src/api/attractions.js) ← `SearchResultsPage`     | 24 h      |
| OpenStreetMap tiles `{s}.tile.openstreetmap.org`              | – (browser)                                                                                         | –                                                                                                         | [TripMap.jsx](../client/src/components/map/TripMap.jsx)                          | browser   |

All three server calls use the global `fetch` with **no timeout** and no retry. The OpenTripMap key goes in the query string, server-side only.

### Where the JWT is issued and checked

- **Issued:** `generateToken` in [utils/generateToken.js](../server/src/utils/generateToken.js) (HS256, `sub` = user id, `expiresIn` from env), called from `register` and `login` in [auth.controller.js](../server/src/controllers/auth.controller.js).
- **Verified:** `verifyJWT` in [middleware/auth.js:16](../server/src/middleware/auth.js#L16). It reads `Authorization: Bearer`, runs `jwt.verify`, loads the user from the DB (`findById`) and sets `req.user`. It is mounted on:
  - [auth.routes.js](../server/src/routes/auth.routes.js): `GET /me`, `POST /logout`
  - [trip.routes.js:20](../server/src/routes/trip.routes.js#L20): `router.use(verifyJWT)` covers all trip routes; every query is also filtered by `user: req.user._id`.
- **Errors:** `TokenExpiredError` and `JsonWebTokenError` are mapped to 401 in [errorHandler.js](../server/src/middleware/errorHandler.js).
- **Client:** [api/axios.js](../client/src/api/axios.js) attaches the token from `localStorage` and, on any 401, clears it and fires `auth:expired`. [AuthContext.jsx](../client/src/contexts/AuthContext.jsx) calls `/auth/me` on mount. [ProtectedRoute.jsx](../client/src/components/auth/ProtectedRoute.jsx) is a UX gate only.

## 5. State kept in server memory (lost on every Render restart, deploy or spin-down)

| What                                                                                                                              | Where                                                            | Effect of losing it                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API response cache: a `Map` with TTLs (geocode 7 d, weather 30 min, attractions 24 h) plus a `setInterval` cleanup every 10 min   | [utils/cache.js:9](../server/src/utils/cache.js#L9)              | After a restart every lookup goes upstream again. The main concern is the OpenTripMap free quota. The Map has **no size limit**, and its keys come from user input (`q`, `tz`), so memory can grow without bound (see §6). |
| Rate-limit counters: express-rate-limit default `MemoryStore` for `authLimiter`, `publicApiLimiter` (and the unused `apiLimiter`) | [middleware/rateLimit.js](../server/src/middleware/rateLimit.js) | Counters reset on restart, so the brute-force limit on login resets too. They would also not be shared if there were ever more than one instance.                                                                          |
| `process.uptime()` in `/health`                                                                                                   | [app.js](../server/src/app.js)                                   | Cosmetic.                                                                                                                                                                                                                  |

Not in memory: sessions (JWT is stateless) and a token blacklist (none exists, `logout` is a no-op).
Client-side but similar: favourited attractions on the search page are only React state. If a logged-out user clicks
"Save trip", they are sent to `/login`, and **their selections are lost**.

## 6. Weak spots

### Security

1. **Vulnerable dependencies (npm audit).**
   - Server: `mongoose` (critical, direct), `proxy-addr` (critical, used by Express `trust proxy`), `body-parser`, `ip-address` (high), `qs`, `morgan` (moderate). All have fixes available within the current majors (`npm audit fix`).
   - Client: `react-router` / `react-router-dom` (high, including an open redirect through `useNavigate`, fixed in ≥7.18.2), `axios`, `follow-redirects`, `form-data` (high), and `vite`, `esbuild`, `postcss`, `nanoid`, `source-map-js` and others (mostly dev/build-time).
2. **Stack traces and internal messages can leak.** [errorHandler.js:42](../server/src/middleware/errorHandler.js#L42) includes `err.stack` whenever `NODE_ENV !== 'production'`, and `NODE_ENV` defaults to `development` ([env.js](../server/src/config/env.js)). If it is not set on Render, every error response includes a stack trace. Separately, unexpected 500s return the raw `err.message` even in production; the `isOperational` flag on `ApiError` is never checked. `CastError` echoes the user's input back.
3. **Mass assignment on trip create.** [trip.controller.js:7](../server/src/controllers/trip.controller.js#L7) spreads `...req.body` into `Trip.create`. `user` is overwritten safely, but a client can set `_id` (and possibly timestamps). Unvalidated subfields (`savedAttractions.*.kind/address`) go through with no length limit. The fix is `matchedData(req)` or an explicit pick.
4. **Unique email index may be missing in production.** `autoIndex: false` in production, and register does a check-then-insert. If the Atlas index was never built (for example the prod DB was never touched in dev mode), two parallel registrations can create duplicate accounts. Check in Atlas.
5. **Open redirect via `?next=`.** [LoginPage.jsx:24](../client/src/pages/LoginPage.jsx#L24) and [RegisterPage.jsx:24](../client/src/pages/RegisterPage.jsx#L24) pass `next` straight to `navigate()`. Together with the react-router advisory above, a crafted login link can send users off-site. Accept only values that start with `/` and not with `//` or `/\`.
6. **JWT in `localStorage`** (any XSS can steal it). There is no revocation: logout is client-side only and tokens stay valid for 7 days. `jwt.verify` doesn't pin `algorithms`. `JWT_SECRET` strength isn't checked at startup. This is acceptable for a portfolio app, but should be decided before adding anything sensitive.
7. **Rate-limiter design.**
   - `authLimiter` is one shared instance for login and register: 5 attempts in total per IP per 15 min, and **successful** logins count too (`skipSuccessfulRequests` is not set). Users behind a shared NAT can lock each other out.
   - `publicApiLimiter` is one instance shared by geocode, weather and attractions. One search costs 3 requests, so a user is blocked after about 10 searches in 15 min.
   - Trip routes have no limit, and `apiLimiter` is defined but never used.
8. **`dns.setServers(['8.8.8.8','1.1.1.1'])`** ([db.js:7](../server/src/config/db.js#L7)) is a Windows-dev workaround that also applies in production, which overrides Render's resolver for the whole process. It should only run in development.
9. Upstream calls have no timeout, so a hanging Open-Meteo or OpenTripMap request ties up the request until the client gives up (the client allows 15 s, or 90 s for geocode).

### Input validation

- `GET /api/weather` `tz` is not validated at all ([weather.controller.js:18](../server/src/controllers/weather.controller.js#L18)). It is forwarded upstream and used in the cache key. Any string up to the URL length creates a new cache entry, so memory can be grown on purpose. Limit it to IANA zone names or `auto`.
- `parseCoord` accepts `""` as `0` (`Number('') === 0`), so `?lat=&lng=` returns weather for (0, 0).
- `ISO_DATE` regex ([trip.validators.js:3](../server/src/validators/trip.validators.js#L3)) accepts `2026-13-45`. Mongoose then throws a CastError (400), but the message is unclear. Use `isISO8601({ strict: true })`. There is no upper bound on trip length or year.
- `savedAttractions.*.xid` and `.name` are `optional()` in the validator but `required` in the schema, so the error comes from Mongoose instead of the validator. There are no length limits on name, kind or address.
- `validate.js` comment promises a `details` array that is never returned.
- Geocode "no results" (404) is not cached, so repeated misspellings always go upstream.
- The cache has no in-flight de-duplication, so concurrent identical cold requests each go upstream.

### Duplicated and dead code

- `parseCoord` is copied in `weather.controller.js` and `attractions.controller.js`.
- `fmtRange` is copied in `SearchResultsPage.jsx`, `TripPage.jsx` and `TripCard.jsx` (with slight differences).
- `wmoCodeToGroup` exists in the server's `weatherCodeMap.js` (unused there) and in the client's `weatherIcons.jsx`.
- The health route is defined twice (`/health` in app.js and `/api/health` in routes/index.js).
- Login and Register pages repeat the same `next` redirect and error-handling logic. The email regex is in both `User.js` and `RegisterPage.jsx`.
- The delete-trip flow is implemented separately in `TripCard` and `TripPage`, with different UX (inline confirm vs `window.confirm`).
- Dead code: `client/src/App.css` (Vite template), `client/README.md` (Vite boilerplate), the unused `ui/Input`, `ui/Card`, `ui/Spinner` and `ui/index.js` barrel (`FormField` and `Button` are imported directly), `apiLimiter`, server `wmoCodeToGroup`, and `ProfilePage` (a routed stub that shows only a heading). The `PATCH /trips/:id` notes endpoint has no UI, and trips are always created with `notes: ''`.

### Bugs and robustness (client)

- **Users get logged out on Render cold start.** In [AuthContext.jsx:25](../client/src/contexts/AuthContext.jsx#L25), `/auth/me` deletes the token on _any_ error, including timeouts, network errors and 5xx. The axios timeout is 15 s and a free Render cold start takes about 30–60 s. Only a 401 should clear the token.
- **Dates show one day early in timezones west of UTC.** `new Date('2026-11-20')` is UTC midnight, so `toLocaleDateString` in the Americas shows Nov 19. This affects `fmtRange` (3 places) and `ForecastStrip`'s `formatDay`/`formatDate`. `SearchBar`'s `today()` uses `toISOString()` (a UTC date), so around midnight the date picker's minimum is off by one day.
- On `TripPage`, weather loading and errors are not shown (just empty space). Delete failures in `TripPage` and `TripCard` are silent.
- The router has no `errorElement`, so any render error shows React Router's default developer error screen.
- No code splitting: Leaflet and every page are in the main bundle.
- `TripPage` creates a new `Set` on every render, and `orangeMarker()` creates a new `divIcon` per marker per render, so all markers are re-created on every re-render.

### Responsive layout and accessibility

- **ForecastStrip** uses `grid-cols-7` at every width. On 320–375 px phones each column is about 36–40 px including `p-2`, so the date and temperature text is cramped or overflows. Use a horizontal scroll or 4+3 columns below `sm`.
- **Sticky sub-header** on the Search and Trip pages (`sticky top-16`) wraps to two rows on phones (title and dates, then the Save button). Together with the 64 px navbar it covers about a third of a small screen. The map's `lg:top-44` / `lg:top-48` and `calc(100vh-12rem/14rem)` values are magic numbers tied to the header height and break if the title wraps on desktop.
- `<Link><Button/></Link>` puts a button inside a link (invalid HTML, confusing for screen readers) in the Navbar, Dashboard and NotFound pages.
- Touch targets are small: the TripCard trash icon is about 24 px and the AttractionCard heart about 32 px, below the 44 px guideline.
- On mobile the map is the first block and Leaflet captures touch drag, so it is easy to get "stuck" scrolling the map instead of the page.

### Outdated dependencies (`npm outdated`)

- Within-range updates (safe): helmet, morgan, mongoose 8.24.10, express-rate-limit, axios 1.21, react-router-dom 7.18.5, react-hook-form, lucide-react, postcss, playwright, prettier.
- Major versions behind (plan separately):
  - Server: Express 4 → 5, Mongoose 8 → 9, dotenv 17 → 18, ESLint 9 → 10.
  - Client: React 18 → 19, react-leaflet 4 → 5 (needs React 19), Vite 5 → 8, @vitejs/plugin-react 4 → 6, Tailwind 3 → 4, eslint-plugin-react-hooks 5 → 7.
- `engines: "<23"` will block Node 24 LTS.

## 7. Fix before adding new features

**P0: security and correctness (small, high value)**

1. Run `npm audit fix` in both packages and bump `react-router-dom` to ≥7.18.5, `axios` and `mongoose` to the latest patch versions. Leave majors for later. Re-run the build and smoke test.
2. On Render, confirm `NODE_ENV=production`. In Atlas, confirm the `email_1` unique index and the `trips` indexes exist.
3. Error handler: return a generic message for non-operational 5xx errors in production, and stop echoing input in `CastError`.
4. `createTrip`: save only validated fields (`matchedData`), require `xid` and `name` on attractions with length limits, and use strict ISO-8601 dates.
5. Validate `tz` against a whitelist, cap the cache size (simple LRU or max entries), and add `AbortSignal.timeout()` to upstream `fetch` calls.
6. Sanitise `?next=` to same-origin paths only.
7. AuthContext: clear the token only on a 401 from `/auth/me`, not on network or timeout errors.
8. Rate limits: separate limiter instances for each endpoint group, `skipSuccessfulRequests` on login, a realistic public limit, and a limit on trip routes.
9. Run `dns.setServers` in development only.

**P1: foundation, so new features don't pile onto problems**

10. Add tests:
    - Server: Vitest (or node:test) + supertest + mongodb-memory-server. Cover auth flow, trip ownership (user A cannot read or delete B's trip), validators and the error handler.
    - Client: Vitest + Testing Library for `useFetch` and the date helpers.
11. Add GitHub Actions CI (both packages): `npm ci` → `eslint` → `prettier --check` → tests → `vite build`. First run `prettier --write` once in a dedicated formatting-only commit.
12. Fix the timezone date bug (parse `YYYY-MM-DD` as a local date, or format with `timeZone: 'UTC'`).
13. Move shared helpers to one place: `parseCoord` → `server/src/utils`, `fmtRange` and date helpers → `client/src/lib/dates.js`, a single `/health`. Delete the dead files listed in §6.
14. Responsive and a11y fixes: ForecastStrip on mobile, sticky header height and map offsets, no buttons inside links, 44 px touch targets.
15. Add a router `errorElement`. Show weather and delete errors on TripPage.
16. Keep favourites through the login redirect (store them in `sessionStorage` or the `next` URL).
17. README: say that `VITE_API_BASE_URL` must end with `/api`, and document the Render and Vercel settings (or add a `render.yaml`).

**P2: later, as planned upgrades**

- Express 5, React 19 + react-leaflet 5, Vite 6+/plugin-react, Tailwind 4, ESLint 10. Do them one at a time, each with CI green.
- Consider httpOnly cookie auth plus token revocation, and a persistent cache or rate-limit store (Mongo TTL collection, or Upstash Redis free tier) if restarts become a real quota problem.
- Lazy-load the map and pages with `React.lazy` to shrink the first bundle.

## 8. Fix plan

### Group 1. Security: fix first, branch fix/security

Manual checks (done by me, list them as a checklist): NODE_ENV=production on Render;
email_1 and trips indexes exist in Atlas (if any is missing, create it once, e.g. with a one-off
syncIndexes() script, and check for duplicate emails first); JWT_SECRET is long and random;
Render build command stays npm install (decision: CI runs npm ci, which checks the lockfile)
Code fixes:

1. npm audit fix in both packages; patch updates for react-router-dom (≥7.18.5), axios, mongoose.
   Stay on the current major versions. Apply the other safe updates within the current majors: helmet, morgan, express-rate-limit, react-hook-form, lucide-react,
   postcss, playwright, prettier, @fontsource-variable/\*, autoprefixer, @tailwindcss/typography,
   eslint-plugin-react-refresh, globals, @types/leaflet.
   Known remaining risk: the vite / esbuild advisories most likely need a major Vite upgrade, which
   is out of scope (Group 5). They affect the dev server and build only, not the deployed site.
   Record them as accepted and re-check with npm audit after the fixes.
2. Error handler: generic message for 5xx in production; CastError must not echo user input.
3. createTrip: save only validated fields (matchedData); require xid and name on attractions;
   length limits; strict ISO-8601 dates. Also set a maximum trip length and an upper bound on
   the year (e.g. no more than 2 years ahead).
4. Sanitise ?next= to same-origin paths only (starts with "/", not "//" or "/\").
5. AuthContext: clear the token only on 401 from /auth/me.
6. dns.setServers only in development.
7. Validate tz against an allowed list; AbortSignal.timeout() on upstream fetch calls. Make parseCoord reject an empty string, which it currently treats as 0.
   Stopgap until the Group 4 quota service: a simple maximum-entries cap on the in-memory cache
   (geocode q is still free text and can grow it without limit).
8. Separate login and register limiters, skipSuccessfulRequests on login, a limit on trip routes.
9. jwt.verify with algorithms: ['HS256']; check at startup that JWT_SECRET is set and strong.
10. CORS: decide on Vercel preview deployments. Either accept that previews can't reach the API,
    or allow a short explicit list of origins (CLIENT_ORIGIN as a comma-separated list), never a
    wildcard.

### Group 2. Quality tools: second, branch setup/quality

- Check what's already installed (ESLint, Prettier, Playwright); only add what's missing.
- Server tests: node:test + Supertest + mongodb-memory-server. Cover the auth flow,
  trip ownership (user A cannot read or delete B's trip), validators, the error handler,
  and the Group 1 fixes. External APIs mocked.
- Client tests: node:test + jsdom + Testing Library for useFetch (date-helper tests come
  with the timezone fix in Group 3).
- GitHub Actions CI: npm ci → eslint → prettier --check → tests → vite build.
  Format everything once with prettier --write in a separate commit.
- Gate deploys on CI: set Render auto-deploy to wait for CI checks to pass.

0. Docs fixes:
   - CLAUDE.md "Ownership scoping": add "(owner-only until trip sharing; will be replaced
     by one permission check)".
   - docs/decisions/0001: "Revisit when" → after the project (after 6 Dec 2026), unless an
     advisory appears in a runtime dependency. No Vite major upgrade during the project.
1. Formatting-only commit: prettier --write in both packages. No other changes in this commit.
   Run lint and the existing tests after it.
2. Server integration tests: keep node:test, add supertest + mongodb-memory-server (devDependencies).
   - A test helper: sets test env vars, starts the in-memory MongoDB, imports app.js
     (no listen, no real database, no real keys).
   - External APIs are always mocked (fetch stubbed), so tests never use our free quotas.
   - Rate limiters must not make tests flaky, and must not be disabled in production code.
   - Cover: register / login / duplicate email / wrong password / /auth/me;
     trip ownership (user B gets 404 on GET, PATCH, DELETE of user A's trip);
     createTrip ignores \_id, createdAt and extra fields; validation errors return 400;
     a 5xx in production mode returns the generic message; tokens signed with alg none or HS512 → 401;
     6 successful logins are not blocked; CORS allowed vs foreign origin;
     upstream timeout → 504 UPSTREAM_TIMEOUT; invalid tz → 400; a cache hit does not call fetch again.
3. Client tests: node:test + jsdom + Testing Library (jsdom globals loaded with
   `node --import`). Add a useFetch test. Vitest was dropped: every version that supports
   Vite 5 brings critical dev-only tinypool advisories (fixed only in Vitest ≥ 4.1.12, which
   needs Vite ≥ 6). The "no @/ imports, no JSX in tested code" restriction stays until then.
4. GitHub Actions CI (.github/workflows/ci.yml): on push and pull_request; two jobs (server, client);
   Node from .nvmrc; npm ci with cache → eslint → prettier --check → tests → vite build (client).
   No secrets needed. Cache the mongodb-memory-server binary.
5. Docs: update the Commands and testing lines in CLAUDE.md;
   write docs/decisions/0002-test-stack.md (node:test + supertest + mongodb-memory-server on the server,
   node:test + jsdom + Testing Library on the client, and why).

Manual (me): on Render, set auto-deploy to wait for CI checks to pass, if the option is offered.
Check that the Actions tab is green.

Out of scope: Playwright e2e (at the end of the project), husky / pre-commit hooks,
Vercel deploy gating, coverage thresholds, the Vite major upgrade, the date-helper tests (Group 3).

### Right after Group 2, before Group 3: branch fix/usefetch-stale

- fix/usefetch-stale: ignore or abort stale responses when deps change, un-skip the test.
  (Found by the Group 2 client tests: `useFetch` shares one `cancelRef` across effect runs, so a
  slow response for the previous deps overwrites the current data. Test:
  `client/test/useFetch.test.js`, marked `TODO(bug)`.)

### Group 3. Clean-up: third, branch chore/cleanup

- Delete dead code: App.css, client README boilerplate, unused ui/Input, ui/Card, ui/Spinner,
  ui/index.js, apiLimiter, server wmoCodeToGroup. Keep one health route.
- Move fmtRange and date helpers to client/src/lib/dates.js and fix the timezone bug there.
  This includes ForecastStrip's formatDay / formatDate and SearchBar's today() (which uses a UTC date).
  While in SearchBar, also add `max` limits to the date inputs that match the server rules from
  Group 1 (server/src/utils/tripDates.js): start at most 2 years ahead, trip at most 30 days
  (inclusive). Today the user only learns about these limits from the error shown on "Save trip".
- Add a router errorElement.
- Fix the details comment in validate.js, keep one email regex, and move the shared next redirect and error handling from the Login and Register pages into one helper.

### Group 4. Not fixed now: will be replaced by shared modules (architecture work, later)

- Cache size cap, caching 404 results, in-flight de-duplication → a quota service with a MongoDB TTL cache.
  (Group 1 adds a temporary max-entries cap until then.)
- The shared publicApiLimiter → per-user daily search limits by plan (30/60/150).
- Rate-limit counters reset on every restart → keep them in a persistent store (MongoDB),
  together with the per-user limits.
- isOperational and the error format → one standard API error format.
- Duplicated parseCoord → shared validation.
- JWT revocation → a tokenVersion field, added with the password reset feature.
- httpOnly cookies: decision to keep localStorage for now; record it in docs/decisions/.

### Group 5. Backlog: fix inside later features or at the end

- With trip editing: delete flow implemented twice, notes endpoint without UI, TripPage weather
  and delete errors, map markers re-created on every render, keeping favourites through the
  login redirect (draft trip on the device).
- With account settings: replace the ProfilePage stub.
- With password reset: login timing difference for unknown emails (use a dummy bcrypt compare),
  and forgot-password must respond the same way and in the same time whether the email exists
  or not (don't await the email send).
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
