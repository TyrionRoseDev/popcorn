---
name: verify-popcorn
description: Launch and drive a disposable instance of Popcorn (the TanStack Start + tRPC + Drizzle film/TV diary web app in this repo) through its real browser UI with headless Playwright, and capture screenshots, ARIA snapshots, traces, captured emails and DB rows as proof. Use when you need to prove a UI or API change works end to end (sign-in, search, marking a film watched, watchlists, the series tracker), or when asked to run, verify, or screenshot Popcorn.
---

# verify-popcorn

Popcorn's main interface is the web UI under `/app/*`, which calls tRPC at `/api/trpc`. Sign-in uses Better Auth magic links (`/api/auth/*`). This skill starts a **separate, throwaway** copy of the stack from the working tree you have checked out, including uncommitted changes. It drives the stack the way a user would and saves the evidence outside the repo.

Everything goes through one executable: `.claude/skills/verify-popcorn/scripts/verify-popcorn`. The examples below call it `vp`:

```bash
vp() { /Users/tyrion/Dev/popcorn/.claude/skills/verify-popcorn/scripts/verify-popcorn "$@"; }
```

## What a run is (isolation)

- **DB:** a fresh `postgres:17` container named `popcorn-verify-<RUN_ID>` with the label `verify-popcorn.run=<RUN_ID>`. It runs on a random `127.0.0.1` port with tmpfs storage and no volume. It never touches the compose `pgdata` volume, port 5432, or `DATABASE_URL` from `.env`.
- **Email:** `RESEND_BASE_URL` points to a local mail sink (`scripts/mail-sink.ts`), which writes every outgoing email as JSON. No real email is sent, and the real `RESEND_API_KEY` is replaced with a dummy.
- **App:** `bun x vite dev` (the same thing `bun run dev` runs) on a random port. All secrets are overridden: `DATABASE_URL`, `BETTER_AUTH_URL/SECRET`, `PORT`, `RESEND_*`, `UPLOADTHING_TOKEN=placeholder` and `CRON_SECRET`. The **only** value read from the repo `.env` is `TMDB_READ_ACCESS_TOKEN`, and TMDB is a read-only API. `PORT` must equal the app port, because SSR tRPC calls go to `http://localhost:$PORT` (see `src/integrations/tanstack-query/root-provider.tsx`). Without it, SSR would query whatever is running on :3000.
- **Browser:** headless Chromium driven by `playwright-core`. It is installed in `~/.cache/verify-popcorn/tools`, not in package.json. The skill never uses the user's Chrome.
- Runs can sit side by side because every port is random and each run gets its own `RUN_ID`. All runs share `node_modules/.vite` in the checkout, so starting two runs at exactly the same moment can race the dep optimizer. Start runs one after another.

Paths: state is in `~/.cache/verify-popcorn/runs/<RUN_ID>/`, with env, pids, logs, captured mail and `auth.json`. Evidence is in `~/.cache/verify-popcorn/evidence/<RUN_ID>/`. Set `VERIFY_POPCORN_HOME` to move both.

Prerequisites: Bun, `jq`, `openssl`, a running Docker daemon (OrbStack here: `orb start`), a `postgres:17` image or network access to pull one, and a non-empty `TMDB_READ_ACCESS_TOKEN` in the environment or in the repo `.env`. A cached Playwright headless shell is found automatically. If none exists, run `bunx playwright-core@1.64.1 install chromium-headless-shell`.

## Launch

```bash
vp up        # prints RUN_ID on the last line; ~15-30s
```

`up` does the following, in order:

1. Starts the DB container and waits for a **TCP** `pg_isready` plus `select 1`. During initdb the server only listens on the socket, so a TCP answer means init has finished.
2. Runs `bun run db:migrate` with the run's `DATABASE_URL`. Drizzle's dotenv does not override variables that are already set.
3. Seeds `scripts/seed.sql` with these accounts:
   - `vera@popcorn.test` (@veraverify), already onboarded. This is the default actor.
   - `felix@popcorn.test` (@felixfriend), an accepted friend of Vera.
