# 0002. Test stack: node:test everywhere, real MongoDB in memory, no Vitest yet

- **Status:** accepted
- **Date:** 2026-11-20
- **Context:** `docs/audit.md` §3 (no tests, no CI), fix plan §8 Group 2 (branch `setup/quality`)

## Decision

| Package | Runner                      | Extra devDependencies (exact pins)                                             |
| ------- | --------------------------- | ------------------------------------------------------------------------------ |
| server  | `node:test` + `node:assert` | `supertest` 7.3.2, `mongodb-memory-server` 11.3.0                              |
| client  | `node:test` + `node:assert` | `jsdom` 26.1.0, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2 |

CI (`.github/workflows/ci.yml`) runs `npm ci` → lint → `prettier --check` → tests (→ `vite build`
for the client) in both packages, on every push and pull request.

## Why

- **node:test on the server:** it's built into Node 22, already used by the Group 1 unit tests,
  and needs no config or transpiling for ESM. Each file runs in its own process, which isolates
  `env.js`, the in-memory cache and rate-limit counters between files.
- **supertest:** sends requests to the Express `app` in-process, without `listen()` or ports.
- **mongodb-memory-server instead of mocking Mongoose:** ownership scoping (`findOne` /
  `findOneAndDelete` filtered by `user`), schema validation and the unique email index only
  mean something against a real `mongod`. The binary (~100 MB) is downloaded once and cached in CI.
- **node:test + jsdom + Testing Library on the client, not Vitest:** Vitest 3.2.x is the last line
  that supports Vite 5, and it brings dev-only advisories with no fix in that line: 2 critical
  (tinypool prototype-pollution gadget → RCE) and 2 moderate (@vitest/mocker). The fixes need
  Vitest ≥ 4.1.12, which needs Vite ≥ 6, and the Vite major upgrade is out of scope until after the
  project (decision 0001). Without Vitest, tested client code still can't use `@/` imports or JSX.

## How the tests stay safe and stable (no production code changes)

- **No real database or keys:** `test/helpers/testApp.js` sets `DOTENV_CONFIG_PATH` to a missing
  file (so `server/.env` is never read), starts mongodb-memory-server, sets test-only env vars,
  refuses any non-local `MONGODB_URI`, then imports `app.js` and calls the real `connectDB()`.
- **Rate limiters:** the app trusts one proxy hop, so `X-Forwarded-For` becomes `req.ip`. Each test
  uses its own fake IP and gets fresh counters, while the limiters keep their production limits.
- **External APIs:** `globalThis.fetch` is replaced by a guard that fails any unstubbed call; tests
  stub it per case with `mock.method`. Tests never use the Open-Meteo or OpenTripMap quotas.
- **Bugs found by tests** are not fixed on the test branch: the test is skipped with
  `TODO(bug)` and the fix is planned in audit §8 (e.g. `fix/usefetch-stale`).

## Revisit

With the Vite major upgrade (audit §8 Group 5): move the client to Vitest ≥ 4.1.12, which lifts the
no-`@/`/no-JSX rule. Playwright e2e comes at the end of the project.
