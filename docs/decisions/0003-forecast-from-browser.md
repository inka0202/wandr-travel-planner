# 0003. Forecast fetched from the browser, because Open-Meteo limits per IP and Render shares outbound IPs

- **Status:** accepted
- **Date:** 2026-11-22
- **Context:** production bug, `docs/audit.md` §8 "Production bug, out of band: branch fix/weather-upstream"

## Evidence

On Render, `GET /api/weather` always failed with 502 `WEATHER_UPSTREAM`; the identical request
worked locally. After Phase 1 added upstream logging, the Render log showed:

```
[upstream] {"service":"open-meteo-forecast","status":429,"retryAfter":"40550","reason":"Daily API request limit exceeded. Please try again tomorrow."}
```

Open-Meteo's free API limits requests **per IP** (10,000 per day). Render's free plan sends
outbound traffic from IPs shared with other apps, so the daily limit is used up by other people's
traffic before ours counts. The request itself was correct: no parameter depends on the server's
time zone or locale. Nothing we do on the server (caching, backoff) makes this reliable, because
we don't control who else uses that IP.

## Decision

The browser calls `https://api.open-meteo.com/v1/forecast` directly
(`client/src/lib/openMeteo.js`), so each user is counted against their own IP.

- Same request as the server sent: `latitude`, `longitude`, `timezone`, `forecast_days=7`, and the
  same `current` / `daily` variables. Same response shape (`{ current, daily, timezone }`), so the
  weather components didn't change.
- Plain `fetch`, **never the shared axios instance** (it attaches the user's JWT).
  `referrerPolicy: 'no-referrer'` (the page URL holds the destination and dates),
  `credentials: 'omit'`, 10 s timeout covering the body, no retry, no client cache.
- Failures throw `WeatherError` with a `code` (`WEATHER_TIMEOUT`, `WEATHER_NETWORK`,
  `WEATHER_RATE_LIMITED`, `WEATHER_UPSTREAM`, `WEATHER_BAD_RESPONSE`). The UI behaves as before:
  a weather error never blocks the map, attractions or "Save trip".
- "Weather data by Open-Meteo.com" is shown next to the forecast (Open-Meteo data is CC BY 4.0).
- `GET /api/weather` stays, with no client callers, for future server-side jobs. An upstream 429
  now maps to 503 `WEATHER_RATE_LIMITED` (no retry); the response message is the generic 5xx one,
  so `code` is the contract.
- Geocoding stays on the server (7-day cache, low volume). If the log shows
  `open-meteo-geocode` with a 429, it moves to the browser the same way, as an addition to this record.

## Options considered

| Option                                                           | Why not (or why)                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Browser call**                                                 | **Chosen.** Per-user limits fix the cause; no key, no cost; Open-Meteo allows cross-origin calls.                                               |
| Hybrid: server first, browser on 503                             | Two code paths to keep working, and the server's IP is exhausted most days, so it would nearly always fall back anyway.                         |
| Key-based provider (Open-Meteo paid, OpenWeatherMap, MET Norway) | Costs money or needs a new key, and the others need a new mapping and new weather-code icons. Worth it only if weather must stay on the server. |
| Accept the outage                                                | Weather is a headline feature; "temporarily unavailable" on most days isn't acceptable.                                                         |

## What we give up

- **The server no longer caches or counts weather calls.** Every page view is a fresh call from
  that user's browser. The Group 4 quota service (audit §8) won't cover weather.
- **An exception to "every external call goes through the server"** (before, only map tiles were).
  New external calls still go through the server unless a decision record says otherwise.
- **Privacy:** the user's IP and the destination's coordinates go to Open-Meteo. A future privacy
  page must say so.
- **Duplicated mapping:** `FORECAST_PARAMS`, `WMO_CODES` and `normalizeForecast` exist in both
  `server/src/utils/forecast.js` (+ `weatherCodeMap.js`) and `client/src/lib/openMeteo.js`.
  `client/test/openMeteo.parity.test.js` imports the server files by relative path and fails if they
  drift, so those server files must stay pure (no env, no npm imports).
- **CSP:** there is none on Vercel today. A future one needs `connect-src https://api.open-meteo.com`.
- **Free tier terms:** non-commercial use only. A commercial launch needs a paid key.
- Users behind one shared NAT (offices, carrier CGNAT) share a limit, and ad blockers may block the
  call. Both show the existing "Weather temporarily unavailable." text.

## Revisit when

- We move off Render's shared outbound IPs, or pay for an Open-Meteo key: weather can go back to
  the server (cache, counting, one code path).
- **We need server-side weather (e.g. trip alerts or other background jobs).** Plan for that:
  - Keep using `GET /api/weather` / `getForecast` (it already maps 429 → 503 `WEATHER_RATE_LIMITED`).
  - Add an upstream block, `server/src/utils/upstreamBlock.js`:
    `createUpstreamBlock({ defaultSeconds = 60, maxSeconds = 86400 })` →
    `{ isBlocked(), blockFor(retryAfter), reset() }`. One module-level instance per service.
    `blockFor` parses `Retry-After` as seconds or an HTTP date; missing, invalid or negative →
    the default; capped at `maxSeconds`.
  - `fetchWithTimeout` then also returns `retryAfter` (raw header or `null`).
  - `getForecast`: while blocked, throw 503 `WEATHER_RATE_LIMITED` without calling upstream; on a
    429, `blockFor(retryAfter)` and throw the same. `withCache` runs first, so cached forecasts are
    still served while blocked.
  - In memory is fine: losing the timestamp on a restart costs one upstream call, which gets a 429
    and sets it again. Nothing depends on it for correctness, so it isn't state that "must survive
    restarts". If jobs need a guaranteed budget, put it in the Group 4 MongoDB quota service instead.
  - Tests in their own file (the block is per-process state), with `mock.timers` for `Date`.
  - The jobs still need an IP whose quota isn't used up by others (a paid key or a different host);
    the block only stops us from hammering an exhausted limit.