4. Starts the mail sink, then vite.
5. Treats the stack as **ready** only when `GET /api/health` returns 200 **and** the SSR'd `/login` contains "Send Magic Link". Dev SSR compiles routes lazily, so health alone is not enough.

The first `up` after a dependency change can take longer while vite optimizes deps. `up` writes `~/.cache/verify-popcorn/current`, and later commands target that run. Set `VP_RUN_ID=<id>` to target a different one.

## Doctor (run first, and whenever anything looks off)

```bash
vp doctor    # read-only; exit 0 = worth driving
```

Doctor checks:
- the container is running and carries this run's label
- the migrations count matches `drizzle/meta/_journal.json`
- the seed user exists
- the mail sink is alive
- the app pid is alive and **owns the listening port**
- `/api/health` returns 200
- if a session is saved, `/api/auth/get-session` with it returns an `@popcorn.test` user. That proves the app is reading **this run's** DB.

It also prints the HEAD sha and the dirty-file count, so evidence can be tied to a build. Do not drive a run that fails doctor. Run `vp down` and then `vp up` again.

## Drive

Journeys are small TypeScript files in `journeys/` that run in headless Chromium:

```bash
vp login [email]                      # journeys/sign-in.ts: real /login form -> captured magic link -> saves session
vp drive mark-watched [tmdbId] [query]  # journeys/mark-watched.ts (default The Matrix / 603)
vp drive <path/to/your-journey.ts>    # ad-hoc journey
```

A journey default-exports `async (vp, args) => {}`, and its `vp` argument provides the following (see `scripts/lib/vp.ts`):

- `vp.page` / `vp.context`: Playwright objects. `baseURL` is the app, so call `vp.goto("/app/search")`.
- `vp.goto(path)` / `vp.settled()`: navigate, then wait for network idle **and React hydration**. **Always use these instead of a bare `page.goto`.** Dev SSR renders the form before React attaches, and typing into it early gets wiped. That was the first failure seen while building this skill.
- `vp.signIn(email?)`: the real magic-link path. Use it when `vp.goto` lands on `/login`.
- `vp.step(label)`, `vp.expect(cond, msg)`: write to `steps.log`. A failed expect fails the journey.
- `vp.capture(name)`: numbered full-page PNG plus ARIA snapshot YAML.
- `vp.sql(query, label)`: psql against the run DB. The query and its rows are written to `db.log`.
- `vp.waitForMail(to)`: newest captured email for that address. Saved as `mail.json`/`mail.html`.

Other tools:

```bash
vp sql "select email, username from \"user\""   # side-effect checks; run DB only
vp mail [--last]                                   # captured emails with extracted link
vp logs [app|mail]                                 # tail server / mail-sink logs
vp env                                             # ports, urls, dirs for this run
vp runs                                            # every known run and whether it is alive
```

Selector conventions for this app, taken from the source:
- Prefer `aria-label` (`"Search movies and TV shows"`, `"Rate 4 stars"`, `"Clear search"`), placeholders (`you@email.com`, `Share your thoughts…`, `e.g. Friday Night Horror`) and visible button text (`Send Magic Link`, `Save & Done`, `Create`, `Mark All`).
- Dialogs have accessible names, such as `getByRole("dialog", { name: "Review" })` and `/Achievements? Unlocked/`. Always scope to the named dialog, because several Radix dialogs can stack.
- The round "arcade" buttons on title pages (Watchlist / Watched / Invite) have **no accessible name**. Their label is a sibling div. Use `page.locator("div.text-center", { has: page.getByText("Watched", { exact: true }) }).getByRole("button")`.
- Title links have stable hrefs: `a[href="/app/title/movie/603"]`, `a[href="/app/title/tv/1396"]`.

The feature map in `features/README.md` lists each user-facing feature and its recipe. Read it before driving anything.

## Evidence

