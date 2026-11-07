# Popcorn verification map

This directory is the maintained source for verifying the user-facing behavior of Popcorn, the drive-in themed film and TV diary. Read the index before you drive the app, then follow the matching feature file as the recipe. Every command below uses the helper `scripts/verify-popcorn`, written here as `vp` (see `../SKILL.md`).

## Baseline preconditions

- Start a fresh run with `vp up`. It creates a disposable `postgres:17` container, runs migrations, seeds the data, starts the mail sink, and starts the vite dev server on a random port.
- `vp doctor` exits `0`. Never drive an instance that this run did not start, and that includes the user's `bun run dev` on :3000.
- Seeded accounts. Both are already onboarded:
  - `vera@popcorn.test` (@veraverify, "Vera Verify") is the default actor.
  - `felix@popcorn.test` (@felixfriend) is an accepted friend of Vera.
- Seeded content: no watch events, watchlists, or tracked shows. The `My Picks` default watchlist is created lazily on the user's first watchlist action.
- Title data comes from live TMDB through `TMDB_READ_ACCESS_TOKEN`. Use well-known IDs: The Matrix is `movie/603`. Breaking Bad is `tv/1396`.

## Driving conventions

- Navigate with `vp.goto(path)` and call `vp.settled()` after any navigation you trigger. Before hydration, the dev-mode SSR markup silently drops input.
- If `vp.goto` lands on `/login`, call `vp.signIn()`. A session saved by `vp login` is reused across journeys in the same run.
- Prefer aria-labels, placeholders, visible button text, named dialogs and `href`s. The title-page arcade buttons have no accessible name, so find them by their label div (see `mark-watched.md`).
- Scope every dialog by its name. The achievement popup ("Achievement Unlocked") can stack on top of other dialogs.
- Mutations persist for the life of the run. To repeat a journey from the baseline, run `vp down && vp up`.

## Proof and skip reporting

- Run every journey with `vp drive <journey>`. Its evidence goes to `~/.cache/verify-popcorn/evidence/<RUN_ID>/<journey>/` and contains `steps.log`, numbered screenshots with ARIA snapshots, `trace.zip`, `db.log` and `console.log`.
- Capture the user action and the resulting state. Then prove persistence with a reload or a second page, and prove the side effect with `vp.sql`.
- Record the entry point you used in `vp.step(...)`. Never report an entry point as verified when you drove a different one.
- If you cannot reach a path, report the command you tried and the precondition that was not met. Do not weaken the assertion.

## Feature entry contract

Each feature file starts with an H1 and one paragraph describing the behavior the user sees. Four H2s follow, in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-popcorn`, and `Gotchas`. The driving section begins with `Preconditions:` and pairs each user action with an exact handle and an observable result. It also says whether a proven journey script exists.

## Features

- [Sign in](./sign-in.md): magic-link sign-in, the auth guard on `/app`, and the onboarding gate for new users. Journey: `journeys/sign-in.ts` (proven).
- [Mark a film watched](./mark-watched.md): search, then a title page, then Watched, then the review modal, a persisted watch history, and an achievement. Journey: `journeys/mark-watched.ts` (proven).
- [Search](./search.md): title search with filters, empty state and clear. No journey script yet.
- [Watchlists](./watchlists.md): create a watchlist and add a title from the title page. No journey script yet.
- [Series tracker](./tracker.md): track a TV show and mark episodes or seasons. No journey script yet.
- Layout and motion: no sideways scroll or split words at 320, 390 and 1440 on every app route, link and button classes win the cascade, profile tabs work on touch, the search bookmark has a touch path, and nothing moves under reduced motion. Journey: `journeys/layout.ts` (proven, needs a fresh run because it logs the first watch).

Not mapped yet: onboarding steps (username, avatar, taste, favourite, genre, bio), friends and requests, feed, shuffle swiping and matches, recommendations and notifications, profile and achievements pages, settings and blocking, journal entries, and the review-reminder cron (`/api/cron/review-reminders`, guarded by `CRON_SECRET=verify-popcorn-cron` in verify runs).
