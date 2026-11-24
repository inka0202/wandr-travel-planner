# 0001. Accepted npm audit advisories (dev/build-time only)

- **Status:** accepted
- **Date:** 2026-11-17 (table re-checked 2026-11-19, end of branch)
- **Context:** `docs/audit.md` §6.1, fix plan §8 Group 1 step 1 (branch `fix/security`)

## Decision

After `npm audit fix` (no `--force`) and in-range updates in both packages,
`npm audit --omit=dev` reports **0 vulnerabilities** in `server/` and `client/`.

The advisories that remain are in development and build tooling only. Their fixes need a
major-version change, which the fix plan leaves for later (Group 5). We accept them until then.

`npm audit` (all dependencies) on 2026-11-19: server 2 moderate, client 3 moderate + 1 high.

| Package | Severity | Advisory chain                                                                                                                                                                                                                               | Pulled in by                                     | Fix offered                      | Why accepted                                                                                                                |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| server  | moderate | minimatch (ReDoS via globparts)                                                                                                                                                                                                              | `nodemon` (devDependency)                        | nodemon downgrade, "breaking"    | Local file watcher only; `npm start` on Render does not use nodemon.                                                        |
| client  | **high** | `vite` itself: path traversal in optimized deps `.map`, `server.fs.allow`/`server.fs.deny` bypasses, cross-origin script execution via custom middleware, and launch-editor issues on Windows (NTLMv2 hash disclosure, command-arg escaping) | `vite@5` (devDependency; 5.4.21 is the last 5.x) | Vite ≥ 6.4.4 / 8 (major)         | All in the dev server (`npm run dev`) or its open-in-editor feature. The static build served by Vercel contains none of it. |
| client  | moderate | esbuild (dev server request forgery)                                                                                                                                                                                                         | `vite@5`                                         | Vite 8 (major)                   | Affects `npm run dev` only, not the static build served by Vercel.                                                          |
| client  | moderate | postcss-selector-parser (quadratic parsing)                                                                                                                                                                                                  | `@tailwindcss/typography`                        | typography downgrade, "breaking" | Build-time CSS processing of our own source files; nothing reaches the browser.                                             |

## Mitigation

- Don't expose the Vite dev server on a public network (`vite --host` only on trusted networks).
  This matters more since the high-severity Vite advisories: they let a reachable dev server leak files.
- Don't browse untrusted sites while `npm run dev` is running (cross-origin and request-forgery advisories).
- Re-run `npm audit` and `npm audit --omit=dev` in both packages after every dependency change.
  A new advisory in a runtime dependency is not covered by this decision.

## After the project (after 6 Dec), unless a runtime advisory appears

No Vite major upgrade during the project.

The Vite and Tailwind majors are upgraded (Group 5), or nodemon ships a fixed 3.x release.
Because a high-severity Vite advisory is now accepted, the Vite major upgrade should be early in Group 5.