Each journey writes to `~/.cache/verify-popcorn/evidence/<RUN_ID>/<journey>/`:
- `steps.log`: timestamped steps, PASS/FAIL lines and the overall RESULT
- `NN-*.png` + `NN-*.aria.yml`: screenshots and ARIA snapshots in step order
- `trace.zip`: Playwright trace. Open it with `bunx playwright-core@1.64.1 show-trace <file>`
- `db.log`: every side-effect query and its rows
- `console.log`: browser console and page errors
- `mail.json` / `mail.html`: the email a journey consumed
- `zz-failure.png`: written only when the journey fails

`vp down` also copies the server logs, migrate/seed logs and all captured mail into `evidence/<RUN_ID>/logs/`.

Proof standards:
- Drive the real user path: UI clicks and the real magic link. Do not insert sessions or call internal setters.
- Capture both the action and the resulting state. Then prove persistence from a second view, either a reload or another page.
- **Always** check the side effect in the DB with `vp.sql`.
- The only mocked boundary is Resend: the app already isolates it behind `RESEND_BASE_URL`. TMDB is real unless you pick `VP_TMDB=stub`.
- When a journey reports FAIL, report the failure. Do not weaken the assertion to make it pass.

## CI and recorded TMDB

CI has no TMDB token, so it replays recorded responses. Three `up` settings make this work, and each one also works locally:

- `VP_TMDB=stub` starts `scripts/tmdb-stub.ts` and points the app's `TMDB_BASE_URL` at it. The stub serves `tests/fixtures/tmdb/<path>/<sorted query>.json`, with any `YYYY-MM-DD` value keyed as `DATE`. A request with no fixture gets a 404 and a `MISS` line in `vp logs tmdb`.
- `VP_TMDB=record` runs the same stub as a proxy to the real API and saves each response. It needs the token, so run it locally only. `run-journeys` prints any `MISS` lines when it finishes.
- `VP_DATABASE_URL=postgresql://...@127.0.0.1:<port>/<db>` uses an empty local postgres, such as a CI service, in place of the container. It needs `psql`.
- `VP_SERVER=build` runs `vite build` and serves `.output` as production does. A cold `vite dev` compiles routes on first request and can time out on a loaded machine.

`scripts/run-journeys <journey>...` brings up one run, drives the journeys in order, prints each `RESULT` line and tears the run down. CI calls it from `.github/workflows/ci.yml`. To add fixtures for a new journey, record it, then replay it and check that no `MISS` lines appear:

```bash
VP_TMDB=record scripts/run-journeys my-journey
VP_TMDB=stub VP_SERVER=build scripts/run-journeys my-journey
```

## Cleanup

```bash
vp down      # current run; or VP_RUN_ID=<id> vp down
```

`down` does the following:
- kills the process trees of the app and mail-sink pids **recorded for this run**, never by name
- removes the container only if its label matches the run
- copies the logs into the evidence folder and deletes the state dir

Evidence is never deleted. Run `vp down` after **every** run, including failed iterations, and use `vp runs` to find leftovers. Docker (OrbStack) itself is left running.

## Helpers shipped

| File | Purpose |
| --- | --- |
| `scripts/verify-popcorn` | Entry point. Run with no arguments for usage. |
| `scripts/drive.ts`, `scripts/lib/vp.ts` | Journey runner and the `vp` API |
| `scripts/mail-sink.ts` | Fake Resend `POST /emails`. Run by `up`. |
| `scripts/seed.sql` | Baseline users and friendship |
| `scripts/tmdb-stub.ts` | TMDB replay stub and recorder. Run by `up` when `VP_TMDB` is `stub` or `record`. |
| `scripts/run-journeys` | Fresh run, the given journeys, RESULT lines, teardown. Used by CI. |
| `journeys/sign-in.ts`, `journeys/mark-watched.ts` | Proven journeys |

The other feature files list exact steps, but they do not have proven journey scripts yet. Write `journeys/<feature>.ts` modelled on `mark-watched.ts`, run it, and update the feature file.

## Keeping it honest

When routes, labels or flows change, update `features/` and the journeys in the same change. The pstack `/pstack:maintain-verification-skill` command can audit the map against the app.
