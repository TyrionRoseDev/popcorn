# Phase 1, deliverable 1: screen and state inventory

Popcorn's owner wants one coherent, easy-to-use app. This is the map of what exists today: every route, in every state I could drive, at phone and desktop width, with a judgement on each cell.

## What was tested

- **Tree under test:** HEAD `0562c26` plus the owner's uncommitted changes in 10 tracked files. No `src/`, `drizzle/`, `package.json` or other tracked file was changed by this work.
- **Instance:** disposable run `vp-20261106-214908`. Own Postgres container, vite dev server, local mail sink. Production and the `.env` database were not touched. TMDB is the real API.
- **Browser:** headless Chromium, 390x844 and 1440x900, `deviceScaleFactor` 1, `isMobile` false. Touch behaviour at 390 was probed separately where a finding depends on it.
- **Journey:** re-runnable from `.claude/skills/verify-popcorn/journeys/inventory.ts`. See "Re-running this" at the end.
- **Raw data:** `docs/redesign/phase-1/01-inventory.json` holds every cell, so the counts below can be recomputed. `docs/redesign/phase-1/01-inventory-review.tsv` holds my judgements, kept apart from the measurements.

Two uncommitted changes shape what is seen here, and both are visible only because the owner's tree was tested.

- `src/integrations/trpc/routers/watchlist.ts` no longer filters empty watchlists out of the list, so "Empty List" appears on the watchlists page. At HEAD it would be hidden. (measured, from `git diff`)
- `src/components/achievements/achievement-celebration-provider.tsx` adds a 30 second achievement poll, so popups can now arrive at any moment, not only after an action. (measured from the diff. Effect on a real session is inferred.)

## How to read the labels

Every claim is labelled **measured** (seen in a screenshot, DOM reading, DB row or source line), **inferred** (a conclusion from measured facts) or **guess**.

Designed state classes:

| Class | Meaning |
| --- | --- |
| designed | The state was clearly built on purpose, in the drive-in theme, and tells the truth. |
| generic | Works and tells the truth, but is default-looking, or offers no next step, or the truth is hard to read. |
| blank | The user sees nothing useful, and no explanation. |
| broken | The cell misleads or fails. This includes a false state (a server failure shown as "you have nothing"), clipped content, visibly damaged layout, an unreachable action, a stuck loader, and a crash. |
| not applicable | The state cannot exist for this route. Listed so the matrix is complete, and excluded from the reached counts. |
| not reached | I tried and could not capture it. The command and reason are recorded. |

A cell is a route or screen variant, in one state, at one width. The states are `empty`, `first-run`, `populated`, `loading`, `error-500`, `error-tmdb`, `bad-url`, `signed-out` and `overlay`.

How the faults were made:

- **loading:** tRPC held at the browser with Playwright `page.route` until after capture, so the state does not depend on machine speed. Auth was held the same way for the login form.
- **error-500:** every tRPC response replaced with HTTP 500 at the browser. Client navigation was used where SSR would otherwise fill the page, and `title-movie-hard-load` covers the hard load.
- **error-tmdb:** a simulation. TMDB procedures in the batch were rewritten into an invalid call, so the real server returns a real per-entry error, and `image.tmdb.org` was aborted. A true outage would return INTERNAL_SERVER_ERROR, not BAD_REQUEST. The client treats both as errors. SSR loaders cannot be intercepted this way, so title cells use client navigation.

Host load is a caveat on all of it. Load average was 30 to 54 on 10 cores for most of the run, with other agents on the same machine. Per the coordinator's rule, every cell first classed blank, broken or not reached on a possible timing basis was retried once with 10 extra seconds of settle, and the `retried` flag is set on those cells. Loading cells use the injected hold, not natural slowness. Sibling runs also share the working tree, so a vite full reload can hit a page mid-capture. That is inferred from two widths failing in the same second with "Execution context was destroyed". Those cells were re-run.

## The counts

456 cells in total. 432 are real captures or attempts, and 24 are not applicable. All numbers below are **measured** from `01-inventory.json`. The class is my judgement of each screenshot.

| Class | Cells |
| --- | --- |
| designed | 229 |
| generic | 125 |
| blank | 10 |
| broken | 66 |
| not applicable | 24 |
| not reached | 2 |
| **total** | **456** |

| State | Cells | designed | generic | blank | broken | not applicable | not reached |
| --- | --- | --- | --- | --- | --- | --- | --- |
| empty | 42 | 23 | 14 | 0 | 1 | 2 | 2 |
| first-run | 38 | 24 | 8 | 0 | 6 | 0 | 0 |
| populated | 70 | 58 | 7 | 0 | 5 | 0 | 0 |
| loading | 54 | 28 | 10 | 2 | 2 | 12 | 0 |
| error-500 | 52 | 12 | 8 | 4 | 24 | 4 | 0 |
| error-tmdb | 32 | 10 | 7 | 2 | 7 | 6 | 0 |
| bad-url | 38 | 8 | 19 | 2 | 9 | 0 | 0 |
| signed-out | 38 | 5 | 32 | 0 | 1 | 0 | 0 |
| overlay | 92 | 61 | 20 | 0 | 11 | 0 | 0 |

Other measured totals: 30 cells overflow at 390, 117 cells logged console or page errors, 82 cells were retried with a longer wait.

The shape of it (inferred): the happy path is mostly built with care, at 58 of 70 populated cells. The unhappy paths are not. Of the 48 applicable error-500 cells, 12 are designed and 28 are blank or broken.

The 32 generic signed-out cells are mostly one screen, because 28 cells are the same redirect to `/login`.

Retries mattered. 16 retried cells ended as designed, including search results and the unknown profile, which looked stuck on the first pass under load. They would have been false findings. The retry also turned one "whole page is pale and empty" cell into the stuck loader it really is.

### Not reached

| Cell | Command tried | Why |
| --- | --- | --- |
| `empty/watchlists-after-visits@390` | `inventory.ts empty` | `page.screenshot` timed out at 30 seconds under load. Not retried, because the fixture then created Empty List for Vera, so the empty state no longer exists on this run. |
| `empty/watchlists-after-visits@1440` | `inventory.ts empty` | Captured on skeletons under load, so the settled state was not seen. Same reason for no retry. An earlier pass did show the auto-created My Picks. |

Also not retried, because the state was consumed: `empty/profile-self@390` and the first-run broken cells (`onboarding-2-avatar-upload-attempt`, `after-onboarding-first-landing`, `after-onboarding-profile-self`). Their faults are not timing-based. A popup and a parser error were on screen in the capture, and the two widths agree, except `empty/profile-self` where the popup showed only at 390.

## Worst findings, ranked

Ranked by how directly each one breaks trust or blocks the diary. The ranking is my judgement.

1. Server failures are shown as "you have nothing". See [Cross-cutting 1](#x1).
2. On a phone with data, the profile tabs are off-screen and cannot be reached by touch. See [Profile](#profile).
3. There is no way to log a film rewatch, and pressing Watched on a rated film deletes the watched state. See [Title](#title).
4. Achievements are awarded for nothing, cover the first screen after onboarding, and cover the Match and Show Complete moments. See [Achievements](#achievements).
5. Shuffle and Settings crash during SSR on every load, and every hard load of a title page fails hydration. See [Cross-cutting 2](#x2).
6. Onboarding step 3 is a dead end when the genre read fails, and a failed save puts a toast on top of Continue. See [Onboarding](#onboarding).
7. Review flow traps: Save & Done is disabled with no hint, and Skip leaves a film Watched with no history. See [Review](#review).
8. Bad URLs: a missing title returns HTTP 500 with a Retry button, `/does-not-exist` is unstyled, and a film id on the tracker opens a different show. See [Bad URLs](#badurls).
9. Sign-in drops the destination, so shared links lose their target. Signed-in users still see Sign In and the marketing page. See [Sign-in](#signin).
10. At 390, 30 cells overflow sideways, and `overflow-wrap:anywhere` on `body` breaks words including the brand. See [Cross-cutting 3](#x3).

## Findings by route

Screenshot paths are absolute. Source paths are relative to the repo.

### Cross-cutting

<a id="x1"></a>
**1. API failure disguised as empty (measured).** With every tRPC call returning 500, these screens claim the user has no data.

| Screen | What it says | Source | Evidence |
| --- | --- | --- | --- |
| Feed | No activity yet. Add some friends | `src/routes/app/feed.tsx:147` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/feed@390.png` |
| Tracker | No shows tracked yet | `src/routes/app/tracker.index.tsx:373` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker@390.png` |
| Tracker journal | No journal entries yet | `src/routes/app/tracker.index.tsx:582` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-journal@390.png` |
| Tracker detail | Show not found | `src/routes/app/tracker.$tmdbId.tsx:486` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-detail@390.png` |
| Friends | No friends yet | `src/routes/app/friends.tsx:738` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/friends@390.png` |
| Watchlist detail | Watchlist not found, may have been deleted | `src/routes/app/watchlists/$watchlistId.tsx:143` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlist-detail@390.png` |
| Hidden titles | No hidden titles | `src/routes/app/shuffle/hidden.tsx:63` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle-hidden@390.png` |
| Settings | Not set, for genres and film | `src/routes/app/settings.tsx:191`, `:226` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings@390.png` |
| Onboarding favourite search | No results for "Aliens" | `src/components/onboarding/favourite-film-step.tsx:102` | `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-4-favourite-search@390.png` |

- The cause (measured): 30 files under `src/routes` and `src/components` run queries, across 66 query call sites. Only 4 files read `isError`.
- The tracker also fails this way when only TMDB fails, although Vera has four tracked shows: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/tracker@390.png`.
- Watchlists shows no error at any wait. It was blank under the header at 9 seconds and back on skeleton rows at 19 seconds: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlists@390.png`.
- Search rails and the taste step show headings or prompts with nothing under them: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search@390.png`.
- Good examples to copy (measured): the title error with Retry (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie@390.png`), search results with Retry (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search-results@390.png`), and the profile card (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-self@390.png`). There are three different designs for the same message.

<a id="x2"></a>
**2. SSR crashes and hydration failure (measured under vite dev).**

- `sessionStorage is not defined` on `/app/shuffle`, from `src/routes/app/shuffle/index.tsx:32`. 22 page errors.
- `window is not defined` on `/app/settings` and `/app/settings/blocked`, from `heic2any` imported at `src/components/settings/change-avatar-dialog.tsx:2`. 47 page errors. React logs "Switched to client rendering".
- Hydration fails on every hard load of a title page, 28 page errors. SSR renders the page, then the client has no data and renders `TitlePageSkeleton` (`src/routes/app/title.$mediaType.$tmdbId.tsx:71`).
- Cause of the title failure (inferred): the query cache is not carried from server to client. I found no `setupRouterSsrQueryIntegration` in `src`.
- These would also fail in production (inferred). Neither global exists on the server whatever the build, but I tested vite dev only.

<a id="x3"></a>
**3. Phone width damage (measured).**

- 30 cells overflow at 390. `scrollWidth` is 426 on title pages, from the glow at `right: -60px` (`src/components/title/drive-in-screen.tsx:34`). It is 415 on shuffle, from `-inset-10` (`src/components/shuffle/card-stack.tsx:180`). A pale strip shows on the right: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie@390.png`.
- `[overflow-wrap:anywhere]` on `body` (`src/routes/__root.tsx:76`) breaks words where they should wrap or truncate. Seen: POPCOR / N on the landing page (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/landing@390.png`), DIRECT / OR, RUNTIM / E, Wach / owski (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/achievement-popup@390.png`), Invit / e (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-detail@390.png`), TITL / ES and FRIEN / DS (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/friend-block-confirm@390.png`), Documenta / ry (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-favourite-genre@390.png`).
- The inline delete confirm stacks as Dele / te? and Y / e / s: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-delete-confirm@390.png`.

**4. Loading is inconsistent (measured).** Only the title route has a `pendingComponent` (`src/routes/app/title.$mediaType.$tmdbId.tsx:52`). The rest handle it inside the component, in four different ways.

| Treatment | Routes |
| --- | --- |
| Skeleton | watchlists, watchlist detail, search, search results, hidden titles, friends, profile, blocked users, title |
| Single small spinner | feed, tracker, tracker journal, tracker detail |
| Custom | shuffle countdown |
| **No loading state** | **settings**, which shows Not set while data is in flight (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings@390.png`), and **onboarding step 3**, which shows no pills and no spinner (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/onboarding-3-taste@390.png`) |

Landing and login have no server read on load. The watchlist detail skeleton overflows at 390 from `w-96` (`src/routes/app/watchlists/$watchlistId.tsx:112`).

**5. Three error and feedback dialects (measured).** Toasts are plain white sonner cards in a dark theme: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/episode-review-prompt@390.png`. There is no `defaultErrorComponent`, and only search and title set `errorComponent`. No route sets `notFoundComponent`.

<a id="achievements"></a>
**6. Achievements.**

- Awarded for nothing (measured): `joinedCollabWatchlist` only checks `count(watchlistMember) >= 1` (`src/lib/evaluate-achievements.ts:187`). Owning your auto-created My Picks counts, so Shared Popcorn is earned alone. A new user reaches 7 of 45 before logging anything: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-profile-self@390.png`.
- Popups block the moment (measured): the first screen after onboarding is an achievement popup (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-first-landing@390.png`). Dialog names were measured as `Achievement Unlocked` over `Show Complete` (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/completion-celebration-stacked-under-achievement@390.png`) and `Achievement Unlocked` over `Match` (`/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/match-celebration@390.png`).
- On first profile visit at 390, a 4-card popup puts Continue at y=952 in an 844 viewport. It scrolls into reach, so it is off the fold and not a trap. I tested and retracted the trap theory: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/findings/achievement-popup-after-scroll@390.png`.
- Achievement rows dominate the feed, about 13 of 20 populated rows (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed@390.png`.
- The owner's uncommitted 30 second poll means popups can arrive mid-task (inferred from the diff).

### Landing `/`

- 1440 is designed. There is no statement of what the app is above the fold (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/landing@1440.png`.
- 390 breaks the wordmark as POPCOR / N: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/landing@390.png`.
- The ticket reveal is scroll-driven, so these at-rest full-page captures do not show it. I did not exercise it.

<a id="signin"></a>
### Login `/login` and sign-in

- Every protected route redirects to `/login` with no return path (`src/routes/app/route.tsx:33`). `callbackURL` is hard-coded to `/app/search` (`src/routes/login.tsx:31`, `:51`). So a shared title link loses its target (measured from source and `finalUrl`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/public-title-deep-link@390.png`.
- The heading is Welcome Back for first-time visitors too (`src/routes/login.tsx:68`).
- Signed-in users are not redirected from `/login` or `/` (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/login-when-signed-in@390.png`, `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/landing-when-signed-in@390.png`.
- A failed send shows only Something went wrong: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/login-send-failed@390.png`. An invalid email gets native browser validation only.

<a id="onboarding"></a>
### Onboarding `/onboarding`

- Step 3 with a failed read has no pills, no error, and no Skip or Continue, even after 19 seconds on retry. The user is stuck (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste@390.png`.
- A failed taste save puts a white toast directly over Continue, and hovering pauses it. Playwright's click was intercepted for 30 seconds (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste-save-failed@1440.png`.
- That toast prints the raw error message, `signal is aborted without reason`. The exact text comes from my injected empty 500 body. Passing raw messages to users is real (`src/components/onboarding/taste-profile-step.tsx:77`, `src/components/onboarding/bio-step.tsx:30`).
- The avatar step shows a raw token parser error (`src/routes/onboarding/index.tsx:193`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-2-avatar-upload-attempt@390.png`. It depends on the placeholder `UPLOADTHING_TOKEN`, so a real failure may read differently (inferred).
- Username taken reads Username may be taken, a hedge (`src/routes/onboarding/index.tsx:124`).
- Shows picked as loved appear as In Progress at 0 episodes, and My Picks fills silently (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-tracker@390.png`, `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-watchlists@390.png`.

### Search `/app/search`

- Populated and results are designed. The no-results state is two faint lines with no next step: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search-no-results@390.png`.
- A failed read leaves three headings with nothing below (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/search@390.png`.
- `?page=abc` shows a designed message, although the response is HTTP 500: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/search-bad-params@390.png`.

<a id="title"></a>
### Title `/app/title/$mediaType/$id`

- The film page is the most finished screen in the app: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie@1440.png`.
- No film rewatch (measured). Pressing Watched on a rated film toggles it off with only a toast: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-1@390.png`. A second press marks it with no modal: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-2@390.png`. `watch_event` rows stayed at 1 (`src/components/title/title-actions.tsx:166`). History stays visible while Watched is off.
- Editing a review is only reachable by a faint unlabelled ellipsis (`src/components/watched/watch-event-card.tsx:331`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-event-menu@390.png`.
- A hard load during an API failure stays on the skeleton with no error, after 19 seconds on retry: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie-hard-load@390.png`.

<a id="review"></a>
### Review flow

- Save & Done is disabled until a visibility option is chosen, with no default and no hint (`src/components/watched/review-modal.tsx:75`, `:392`). This blocked my own script: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/findings/review-save-disabled-after-companion@1440.png`.
- Skip creates no `watch_event`. Inception shows Watched, has no history, and is left out of counts and the feed (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie-no-review@1440.png`. The only way to review it is to un-watch and watch again.
- Watched With opens a second dialog on top of the review dialog: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-watched-with@390.png`.
- Logging with a companion creates a watch event for the companion, with a null rating, and it shows as "felixfriend logged" (measured): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed@390.png`. Whether that is intended is a product question.

### Shuffle `/app/shuffle`, `/app/shuffle/hidden`

- With TMDB failing or a bad `watchlistId`, the page sits on Loading your next picks with the action buttons live and no error, confirmed on retry (`src/components/shuffle/card-stack.tsx:229`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/shuffle@390.png`, `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/shuffle-other-private@390.png`.
- A 500 shows one faint line and no Retry (`src/routes/app/shuffle/index.tsx:55`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle@390.png`.
- At 1440 the card detail is a mobile bottom sheet pinned to the left edge (`src/components/shuffle/card-detail-modal.tsx:23`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/shuffle-card-detail@1440.png`.

### Watchlists `/app/watchlists`, `/app/watchlists/$id`

- Duplicate My Picks (measured). Two concurrent sessions created 2 rows in the same second. `getOrCreateShuffleWatchlist` is a query that writes (`src/integrations/trpc/routers/shuffle.ts:48`), `getOrCreateDefaultWatchlist` has the same shape (`src/integrations/trpc/routers/watchlist.ts:126`), and there is no unique index: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/findings/race-duplicate-my-picks@390.png`.
- The empty list and empty detail are plain text with no action: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlists@390.png`, `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlist-detail@390.png`.
- Unknown and private list URLs are truthful but have no way back: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/watchlist-other-private@390.png`.

### Feed `/app/feed`

- The empty message says to add friends even when Vera has one (`src/routes/app/feed.tsx:147`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/feed@390.png`.

### Tracker `/app/tracker`, `/app/tracker/$id`

- An untracked show opens as if tracked, at 0 of 62, with no explanation: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker-detail@390.png`.
- The journal entry menu is `opacity-0 group-hover:opacity-100` (`src/components/tracker/journal-entry-card.tsx:193`), so touch users see no trigger (inferred from source, not driven on a touch device).
- At 390 the Add thoughts prompt sits under the toast: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/episode-review-prompt@390.png`.

### Friends `/app/friends`

- Designed in the populated state. The main fault is the false empty above.

<a id="profile"></a>
### Profile `/app/profile/$id`

- At 390 with data, the tab column is 1090px wide on a 390px screen. Recent Activity starts at x=41, Journal at x=404, Watchlists at x=768, inside an `overflow-hidden` card (`src/routes/app/profile.$userId.tsx:279`). A touch swipe does not move it, for self or friend (measured with `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/findings/probe-profile-tabs-swipe.ts`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/findings/profile-tabs-off-screen@390.png`.
- Watch Activity stays empty although Vera has 5 titles logged. 4 of 5 `watch_event` rows have NULL `watched_at`, because the date is optional in the review form (measured from the DB and screenshot): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self@1440.png`. That capture was retaken after the 2024 update, so it also shows See previous years.
- Genre bars and the heatmap are clipped the same way. Cause (inferred): the fixed-width heatmap widens the grid item in the section at `:1339`.
- The previous-years heatmap is cut off in its dialog at 390: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-history-dialog@390.png`.
- Blocked profile (measured). There is no Unblock on the profile, and it says Add friend to see activity with no button (`:977`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked@390.png`.
- The blocked user still sees watch time and counts (`src/integrations/trpc/routers/friend.ts`, "Base profile (always returned)"), although the blocked page says they cannot see the full profile (`src/routes/app/settings/blocked.tsx:71`): `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked-by@390.png`.

### Settings `/app/settings`, `/app/settings/blocked`

- A designed list, but the false Not set covers both loading and error states: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings@390.png`.
- Spelling drifts between Favourite and Favorite in rows and dialogs (`src/routes/app/settings.tsx:176`, `:206`, `src/components/settings/edit-genres-dialog.tsx:79`).
- The blocked users error says Unknown error: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings-blocked@390.png`.

<a id="badurls"></a>
### Bad URLs

- Unknown title, bad media type and a non-numeric id on hard load all return HTTP 500 with Retry, for a page that can never load: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-movie-unknown-id@390.png`. The same URL by client navigation shows the designed 404: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-unknown-client-nav@390.png`.
- `/does-not-exist` is unstyled text on a pale page, with no link: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-root-path@390.png`. `/app/does-not-exist` is a near-invisible Not Found inside the shell: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-app-path@390.png`.
- `/app/tracker/603` opens Veronica's Closet. 603 is The Matrix as a film, and TMDB ids are per media type: `/Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-movie-id@390.png`.

### Dead code

`SeasonPickerModal` (`src/components/watched/season-picker-modal.tsx`) and `ReviewDialog` (`src/components/watchlist/review-dialog.tsx`) are never rendered, so they have no cells (measured by grep for their JSX).

## Data provenance

All populated rows came through the real UI, as real users, using magic links from the mail sink. **No row was inserted by SQL.** SQL was used only for these changes.

| SQL | Why |
| --- | --- |
| Deletes on `earned_achievement`, `notification` and `watchlist` for Vera, twice | Reset after the race exposed by parallel widths |
| Delete of one duplicate Friday Night Horror list | A fixture retry created it |
| Delete of newbie's `earned_achievement` rows | Popup probes. Later cells differ only in achievement counts. |
| `UPDATE` setting `review_reminder_at` into the past for Arrival, then the real cron route | To fire a real reminder notification |
| `UPDATE` moving Arrival's `watched_at` to 2024 | To unlock See previous years, run last |

## Limits of this run

- The tree was run under vite dev, not a production build. HTTP codes and SSR behaviour may differ (guess on how much).
- The 390 run used `isMobile` false. Touch was probed separately for the profile tabs only.
- TMDB failure is a simulation, described under "How the faults were made".
- Error cells use every-call failure. A partial outage was not driven.
- Full-page captures do not show scroll-driven states.
- The full chain from a fresh `vp up` was not proven in one pass. Some phases were repaired piecemeal in this run, and the journey was edited afterwards, so a Phase 3 re-run may hit selector drift.
- I saw `read ECONNRESET` vite overlays on two first-pass cells at 390. Both were dev server artifacts under load, and both were re-run. The overlay is not recorded in `cells.jsonl`, so another could hide in a cell I only saw as a thumbnail.
- The first run of `signed-out` wedged Chromium for 6 minutes, so a 180 second per-cell watchdog was added. `signed-out/landing@1440` hit it once, and its earlier capture and the retry stand.

## Re-running this

From a fresh `verify-popcorn up`, with `VP_RUN_ID` exported, follow the order in the header of `.claude/skills/verify-popcorn/journeys/inventory.ts`. Files:

- `.claude/skills/verify-popcorn/journeys/inventory.ts`, the entry point and groups
- `.claude/skills/verify-popcorn/journeys/inventory-matrix.ts`, the matrix
- `.claude/skills/verify-popcorn/journeys/inventory-lib.ts`, the harness and faults
- `.claude/skills/verify-popcorn/journeys/inventory-fixture.ts`, the populated data
- `.claude/skills/verify-popcorn/journeys/inventory-sheets.ts`, contact sheets
- `.claude/skills/verify-popcorn/journeys/inventory-report.ts`, merges cells and `01-inventory-review.tsv`, and prints the counts

## Matrix

Every cell. `Console errors` counts unique messages. Overflow is recorded at 390 only. `retried.` in the note means the cell shown is the longer-wait retry.

| Route | State | Cell | Width | Designed state | Console errors | Overflow at 390 | Screenshot | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | bad-url | landing-when-signed-in | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/landing-when-signed-in@390.png | retried. A signed-in user sees the marketing page and Get Started. The wordmark breaks as POPCOR / N. |
| / | bad-url | landing-when-signed-in | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/landing-when-signed-in@1440.png | retried. A signed-in user sees the marketing page and Get Started. The wordmark breaks as POPCOR / N at 390. |
| /login | bad-url | login-when-signed-in | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/login-when-signed-in@390.png | A signed-in user sees Sign In. No redirect to the app. |
| /login | bad-url | login-when-signed-in | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/login-when-signed-in@1440.png | A signed-in user sees Sign In. No redirect to the app. |
| /onboarding | bad-url | onboarding-when-complete | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/onboarding-when-complete@390.png | Redirects to Search. |
| /onboarding | bad-url | onboarding-when-complete | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/onboarding-when-complete@1440.png | Redirects to Search. |
| /app/profile/$id | bad-url | profile-unknown | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/profile-unknown@390.png | retried. User not found card with Back to Friends. First pass was still on skeleton. |
| /app/profile/$id | bad-url | profile-unknown | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/profile-unknown@1440.png | retried. User not found card with Back to Friends. First pass was still on skeleton. |
| /app/search | bad-url | search-bad-params | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/search-bad-params@390.png | In-theme message and Reset, although the response is HTTP 500. |
| /app/search | bad-url | search-bad-params | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/search-bad-params@1440.png | In-theme message and Reset, although the response is HTTP 500. |
| /app/shuffle | bad-url | shuffle-other-private | 390 | broken | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/shuffle-other-private@390.png | retried. Stuck on Loading your next picks, no error. First pass was a pale empty page, not seen again on retry, so that part is a load or hydration artifact. |
| /app/shuffle | bad-url | shuffle-other-private | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/shuffle-other-private@1440.png | retried. Stuck on Loading your next picks, no error. First pass was a pale empty page, not seen again on retry, so that part is a load or hydration artifact. |
| /app/shuffle | bad-url | shuffle-unknown-watchlist | 390 | broken | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/shuffle-unknown-watchlist@390.png | retried. Stuck on Loading your next picks with live action buttons and no error. Confirmed on retry. |
| /app/shuffle | bad-url | shuffle-unknown-watchlist | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/shuffle-unknown-watchlist@1440.png | retried. Stuck on Loading your next picks with live action buttons and no error. Confirmed on retry. |
| /app/title/$mediaType/$id | bad-url | title-bad-media-type | 390 | generic | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-bad-media-type@390.png | Same: HTTP 500 and a retry prompt for a malformed URL. |
| /app/title/$mediaType/$id | bad-url | title-bad-media-type | 1440 | generic | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-bad-media-type@1440.png | Same: HTTP 500 and a retry prompt for a malformed URL. |
| /app/title/movie/$id | bad-url | title-movie-non-numeric | 390 | generic | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-movie-non-numeric@390.png | Same: HTTP 500 and a retry prompt for a malformed URL. |
| /app/title/movie/$id | bad-url | title-movie-non-numeric | 1440 | generic | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-movie-non-numeric@1440.png | Same: HTTP 500 and a retry prompt for a malformed URL. |
| /app/title/movie/$id | bad-url | title-movie-unknown-id | 390 | generic | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-movie-unknown-id@390.png | HTTP 500 for a missing title. Message says try again and offers Retry for a page that will never exist. The designed 404 only shows on client nav. |
| /app/title/movie/$id | bad-url | title-movie-unknown-id | 1440 | generic | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-movie-unknown-id@1440.png | HTTP 500 for a missing title. Message says try again and offers Retry for a page that will never exist. The designed 404 only shows on client nav. |
| /app/title/tv/$id | bad-url | title-tv-unknown-id | 390 | generic | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-tv-unknown-id@390.png | Same as the unknown film: HTTP 500 and a retry prompt. |
| /app/title/tv/$id | bad-url | title-tv-unknown-id | 1440 | generic | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-tv-unknown-id@1440.png | Same as the unknown film: HTTP 500 and a retry prompt. |
| /app/title/movie/$id | bad-url | title-unknown-client-nav | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-unknown-client-nav@390.png | Designed 404 with Back to Search. Only reached by client navigation. |
| /app/title/movie/$id | bad-url | title-unknown-client-nav | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/title-unknown-client-nav@1440.png | Designed 404 with Back to Search. Only reached by client navigation. |
| /app/tracker/$id | bad-url | tracker-movie-id | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-movie-id@390.png | retried. A film id opens a different show. /app/tracker/603 is Veronica's Closet because TMDB ids are per media type. Nothing in the URL or page says so. |
| /app/tracker/$id | bad-url | tracker-movie-id | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-movie-id@1440.png | retried. A film id opens a different show. /app/tracker/603 is Veronica's Closet because TMDB ids are per media type. Nothing in the URL or page says so. |
| /app/tracker/$id | bad-url | tracker-non-numeric | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-non-numeric@390.png | retried. Same as the unknown id. First pass was still spinning. |
| /app/tracker/$id | bad-url | tracker-non-numeric | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-non-numeric@1440.png | retried. Same as the unknown id. First pass was still spinning. |
| /app/tracker/$id | bad-url | tracker-unknown-id | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-unknown-id@390.png | retried. Faint Show not found and a small Tracker back link. First pass was still spinning. |
| /app/tracker/$id | bad-url | tracker-unknown-id | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/tracker-unknown-id@1440.png | retried. Faint Show not found and a small Tracker back link. First pass was still spinning. |
| (no route) | bad-url | unknown-app-path | 390 | blank | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-app-path@390.png | retried. Shell and a near-invisible Not Found. No link back. No notFoundComponent is configured. |
| (no route) | bad-url | unknown-app-path | 1440 | blank | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-app-path@1440.png | retried. Shell and a near-invisible Not Found. No link back. No notFoundComponent is configured. |
| (no route) | bad-url | unknown-root-path | 390 | broken | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-root-path@390.png | retried. Unstyled black text Not Found on a pale page. No shell, no link home. No notFoundComponent is configured. |
| (no route) | bad-url | unknown-root-path | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/unknown-root-path@1440.png | retried. Unstyled black text Not Found on a pale page. No shell, no link home. No notFoundComponent is configured. |
| /app/watchlists/$id | bad-url | watchlist-other-private | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/watchlist-other-private@390.png | retried. Two faint lines, no way back. Truthful and does not leak the list. First pass was still on skeleton. |
| /app/watchlists/$id | bad-url | watchlist-other-private | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/watchlist-other-private@1440.png | retried. Two faint lines, no way back. Truthful and does not leak the list. First pass was still on skeleton. |
| /app/watchlists/$id | bad-url | watchlist-unknown | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/watchlist-unknown@390.png | retried. Two faint lines, no way back. First pass was still on skeleton. |
| /app/watchlists/$id | bad-url | watchlist-unknown | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/bad-url/watchlist-unknown@1440.png | retried. Two faint lines, no way back. First pass was still on skeleton. |
| /app/feed | empty | feed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/feed@390.png | Icon and one faint line. It says add some friends although Vera already has one friend (src/routes/app/feed.tsx:147). |
| /app/feed | empty | feed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/feed@1440.png | Icon and one faint line. It says add some friends although Vera already has one friend (src/routes/app/feed.tsx:147). |
| /app/friends | empty | friends | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/friends@390.png |  |
| /app/friends | empty | friends | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/friends@1440.png |  |
| profile-blocked | empty | profile-blocked | 390 | not applicable | 0 | no |  | A block needs two users with a history. Covered in populated. |
| profile-blocked | empty | profile-blocked | 1440 | not applicable | 0 | n/a |  | A block needs two users with a history. Covered in populated. |
| /app/profile/$id (friend) | empty | profile-friend | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-friend@390.png |  |
| /app/profile/$id (friend) | empty | profile-friend | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-friend@1440.png |  |
| /app/profile/$id (self) | empty | profile-self | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-self@390.png | The first visit fires a 4-card popup that covers the empty state. Continue sits at y=952 in an 844 viewport and needs a scroll. Two cards are unearned. |
| /app/profile/$id (self) | empty | profile-self | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-self@1440.png | Empty panels under each heading. The popup did not show in this capture. |
| /app/profile/$id (stranger) | empty | profile-stranger | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-stranger@390.png | Locked panel with Add Friend. |
| /app/profile/$id (stranger) | empty | profile-stranger | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/profile-stranger@1440.png | Locked panel with Add Friend. |
| /app/search | empty | search | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search@390.png | Landing rails do not depend on user data. |
| /app/search | empty | search | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search@1440.png | Landing rails do not depend on user data. |
| /app/search | empty | search-no-results | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search-no-results@390.png | Two lines of faint text and no suggested action. |
| /app/search | empty | search-no-results | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search-no-results@1440.png | Two lines of faint text and no suggested action. |
| /app/search | empty | search-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search-results@390.png | Results do not depend on user data. |
| /app/search | empty | search-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/search-results@1440.png | Results do not depend on user data. |
| /app/settings | empty | settings | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/settings@390.png |  |
| /app/settings | empty | settings | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/settings@1440.png |  |
| /app/settings/blocked | empty | settings-blocked | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/settings-blocked@390.png |  |
| /app/settings/blocked | empty | settings-blocked | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/settings-blocked@1440.png |  |
| /app/shuffle | empty | shuffle | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/shuffle@390.png | Deck renders. Page overflows to 415 from the card glow. |
| /app/shuffle | empty | shuffle | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/shuffle@1440.png | Deck renders. |
| /app/shuffle/hidden | empty | shuffle-hidden | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/shuffle-hidden@390.png | Two lines of faint text. |
| /app/shuffle/hidden | empty | shuffle-hidden | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/shuffle-hidden@1440.png | Two lines of faint text. |
| /app/title/movie/$id | empty | title-movie | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/title-movie@390.png | Designed page. Horizontal overflow to 426 shows a pale strip on the right. |
| /app/title/movie/$id | empty | title-movie | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/title-movie@1440.png |  |
| /app/title/tv/$id | empty | title-tv | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/title-tv@390.png | Designed page. Horizontal overflow to 426 shows a pale strip on the right. |
| /app/title/tv/$id | empty | title-tv | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/title-tv@1440.png |  |
| /app/tracker | empty | tracker | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker@390.png | Icon, copy and Browse TV Shows button. |
| /app/tracker | empty | tracker | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker@1440.png | Icon, copy and Browse TV Shows button. |
| /app/tracker/$id | empty | tracker-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker-detail@390.png | An untracked show opens as if tracked, at 0 of 62, with no explanation or Track action. |
| /app/tracker/$id | empty | tracker-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker-detail@1440.png | An untracked show opens as if tracked, at 0 of 62, with no explanation or Track action. |
| /app/tracker | empty | tracker-journal | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker-journal@390.png | Icon and copy with no action. Copy says visit any show page. |
| /app/tracker | empty | tracker-journal | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/tracker-journal@1440.png | Icon and copy with no action. Copy says visit any show page. |
| /app/watchlists/$id | empty | watchlist-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlist-detail@390.png | Two lines of text and no Add action. The Invite label wraps as Invit / e at 390. |
| /app/watchlists/$id | empty | watchlist-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlist-detail@1440.png | Two lines of text and no Add action. The Invite label wraps as Invit / e at 390. |
| /app/watchlists | empty | watchlists | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlists@390.png | Plain two-line text. The New Watchlist button sits above it, with no link from the message. |
| /app/watchlists | empty | watchlists | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlists@1440.png | Plain two-line text. The New Watchlist button sits above it, with no link from the message. |
| /app/watchlists | empty | watchlists-after-visits | 390 | not reached | 0 | no |  | Screenshot timed out under host load. A retry cannot reproduce it because Empty List was then created. See findings/race-duplicate-my-picks@390.png from the first pass. |
| /app/watchlists | empty | watchlists-after-visits | 1440 | not reached | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/empty/watchlists-after-visits@1440.png | Caught on skeletons under host load, so the settled state was not seen. It cannot be retried, because Empty List was then created. |
| /app/feed | error-500 | feed | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/feed@390.png | retried. False state. A 500 reads as No activity yet, add friends (src/routes/app/feed.tsx:147). |
| /app/feed | error-500 | feed | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/feed@1440.png | retried. False state. A 500 reads as No activity yet, add friends (src/routes/app/feed.tsx:147). |
| /app/friends | error-500 | friends | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/friends@390.png | retried. False state. A 500 reads as No friends yet (src/routes/app/friends.tsx:738). |
| /app/friends | error-500 | friends | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/friends@1440.png | retried. False state. A 500 reads as No friends yet (src/routes/app/friends.tsx:738). |
| landing | error-500 | landing | 390 | not applicable | 0 | no |  | Static page with no server read. |
| landing | error-500 | landing | 1440 | not applicable | 0 | n/a |  | Static page with no server read. |
| /login | error-500 | login-send-failed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/login-send-failed@390.png | In-theme inline error, email kept. Message is the bare Something went wrong, with no next step. |
| /login | error-500 | login-send-failed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/login-send-failed@1440.png | In-theme inline error, email kept. Message is the bare Something went wrong, with no next step. |
| /onboarding | error-500 | onboarding-3-taste | 390 | blank | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste@390.png | retried. No genre pills, no error, no retry, no Skip or Continue, after 19 seconds on retry. A dead end: the step asks for genres that are not on screen. |
| /onboarding | error-500 | onboarding-3-taste | 1440 | blank | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste@1440.png | retried. No genre pills, no error, no retry, no Skip or Continue, after 19 seconds on retry. A dead end: the step asks for genres that are not on screen. |
| /onboarding | error-500 | onboarding-3-taste-save-failed | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste-save-failed@390.png | The white error toast lands on top of Continue and shows raw text, signal is aborted without reason. Playwright could not click Continue for 30 seconds while hovering, because hover pauses the toast. |
| /onboarding | error-500 | onboarding-3-taste-save-failed | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-3-taste-save-failed@1440.png | The white error toast lands on top of Continue and shows raw text, signal is aborted without reason. Playwright could not click Continue for 30 seconds while hovering, because hover pauses the toast. |
| /onboarding | error-500 | onboarding-4-favourite-search | 390 | broken | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-4-favourite-search@390.png | False state. A 500 reads as No results for Aliens. |
| /onboarding | error-500 | onboarding-4-favourite-search | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-4-favourite-search@1440.png | False state. A 500 reads as No results for Aliens. |
| /onboarding | error-500 | onboarding-6-bio-save-failed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-6-bio-save-failed@390.png | Toast with the raw text signal is aborted without reason. The step stays usable. |
| /onboarding | error-500 | onboarding-6-bio-save-failed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/onboarding-6-bio-save-failed@1440.png | Toast with the raw text signal is aborted without reason. The step stays usable. |
| /app/profile/$id (friend) | error-500 | profile-friend | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-friend@390.png | Designed error card, no Retry. |
| /app/profile/$id (friend) | error-500 | profile-friend | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-friend@1440.png | Designed error card, no Retry. |
| /app/profile/$id (self) | error-500 | profile-self | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-self@390.png | Designed error card. The only exit is Back to Friends and there is no Retry, and the same card shows on your own profile. |
| /app/profile/$id (self) | error-500 | profile-self | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-self@1440.png | Designed error card. The only exit is Back to Friends and there is no Retry, and the same card shows on your own profile. |
| /app/profile/$id (stranger) | error-500 | profile-stranger | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-stranger@390.png | Designed error card, no Retry. |
| /app/profile/$id (stranger) | error-500 | profile-stranger | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/profile-stranger@1440.png | Designed error card, no Retry. |
| /app/search | error-500 | search | 390 | blank | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search@390.png | retried. Rails disappear after their skeletons and leave three headings with nothing under them, no error. Confirmed on retry. |
| /app/search | error-500 | search | 1440 | blank | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search@1440.png | retried. Rails disappear after their skeletons and leave three headings with nothing under them, no error. Confirmed on retry. |
| search-no-results | error-500 | search-no-results | 390 | not applicable | 0 | no |  | Same component as error-500/search-results. |
| search-no-results | error-500 | search-no-results | 1440 | not applicable | 0 | n/a |  | Same component as error-500/search-results. |
| /app/search | error-500 | search-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search-results@390.png | retried. Something went wrong and Retry, in place, with filters kept. First pass was still on skeletons, the retry showed the real state. |
| /app/search | error-500 | search-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/search-results@1440.png | retried. Something went wrong and Retry, in place, with filters kept. First pass was still on skeletons, the retry showed the real state. |
| /app/settings | error-500 | settings | 390 | broken | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings@390.png | retried. False state. Taste profile reads Not set although Vera has data, and the edit pencils still work. SSR also throws window is not defined. |
| /app/settings | error-500 | settings | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings@1440.png | retried. False state. Taste profile reads Not set although Vera has data, and the edit pencils still work. SSR also throws window is not defined. |
| /app/settings/blocked | error-500 | settings-blocked | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings-blocked@390.png | In-theme error card but the message is the fallback Unknown error, with no Retry. |
| /app/settings/blocked | error-500 | settings-blocked | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/settings-blocked@1440.png | In-theme error card but the message is the fallback Unknown error, with no Retry. |
| /app/shuffle | error-500 | shuffle | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle@390.png | retried. Faint one-line Unable to load shuffle, no Retry, marquee gone. First pass was still on the countdown. SSR also throws sessionStorage is not defined. |
| /app/shuffle | error-500 | shuffle | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle@1440.png | retried. Faint one-line Unable to load shuffle, no Retry, marquee gone. First pass was still on the countdown. SSR also throws sessionStorage is not defined. |
| /app/shuffle/hidden | error-500 | shuffle-hidden | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle-hidden@390.png | retried. False state. A 500 reads as No hidden titles. First pass was still on skeletons. |
| /app/shuffle/hidden | error-500 | shuffle-hidden | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/shuffle-hidden@1440.png | retried. False state. A 500 reads as No hidden titles. First pass was still on skeletons. |
| /app/title/movie/$id | error-500 | title-movie | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie@390.png | retried. Designed error with Retry and Back to Search on client nav. |
| /app/title/movie/$id | error-500 | title-movie | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie@1440.png | retried. Designed error with Retry and Back to Search on client nav. |
| /app/title/movie/$id | error-500 | title-movie-hard-load | 390 | broken | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie-hard-load@390.png | retried. Stuck on the title skeleton with no error after 19 seconds on retry. The designed error only shows on client navigation. |
| /app/title/movie/$id | error-500 | title-movie-hard-load | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-movie-hard-load@1440.png | retried. Stuck on the title skeleton with no error after 19 seconds on retry. The designed error only shows on client navigation. |
| /app/title/tv/$id | error-500 | title-tv | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-tv@390.png | Designed error with Retry and Back to Search on client nav. |
| /app/title/tv/$id | error-500 | title-tv | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/title-tv@1440.png | Designed error with Retry and Back to Search on client nav. |
| /app/tracker | error-500 | tracker | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker@390.png | retried. False state. A 500 reads as No shows tracked yet (src/routes/app/tracker.index.tsx:373). |
| /app/tracker | error-500 | tracker | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker@1440.png | retried. False state. A 500 reads as No shows tracked yet (src/routes/app/tracker.index.tsx:373). |
| /app/tracker/$id | error-500 | tracker-detail | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-detail@390.png | retried. False state. A 500 reads as Show not found (src/routes/app/tracker.$tmdbId.tsx:486). |
| /app/tracker/$id | error-500 | tracker-detail | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-detail@1440.png | retried. False state. A 500 reads as Show not found (src/routes/app/tracker.$tmdbId.tsx:486). |
| /app/tracker | error-500 | tracker-journal | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-journal@390.png | retried. False state. A 500 reads as No journal entries yet. |
| /app/tracker | error-500 | tracker-journal | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/tracker-journal@1440.png | retried. False state. A 500 reads as No journal entries yet. |
| /app/watchlists/$id | error-500 | watchlist-detail | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlist-detail@390.png | retried. False state. A 500 reads as Watchlist not found, deleted or no access (src/routes/app/watchlists/$watchlistId.tsx:143). |
| /app/watchlists/$id | error-500 | watchlist-detail | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlist-detail@1440.png | retried. False state. A 500 reads as Watchlist not found, deleted or no access (src/routes/app/watchlists/$watchlistId.tsx:143). |
| /app/watchlists | error-500 | watchlists | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlists@390.png | retried. No error at any wait. Blank under the header at 9 seconds, skeleton rows again at 19 seconds on retry. The first-pass capture was blank. |
| /app/watchlists | error-500 | watchlists | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-500/watchlists@1440.png | retried. No error at any wait. Blank under the header at 9 seconds, skeleton rows again at 19 seconds on retry. The first-pass capture was blank. |
| /app/feed | error-tmdb | feed | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/feed@390.png | Feed works from stored data with poster gaps. |
| /app/feed | error-tmdb | feed | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/feed@1440.png | Feed works from stored data with poster gaps. |
| friends | error-tmdb | friends | 390 | not applicable | 0 | no |  | No TMDB read expected. Inferred from the data shown, not measured. |
| friends | error-tmdb | friends | 1440 | not applicable | 0 | n/a |  | No TMDB read expected. Inferred from the data shown, not measured. |
| /onboarding | error-tmdb | onboarding-3-taste | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/onboarding-3-taste@390.png | Pills do not depend on TMDB. Picking genres under failure is covered in the onboarding-faults cells. |
| /onboarding | error-tmdb | onboarding-3-taste | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/onboarding-3-taste@1440.png | Pills do not depend on TMDB. Picking genres under failure is covered in the onboarding-faults cells. |
| /app/profile/$id (self) | error-tmdb | profile-self | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/profile-self@390.png | TMDB failure has no visible effect here, but the tab row is clipped as in populated. |
| /app/profile/$id (self) | error-tmdb | profile-self | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/profile-self@1440.png | Stored data renders, so TMDB failure has no visible effect. Same empty heatmap as populated. |
| /app/search | error-tmdb | search | 390 | blank | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/search@390.png | retried. Three rail headings with nothing under them and no error. Reads as an app with no films. Confirmed on retry. |
| /app/search | error-tmdb | search | 1440 | blank | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/search@1440.png | retried. Three rail headings with nothing under them and no error. Reads as an app with no films. Confirmed on retry. |
| /app/search | error-tmdb | search-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/search-results@390.png | retried. Something went wrong and Retry. First pass 390 lost its page context, 1440 was on skeletons. Retry shows the real state. |
| /app/search | error-tmdb | search-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/search-results@1440.png | retried. Something went wrong and Retry. First pass 390 lost its page context, 1440 was on skeletons. Retry shows the real state. |
| settings | error-tmdb | settings | 390 | not applicable | 0 | no |  | No TMDB read on load. Inferred. |
| settings | error-tmdb | settings | 1440 | not applicable | 0 | n/a |  | No TMDB read on load. Inferred. |
| settings-blocked | error-tmdb | settings-blocked | 390 | not applicable | 0 | no |  | No TMDB read. Inferred. |
| settings-blocked | error-tmdb | settings-blocked | 1440 | not applicable | 0 | n/a |  | No TMDB read. Inferred. |
| /app/shuffle | error-tmdb | shuffle | 390 | broken | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/shuffle@390.png | retried. Stuck on Loading your next picks with the action buttons live and no error, confirmed on retry (src/components/shuffle/card-stack.tsx:229). |
| /app/shuffle | error-tmdb | shuffle | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/shuffle@1440.png | retried. Stuck on Loading your next picks with the action buttons live and no error, confirmed on retry (src/components/shuffle/card-stack.tsx:229). |
| /app/shuffle/hidden | error-tmdb | shuffle-hidden | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/shuffle-hidden@390.png | Tile shows No Poster and Loading for the title forever, Unhide still works. |
| /app/shuffle/hidden | error-tmdb | shuffle-hidden | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/shuffle-hidden@1440.png | Tile shows No Poster and Loading for the title forever, Unhide still works. |
| /app/title/movie/$id | error-tmdb | title-movie | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/title-movie@390.png | retried. Designed error with Retry and Back to Search. First pass was still on skeleton. |
| /app/title/movie/$id | error-tmdb | title-movie | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/title-movie@1440.png | retried. Designed error with Retry and Back to Search. First pass was still on skeleton. |
| /app/title/tv/$id | error-tmdb | title-tv | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/title-tv@390.png | Designed error with Retry and Back to Search. |
| /app/title/tv/$id | error-tmdb | title-tv | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/title-tv@1440.png | Designed error with Retry and Back to Search. |
| /app/tracker | error-tmdb | tracker | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/tracker@390.png | retried. False state. TMDB failure reads as No shows tracked yet while Vera has four shows. |
| /app/tracker | error-tmdb | tracker | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/tracker@1440.png | retried. False state. TMDB failure reads as No shows tracked yet while Vera has four shows. |
| /app/tracker/$id | error-tmdb | tracker-detail | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/tracker-detail@390.png | retried. False state. TMDB failure reads as Show not found. |
| /app/tracker/$id | error-tmdb | tracker-detail | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/tracker-detail@1440.png | retried. False state. TMDB failure reads as Show not found. |
| /app/watchlists/$id | error-tmdb | watchlist-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/watchlist-detail@390.png | Page works and titles show from stored data, posters fall back to flat colour. Invite wraps at 390. |
| /app/watchlists/$id | error-tmdb | watchlist-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/watchlist-detail@1440.png | Page works and titles show from stored data, posters fall back to flat colour. Invite wraps at 390. |
| /app/watchlists | error-tmdb | watchlists | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/watchlists@390.png | Rows and counts render. Poster cells fall back to flat colour with no titles or label. |
| /app/watchlists | error-tmdb | watchlists | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/error-tmdb/watchlists@1440.png | Rows and counts render. Poster cells fall back to flat colour with no titles or label. |
| /app/feed | first-run | after-onboarding-feed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-feed@390.png | The only row is the user's own achievement, with no guidance on what to do next. |
| /app/feed | first-run | after-onboarding-feed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-feed@1440.png | The only row is the user's own achievement, with no guidance on what to do next. |
| /app/search | first-run | after-onboarding-first-landing | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-first-landing@390.png | The first screen after onboarding is covered by a full-screen achievement popup for finishing onboarding. |
| /app/search | first-run | after-onboarding-first-landing | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-first-landing@1440.png | The first screen after onboarding is covered by a full-screen achievement popup for finishing onboarding. |
| /app/friends | first-run | after-onboarding-friends | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-friends@390.png | Icon, heading and guidance. |
| /app/friends | first-run | after-onboarding-friends | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-friends@1440.png | Icon, heading and guidance. |
| /app/profile/$id (self) | first-run | after-onboarding-profile-self | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-profile-self@390.png | A second popup with three more cards, one unearned (Shared Popcorn), 7 of 45 before the user has logged anything. |
| /app/profile/$id (self) | first-run | after-onboarding-profile-self | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-profile-self@1440.png | Same popup as 390. |
| /app/settings | first-run | after-onboarding-settings | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-settings@390.png |  |
| /app/settings | first-run | after-onboarding-settings | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-settings@1440.png |  |
| /app/shuffle | first-run | after-onboarding-shuffle | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-shuffle@390.png | Deck renders. Overflow to 415. |
| /app/shuffle | first-run | after-onboarding-shuffle | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-shuffle@1440.png |  |
| /app/tracker | first-run | after-onboarding-tracker | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-tracker@390.png | Shows picked as loved in onboarding appear as In Progress at 0 episodes, with no explanation. |
| /app/tracker | first-run | after-onboarding-tracker | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-tracker@1440.png | Shows picked as loved in onboarding appear as In Progress at 0 episodes, with no explanation. |
| /app/tracker | first-run | after-onboarding-tracker-journal | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-tracker-journal@390.png | Same as the empty journal. |
| /app/tracker | first-run | after-onboarding-tracker-journal | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-tracker-journal@1440.png | Same as the empty journal. |
| /app/watchlists | first-run | after-onboarding-watchlists | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-watchlists@390.png | My Picks is pre-filled from the taste step, without saying so. |
| /app/watchlists | first-run | after-onboarding-watchlists | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/after-onboarding-watchlists@1440.png | My Picks is pre-filled from the taste step, without saying so. |
| /login | first-run | login-magic-link-sent | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/login-magic-link-sent@390.png |  |
| /login | first-run | login-magic-link-sent | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/login-magic-link-sent@1440.png |  |
| /onboarding | first-run | onboarding-1-username | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-1-username@390.png |  |
| /onboarding | first-run | onboarding-1-username | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-1-username@1440.png |  |
| /onboarding | first-run | onboarding-1-username-taken | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-1-username-taken@390.png | Inline error reads Username may be taken, a hedge. The real cause is a unique constraint. |
| /onboarding | first-run | onboarding-1-username-taken | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-1-username-taken@1440.png | Inline error reads Username may be taken, a hedge. The real cause is a unique constraint. |
| /onboarding | first-run | onboarding-2-avatar | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-2-avatar@390.png |  |
| /onboarding | first-run | onboarding-2-avatar | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-2-avatar@1440.png |  |
| /onboarding | first-run | onboarding-2-avatar-upload-attempt | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-2-avatar-upload-attempt@390.png | A raw token parser error shows to the user and the preview is a blank circle. The placeholder UPLOADTHING_TOKEN causes the failure, so this depends on the test environment, but the raw message path is real (src/routes/onboarding/index.tsx:193). |
| /onboarding | first-run | onboarding-2-avatar-upload-attempt | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-2-avatar-upload-attempt@1440.png | A raw token parser error shows to the user and the preview is a blank circle. The placeholder UPLOADTHING_TOKEN causes the failure, so this depends on the test environment, but the raw message path is real (src/routes/onboarding/index.tsx:193). |
| /onboarding | first-run | onboarding-3-taste | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-3-taste@390.png |  |
| /onboarding | first-run | onboarding-3-taste | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-3-taste@1440.png |  |
| /onboarding | first-run | onboarding-4-favourite | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-4-favourite@390.png |  |
| /onboarding | first-run | onboarding-4-favourite | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-4-favourite@1440.png |  |
| /onboarding | first-run | onboarding-4-favourite-search | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-4-favourite-search@390.png |  |
| /onboarding | first-run | onboarding-4-favourite-search | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-4-favourite-search@1440.png |  |
| /onboarding | first-run | onboarding-5-genre | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-5-genre@390.png |  |
| /onboarding | first-run | onboarding-5-genre | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-5-genre@1440.png |  |
| /onboarding | first-run | onboarding-6-bio | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-6-bio@390.png |  |
| /onboarding | first-run | onboarding-6-bio | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/first-run/onboarding-6-bio@1440.png |  |
| /app/feed | loading | feed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/feed@390.png | A single small spinner. |
| /app/feed | loading | feed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/feed@1440.png | A single small spinner. |
| /app/friends | loading | friends | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/friends@390.png |  |
| /app/friends | loading | friends | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/friends@1440.png |  |
| landing | loading | landing | 390 | not applicable | 0 | no |  | Static page with no server read. |
| landing | loading | landing | 1440 | not applicable | 0 | n/a |  | Static page with no server read. |
| /login | loading | login-submitting | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/login-submitting@390.png | Button reads Sending and is disabled. |
| /login | loading | login-submitting | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/login-submitting@1440.png | Button reads Sending and is disabled. |
| onboarding-1-username | loading | onboarding-1-username | 390 | not applicable | 0 | no |  | No read on this step. Save failure not driven. |
| onboarding-1-username | loading | onboarding-1-username | 1440 | not applicable | 0 | n/a |  | No read on this step. Save failure not driven. |
| onboarding-2-avatar | loading | onboarding-2-avatar | 390 | not applicable | 0 | no |  | No read on this step. The upload attempt is a first-run cell. |
| onboarding-2-avatar | loading | onboarding-2-avatar | 1440 | not applicable | 0 | n/a |  | No read on this step. The upload attempt is a first-run cell. |
| /onboarding | loading | onboarding-3-taste | 390 | blank | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/onboarding-3-taste@390.png | retried. No genre pills and no spinner. It asks the user to pick genres that are not on screen. Same on retry. |
| /onboarding | loading | onboarding-3-taste | 1440 | blank | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/onboarding-3-taste@1440.png | retried. No genre pills and no spinner. It asks the user to pick genres that are not on screen. Same on retry. |
| /onboarding | loading | onboarding-4-favourite-search | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/onboarding-4-favourite-search@390.png | Plain Searching text. |
| /onboarding | loading | onboarding-4-favourite-search | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/onboarding-4-favourite-search@1440.png | Plain Searching text. |
| onboarding-5-genre | loading | onboarding-5-genre | 390 | not applicable | 0 | no |  | No read on this step. |
| onboarding-5-genre | loading | onboarding-5-genre | 1440 | not applicable | 0 | n/a |  | No read on this step. |
| onboarding-6-bio | loading | onboarding-6-bio | 390 | not applicable | 0 | no |  | No read on this step. Save failure is in error-500. |
| onboarding-6-bio | loading | onboarding-6-bio | 1440 | not applicable | 0 | n/a |  | No read on this step. Save failure is in error-500. |
| /app/profile/$id (friend) | loading | profile-friend | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-friend@390.png |  |
| /app/profile/$id (friend) | loading | profile-friend | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-friend@1440.png |  |
| /app/profile/$id (self) | loading | profile-self | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-self@390.png |  |
| /app/profile/$id (self) | loading | profile-self | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-self@1440.png |  |
| /app/profile/$id (stranger) | loading | profile-stranger | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-stranger@390.png |  |
| /app/profile/$id (stranger) | loading | profile-stranger | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/profile-stranger@1440.png |  |
| /app/search | loading | search | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/search@390.png |  |
| /app/search | loading | search | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/search@1440.png |  |
| search-no-results | loading | search-no-results | 390 | not applicable | 0 | no |  | Same component as loading/search-results. |
| search-no-results | loading | search-no-results | 1440 | not applicable | 0 | n/a |  | Same component as loading/search-results. |
| /app/search | loading | search-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/search-results@390.png |  |
| /app/search | loading | search-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/search-results@1440.png |  |
| /app/settings | loading | settings | 390 | broken | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings@390.png | retried. No loading state. Shows Not set for data still in flight, so a false empty. Confirmed on retry. |
| /app/settings | loading | settings | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings@1440.png | retried. No loading state. Shows Not set for data still in flight, so a false empty. Confirmed on retry. |
| /app/settings/blocked | loading | settings-blocked | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings-blocked@390.png |  |
| /app/settings/blocked | loading | settings-blocked | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/settings-blocked@1440.png |  |
| /app/shuffle | loading | shuffle | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/shuffle@390.png |  |
| /app/shuffle | loading | shuffle | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/shuffle@1440.png |  |
| /app/shuffle/hidden | loading | shuffle-hidden | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/shuffle-hidden@390.png |  |
| /app/shuffle/hidden | loading | shuffle-hidden | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/shuffle-hidden@1440.png |  |
| /app/title/movie/$id | loading | title-movie | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/title-movie@390.png |  |
| /app/title/movie/$id | loading | title-movie | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/title-movie@1440.png |  |
| /app/title/tv/$id | loading | title-tv | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/title-tv@390.png |  |
| /app/title/tv/$id | loading | title-tv | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/title-tv@1440.png |  |
| /app/tracker | loading | tracker | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker@390.png | Spinner and Loading shows label. |
| /app/tracker | loading | tracker | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker@1440.png | Spinner and Loading shows label. |
| /app/tracker/$id | loading | tracker-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker-detail@390.png | A single small spinner on an empty page. |
| /app/tracker/$id | loading | tracker-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker-detail@1440.png | A single small spinner on an empty page. |
| /app/tracker | loading | tracker-journal | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker-journal@390.png | Tabs and a spinner. |
| /app/tracker | loading | tracker-journal | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/tracker-journal@1440.png | Tabs and a spinner. |
| /app/watchlists/$id | loading | watchlist-detail | 390 | designed | 0 | yes (400) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/watchlist-detail@390.png | Skeleton. The 384px title bar overflows the page while loading (src/routes/app/watchlists/$watchlistId.tsx:112). |
| /app/watchlists/$id | loading | watchlist-detail | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/watchlist-detail@1440.png |  |
| /app/watchlists | loading | watchlists | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/watchlists@390.png |  |
| /app/watchlists | loading | watchlists | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/loading/watchlists@1440.png |  |
| /app/profile/$id (self) | overlay | achievement-grid | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/achievement-grid@390.png |  |
| /app/profile/$id (self) | overlay | achievement-grid | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/achievement-grid@1440.png |  |
| /app/title/movie/$id | overlay | achievement-popup | 390 | designed | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/achievement-popup@390.png | Curtains, card and Continue. Blocks the page on every award. Adds to the popup load described under Achievements. |
| /app/title/movie/$id | overlay | achievement-popup | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/achievement-popup@1440.png | Curtains, card and Continue. Blocks the page on every award. Adds to the popup load described under Achievements. |
| /app/tracker/$id | overlay | completion-celebration-alone | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/completion-celebration-alone@390.png |  |
| /app/tracker/$id | overlay | completion-celebration-alone | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/completion-celebration-alone@1440.png |  |
| /app/tracker/$id | overlay | completion-celebration-stacked-under-achievement | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/completion-celebration-stacked-under-achievement@390.png | Two full-screen dialogs at once, achievement over Show Complete. Dialogs measured as Achievement Unlocked and Show Complete. The review prompt is hidden until Continue. |
| /app/tracker/$id | overlay | completion-celebration-stacked-under-achievement | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/completion-celebration-stacked-under-achievement@1440.png | Two full-screen dialogs at once, achievement over Show Complete. Dialogs measured as Achievement Unlocked and Show Complete. The review prompt is hidden until Continue. |
| /app/watchlists | overlay | create-watchlist-dialog | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/create-watchlist-dialog@390.png |  |
| /app/watchlists | overlay | create-watchlist-dialog | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/create-watchlist-dialog@1440.png |  |
| /app/tracker/$id | overlay | edit-note-modal | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/edit-note-modal@390.png |  |
| /app/tracker/$id | overlay | edit-note-modal | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/edit-note-modal@1440.png |  |
| /app/tracker/$id | overlay | episode-review-prompt | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/episode-review-prompt@390.png | The Add thoughts prompt sits under the white toast near the bottom edge. |
| /app/tracker/$id | overlay | episode-review-prompt | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/episode-review-prompt@1440.png |  |
| /app/title/movie/$id | overlay | film-rewatch-press-1 | 390 | broken | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-1@390.png | Pressing Watched on a rated film removes it, with only a toast. There is no way to log a rewatch. |
| /app/title/movie/$id | overlay | film-rewatch-press-1 | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-1@1440.png | Pressing Watched on a rated film removes it, with only a toast. There is no way to log a rewatch. |
| /app/title/movie/$id | overlay | film-rewatch-press-2 | 390 | broken | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-2@390.png | Second press marks it watched with no modal, and watch_event rows stay at 1. The rewatch is not recorded. |
| /app/title/movie/$id | overlay | film-rewatch-press-2 | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/film-rewatch-press-2@1440.png | Second press marks it watched with no modal, and watch_event rows stay at 1. The rewatch is not recorded. |
| /app/profile/$id (friend) | overlay | friend-block-confirm | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/friend-block-confirm@390.png | Inline Block? YES NO. Stats below show TITL / ES and FRIEN / DS. |
| /app/profile/$id (friend) | overlay | friend-block-confirm | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/friend-block-confirm@1440.png | Inline Block? YES NO with no statement of what blocking does. |
| /app/title/movie/$id | overlay | hide-confirm | 390 | designed | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/hide-confirm@390.png |  |
| /app/title/movie/$id | overlay | hide-confirm | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/hide-confirm@1440.png |  |
| /app/watchlists/$id | overlay | invite-member-modal | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/invite-member-modal@390.png |  |
| /app/watchlists/$id | overlay | invite-member-modal | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/invite-member-modal@1440.png |  |
| /app/shuffle | overlay | match-celebration | 390 | broken | 0 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/match-celebration@390.png | The Match celebration is covered by an achievement popup. Dialogs measured as Achievement Unlocked and Match. |
| /app/shuffle | overlay | match-celebration | 1440 | broken | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/match-celebration@1440.png | The Match celebration is covered by an achievement popup. Dialogs measured as Achievement Unlocked and Match. |
| (shell) | overlay | mobile-nav-drawer | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/mobile-nav-drawer@390.png |  |
| (shell) | overlay | notifications-popover | 390 | designed | 2 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/notifications-popover@390.png |  |
| (shell) | overlay | notifications-popover | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/notifications-popover@1440.png |  |
| /app/title/movie/$id | overlay | recommend-modal | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/recommend-modal@390.png |  |
| /app/title/movie/$id | overlay | recommend-modal | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/recommend-modal@1440.png |  |
| /app/title/movie/$id | overlay | recommend-modal-felix | 390 | designed | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/recommend-modal-felix@390.png |  |
| /app/title/movie/$id | overlay | recommend-modal-felix | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/recommend-modal-felix@1440.png |  |
| /app/title/movie/$id | overlay | review-modal-edit | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-modal-edit@390.png |  |
| /app/title/movie/$id | overlay | review-modal-edit | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-modal-edit@1440.png |  |
| /app/tracker/$id | overlay | review-modal-show-scope | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-modal-show-scope@390.png | Save and Done stays disabled until a visibility option is picked. No default, no hint (src/components/watched/review-modal.tsx:75, :392). |
| /app/tracker/$id | overlay | review-modal-show-scope | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-modal-show-scope@1440.png | Save and Done stays disabled until a visibility option is picked. No default, no hint (src/components/watched/review-modal.tsx:75, :392). |
| /app/title/movie/$id | overlay | review-watched-with | 390 | generic | 0 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-watched-with@390.png | A second dialog stacked on the review dialog, both titled with the word Watched. At 390 the review form shows behind it. |
| /app/title/movie/$id | overlay | review-watched-with | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/review-watched-with@1440.png | A second dialog stacked on the review dialog, both titled with the word Watched. At 390 the review form shows behind it. |
| /app/tracker/$id | overlay | rewatch-confirm | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/rewatch-confirm@390.png |  |
| /app/tracker/$id | overlay | rewatch-confirm | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/rewatch-confirm@1440.png |  |
| /app/tracker/$id | overlay | rewatch-confirm-partial | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/rewatch-confirm-partial@390.png |  |
| /app/tracker/$id | overlay | rewatch-confirm-partial | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/rewatch-confirm-partial@1440.png |  |
| /app/search | overlay | search-filters | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/search-filters@390.png | Full-height filter drawer. |
| /app/settings | overlay | settings-avatar | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-avatar@390.png | A plain dashed circle. The upload itself cannot complete in this environment because UPLOADTHING_TOKEN is a placeholder. |
| /app/settings | overlay | settings-avatar | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-avatar@1440.png | A plain dashed circle. The upload itself cannot complete in this environment because UPLOADTHING_TOKEN is a placeholder. |
| /app/settings | overlay | settings-bio | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-bio@390.png |  |
| /app/settings | overlay | settings-bio | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-bio@1440.png |  |
| /app/settings | overlay | settings-delete | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-delete@390.png |  |
| /app/settings | overlay | settings-delete | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-delete@1440.png |  |
| /app/settings | overlay | settings-email | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-email@390.png |  |
| /app/settings | overlay | settings-email | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-email@1440.png |  |
| /app/settings | overlay | settings-favourite-film | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-favourite-film@390.png | US spelling, while the rest of the app uses Favourite. Works. |
| /app/settings | overlay | settings-favourite-film | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-favourite-film@1440.png | US spelling, while the rest of the app uses Favourite. Works. |
| /app/settings | overlay | settings-favourite-genre | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-favourite-genre@390.png |  |
| /app/settings | overlay | settings-favourite-genre | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-favourite-genre@1440.png |  |
| /app/settings | overlay | settings-genres | 390 | generic | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-genres@390.png | Shows 0 selected and Favorite Genres in US spelling, while the row outside says Favourite Genres. Works. |
| /app/settings | overlay | settings-genres | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-genres@1440.png | Shows 0 selected and Favorite Genres in US spelling, while the row outside says Favourite Genres. Works. |
| /app/settings | overlay | settings-username | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-username@390.png |  |
| /app/settings | overlay | settings-username | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/settings-username@1440.png |  |
| /app/shuffle | overlay | shuffle-card-detail | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/shuffle-card-detail@390.png |  |
| /app/shuffle | overlay | shuffle-card-detail | 1440 | broken | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/shuffle-card-detail@1440.png | A mobile bottom sheet pinned to the left edge of a desktop screen (src/components/shuffle/card-detail-modal.tsx:23). |
| /app/shuffle | overlay | shuffle-hide-confirm | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/shuffle-hide-confirm@390.png |  |
| /app/shuffle | overlay | shuffle-hide-confirm | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/shuffle-hide-confirm@1440.png |  |
| /app/profile/$id (self) | overlay | star-ratings-dialog | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/star-ratings-dialog@390.png | Lists titles at that rating. |
| /app/profile/$id (self) | overlay | star-ratings-dialog | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/star-ratings-dialog@1440.png | Lists titles at that rating. |
| /app/title/movie/$id | overlay | title-trailer | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/title-trailer@390.png | Plays inside the drive-in screen. |
| /app/title/movie/$id | overlay | title-trailer | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/title-trailer@1440.png | Plays inside the drive-in screen. |
| /app/tracker/$id | overlay | tracker-rewatching | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/tracker-rewatching@390.png | Rewatch state with watch switcher. |
| /app/tracker/$id | overlay | tracker-rewatching | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/tracker-rewatching@1440.png | Rewatch state with watch switcher. |
| (shell) | overlay | user-menu | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/user-menu@390.png |  |
| (shell) | overlay | user-menu | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/user-menu@1440.png |  |
| /app/title/movie/$id | overlay | watch-event-menu | 390 | generic | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-event-menu@390.png | Trigger is an unlabelled, faint ellipsis. This is the only route to edit a review on a title page. |
| /app/title/movie/$id | overlay | watch-event-menu | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-event-menu@1440.png | Trigger is an unlabelled, faint ellipsis. This is the only route to edit a review on a title page. |
| /app/profile/$id (self) | overlay | watch-history-dialog | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-history-dialog@390.png | The 2024 heatmap is cut off at the dialog edge, and the one logged day is out of view. Inner scroll was not measured. Reached only after one row was moved to 2024 by SQL. |
| /app/profile/$id (self) | overlay | watch-history-dialog | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watch-history-dialog@1440.png | Reached only after one row was moved to 2024 by SQL. |
| /app/watchlists/$id | overlay | watchlist-delete-confirm | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-delete-confirm@390.png | Inline confirm is squeezed into the header row, so the text stacks as Dele / te? and Y / e / s. Invite also wraps. |
| /app/watchlists/$id | overlay | watchlist-delete-confirm | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-delete-confirm@1440.png | Inline Delete? Yes No with no statement of what is lost. |
| /app/title/movie/$id | overlay | watchlist-popover | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-popover@390.png |  |
| /app/title/movie/$id | overlay | watchlist-popover | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-popover@1440.png |  |
| /app/title/movie/$id | overlay | watchlist-removal-dialog | 390 | generic | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-removal-dialog@390.png | Works, but three exits sit in one dialog: Select watchlists above, Remove from all, Keep in all. At 390 it opens over the film page with the toast below it. |
| /app/title/movie/$id | overlay | watchlist-removal-dialog | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-removal-dialog@1440.png | Works, but three exits sit in one dialog: Select watchlists above, Remove from all, Keep in all. At 390 it opens over the film page with the toast below it. |
| /app/watchlists/$id | overlay | watchlist-rename | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-rename@390.png | Inline edit with only an underline. No Save or Cancel shown. |
| /app/watchlists/$id | overlay | watchlist-rename | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/watchlist-rename@1440.png | Inline edit with only an underline. No Save or Cancel shown. |
| /app/tracker/$id | overlay | write-about-modal | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-modal@390.png |  |
| /app/tracker/$id | overlay | write-about-modal | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-modal@1440.png |  |
| /app/tracker/$id | overlay | write-about-note-filled | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-note-filled@390.png |  |
| /app/tracker/$id | overlay | write-about-note-filled | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-note-filled@1440.png |  |
| /app/tracker/$id | overlay | write-about-scope | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-scope@390.png |  |
| /app/tracker/$id | overlay | write-about-scope | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-scope@1440.png |  |
| /app/tracker/$id | overlay | write-about-step-2 | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-step-2@390.png |  |
| /app/tracker/$id | overlay | write-about-step-2 | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/overlay/write-about-step-2@1440.png |  |
| /app/feed | populated | feed | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed@390.png |  |
| /app/feed | populated | feed | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed@1440.png |  |
| /app/feed | populated | feed-mine | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed-mine@390.png |  |
| /app/feed | populated | feed-mine | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/feed-mine@1440.png |  |
| /app/friends | populated | friends | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/friends@390.png |  |
| /app/friends | populated | friends | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/friends@1440.png |  |
| /app/profile/$id (blocked) | populated | profile-blocked | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked@390.png | No Unblock action. Still says Add Friend to see activity, with no Add Friend button. |
| /app/profile/$id (blocked) | populated | profile-blocked | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked@1440.png | No Unblock action. Still says Add Friend to see activity, with no Add Friend button. |
| /app/profile/$id (blocked) | populated | profile-blocked-by | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked-by@390.png | Blake sees Vera's watch time and counts, and the same Add Friend prompt with no button. The blocked page says blocked users cannot see the full profile. |
| /app/profile/$id (blocked) | populated | profile-blocked-by | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-blocked-by@1440.png | Blake sees Vera's watch time and counts, and the same Add Friend prompt with no button. The blocked page says blocked users cannot see the full profile. |
| /app/profile/$id (friend) | populated | profile-friend | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-friend@390.png | retried. Same clipped tab row as self. |
| /app/profile/$id (friend) | populated | profile-friend | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-friend@1440.png | retried.  |
| /app/profile/$id (friend) | populated | profile-friend-watchlists | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-friend-watchlists@390.png | retried. Same as self. |
| /app/profile/$id (friend) | populated | profile-friend-watchlists | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-friend-watchlists@1440.png | retried.  |
| /app/profile/$id (stranger) | populated | profile-request-received | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-request-received@390.png |  |
| /app/profile/$id (stranger) | populated | profile-request-received | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-request-received@1440.png |  |
| /app/profile/$id (self) | populated | profile-self | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self@390.png | retried. Journal and Watchlists tabs sit at x=404 and x=768 inside an overflow-hidden card. Genre bars and the heatmap are clipped. |
| /app/profile/$id (self) | populated | profile-self | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self@1440.png | retried. Watch Activity is empty although 5 titles are logged. 4 of 5 watch_event rows have NULL watched_at. Captured after the past-year SQL update, so See previous years shows. |
| /app/profile/$id (self) | populated | profile-self-journal | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self-journal@390.png | retried. Tab sits off-screen. Playwright reached it by scrolling the hidden overflow, which a touch swipe does not do (measured in findings/probe-profile-tabs-swipe.ts). |
| /app/profile/$id (self) | populated | profile-self-journal | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self-journal@1440.png | retried.  |
| /app/profile/$id (self) | populated | profile-self-watchlists | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self-watchlists@390.png | retried. Only reachable by programmatic scroll. The card is left-shifted and the tab panel looks empty. |
| /app/profile/$id (self) | populated | profile-self-watchlists | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-self-watchlists@1440.png | retried.  |
| /app/profile/$id (stranger) | populated | profile-stranger | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-stranger@390.png |  |
| /app/profile/$id (stranger) | populated | profile-stranger | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/profile-stranger@1440.png |  |
| /app/search | populated | search | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search@390.png |  |
| /app/search | populated | search | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search@1440.png |  |
| /app/search | populated | search-no-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search-no-results@390.png |  |
| /app/search | populated | search-no-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search-no-results@1440.png |  |
| /app/search | populated | search-results | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search-results@390.png |  |
| /app/search | populated | search-results | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/search-results@1440.png |  |
| /app/settings | populated | settings | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/settings@390.png |  |
| /app/settings | populated | settings | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/settings@1440.png |  |
| /app/settings/blocked | populated | settings-blocked | 390 | designed | 1 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/settings-blocked@390.png |  |
| /app/settings/blocked | populated | settings-blocked | 1440 | designed | 2 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/settings-blocked@1440.png |  |
| /app/shuffle | populated | shuffle | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle@390.png |  |
| /app/shuffle | populated | shuffle | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle@1440.png |  |
| /app/shuffle | populated | shuffle-group | 390 | designed | 1 | yes (415) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle-group@390.png |  |
| /app/shuffle | populated | shuffle-group | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle-group@1440.png |  |
| /app/shuffle/hidden | populated | shuffle-hidden | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle-hidden@390.png | Poster grid with Unhide. |
| /app/shuffle/hidden | populated | shuffle-hidden | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/shuffle-hidden@1440.png | Poster grid with Unhide. |
| /app/title/movie/$id | populated | title-movie | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie@390.png | Designed. Overflow to 426. |
| /app/title/movie/$id | populated | title-movie | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie@1440.png |  |
| /app/title/movie/$id | populated | title-movie-no-review | 390 | generic | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie-no-review@390.png | Watched is lit, but the page has no history and no way to add a review without un-watching first. |
| /app/title/movie/$id | populated | title-movie-no-review | 1440 | generic | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie-no-review@1440.png | Watched is lit, but the page has no history and no way to add a review without un-watching first. |
| /app/title/movie/$id | populated | title-movie-unwatched | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie-unwatched@390.png |  |
| /app/title/movie/$id | populated | title-movie-unwatched | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-movie-unwatched@1440.png |  |
| /app/title/tv/$id | populated | title-tv | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-tv@390.png |  |
| /app/title/tv/$id | populated | title-tv | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-tv@1440.png |  |
| /app/title/tv/$id | populated | title-tv-finished | 390 | designed | 1 | yes (426) | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-tv-finished@390.png |  |
| /app/title/tv/$id | populated | title-tv-finished | 1440 | designed | 1 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/title-tv-finished@1440.png |  |
| /app/tracker | populated | tracker | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker@390.png |  |
| /app/tracker | populated | tracker | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker@1440.png |  |
| /app/tracker/$id | populated | tracker-detail | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail@390.png |  |
| /app/tracker/$id | populated | tracker-detail | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail@1440.png |  |
| /app/tracker/$id | populated | tracker-detail-finished | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail-finished@390.png |  |
| /app/tracker/$id | populated | tracker-detail-finished | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail-finished@1440.png |  |
| /app/tracker/$id | populated | tracker-detail-rewatching | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail-rewatching@390.png |  |
| /app/tracker/$id | populated | tracker-detail-rewatching | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-detail-rewatching@1440.png |  |
| /app/tracker | populated | tracker-journal | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-journal@390.png |  |
| /app/tracker | populated | tracker-journal | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/tracker-journal@1440.png |  |
| /app/watchlists/$id | populated | watchlist-default | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-default@390.png |  |
| /app/watchlists/$id | populated | watchlist-default | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-default@1440.png |  |
| /app/watchlists/$id | populated | watchlist-detail | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-detail@390.png |  |
| /app/watchlists/$id | populated | watchlist-detail | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-detail@1440.png |  |
| /app/watchlists/$id | populated | watchlist-friend-public | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-friend-public@390.png |  |
| /app/watchlists/$id | populated | watchlist-friend-public | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-friend-public@1440.png |  |
| /app/watchlists/$id | populated | watchlist-shared | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-shared@390.png |  |
| /app/watchlists/$id | populated | watchlist-shared | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlist-shared@1440.png |  |
| /app/watchlists | populated | watchlists | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlists@390.png |  |
| /app/watchlists | populated | watchlists | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/populated/watchlists@1440.png |  |
| / | signed-out | landing | 390 | broken | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/landing@390.png | retried. Brand wordmark breaks as POPCOR / N on the first public screen. Full-page capture at rest, so the scroll-driven ticket reveal is not shown. |
| / | signed-out | landing | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/landing@1440.png | retried. Wordmark and Get Started. Full-page capture at rest, so the scroll-driven ticket reveal is not shown. There is no statement of what the app is above the fold. |
| /login | signed-out | login | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/login@390.png |  |
| /login | signed-out | login | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/login@1440.png |  |
| /login | signed-out | login-invalid-email-blocked | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/login-invalid-email-blocked@390.png | Native browser validation only. Nothing in the theme shows what is wrong. |
| /login | signed-out | login-invalid-email-blocked | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/login-invalid-email-blocked@1440.png | Native browser validation only. Nothing in the theme shows what is wrong. |
| /onboarding | signed-out | onboarding-signed-out | 390 | designed | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/onboarding-signed-out@390.png | Redirects to Sign In. |
| /onboarding | signed-out | onboarding-signed-out | 1440 | designed | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/onboarding-signed-out@1440.png | Redirects to Sign In. |
| /app/title/movie/$id | signed-out | public-title-deep-link | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/public-title-deep-link@390.png | A shared title link goes to Sign In, with no film shown and no sign that the link will be honoured. The page copy is Welcome Back, also to a first-time visitor. |
| /app/title/movie/$id | signed-out | public-title-deep-link | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/public-title-deep-link@1440.png | A shared title link goes to Sign In, with no film shown and no sign that the link will be honoured. The page copy is Welcome Back, also to a first-time visitor. |
| /app/feed | signed-out | redirect-feed | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-feed@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/feed | signed-out | redirect-feed | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-feed@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/friends | signed-out | redirect-friends | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-friends@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/friends | signed-out | redirect-friends | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-friends@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/profile/$id (self) | signed-out | redirect-profile-self | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-profile-self@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/profile/$id (self) | signed-out | redirect-profile-self | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-profile-self@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/search | signed-out | redirect-search | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-search@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/search | signed-out | redirect-search | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-search@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/settings | signed-out | redirect-settings | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-settings@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/settings | signed-out | redirect-settings | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-settings@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/settings/blocked | signed-out | redirect-settings-blocked | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-settings-blocked@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/settings/blocked | signed-out | redirect-settings-blocked | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-settings-blocked@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/shuffle | signed-out | redirect-shuffle | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-shuffle@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/shuffle | signed-out | redirect-shuffle | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-shuffle@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/shuffle/hidden | signed-out | redirect-shuffle-hidden | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-shuffle-hidden@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/shuffle/hidden | signed-out | redirect-shuffle-hidden | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-shuffle-hidden@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/title/movie/$id | signed-out | redirect-title-movie | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-title-movie@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/title/movie/$id | signed-out | redirect-title-movie | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-title-movie@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/title/tv/$id | signed-out | redirect-title-tv | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-title-tv@390.png | retried. Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/title/tv/$id | signed-out | redirect-title-tv | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-title-tv@1440.png | retried. Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/tracker | signed-out | redirect-tracker | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-tracker@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/tracker | signed-out | redirect-tracker | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-tracker@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/tracker/$id | signed-out | redirect-tracker-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-tracker-detail@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/tracker/$id | signed-out | redirect-tracker-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-tracker-detail@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/watchlists/$id | signed-out | redirect-watchlist-detail | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-watchlist-detail@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/watchlists/$id | signed-out | redirect-watchlist-detail | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-watchlist-detail@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/watchlists | signed-out | redirect-watchlists | 390 | generic | 0 | no | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-watchlists@390.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
| /app/watchlists | signed-out | redirect-watchlists | 1440 | generic | 0 | n/a | /Users/tyrion/.cache/verify-popcorn/evidence/vp-20261106-214908/inventory/shots/signed-out/redirect-watchlists@1440.png | Redirects to /login with no return path, so the destination is lost after sign-in. Copy is Welcome Back. |
