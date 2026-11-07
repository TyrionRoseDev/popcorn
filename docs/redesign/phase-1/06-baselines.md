# Phase 1 baselines

Popcorn should become one coherent, easy-to-use app. This report records where it stands today, so the rebuild can prove improvement against numbers. Timing numbers come from a separate quiet-machine run, because the machine was overloaded during the first pass.

**Tree under test.** HEAD `0562c26` plus the owner's uncommitted changes, 2026-11-06. `src/` in the build copy matched the repo exactly (`diff -rq`). Everything browser-driven ran against the production build, served by `bun .output/server/index.mjs` on localhost, with a disposable database. Production was not touched.

## Verdict

**"Lighthouse Accessibility and SEO stay at 100" is not true today.** Only the landing page reaches 100 on both, and on mobile one run in three dropped to 94. The word "stay" should change to "reach".

- **Lighthouse Accessibility.** 82 to 100 across 18 route and preset cells. 5 cells are at 100 (landing and login on both presets, tracker on desktop). The worst is the title page at 82 on both presets. 3 runs each, with one cell varying.
- **Lighthouse SEO.** 91 or 92 everywhere except landing, which is 100. `/login` is the only other public page and it scores 91, because it has no meta description.
- **axe "no serious issues" is also not true today.** Across 128 scenarios there are 122 critical and 432 serious nodes on routes, plus 14 critical and 91 serious inside modals. 2 passes, spread 430 to 434 on serious, none on critical.
- **Passing axe would not prove contrast is fine.** axe could not decide 1,908 further contrast nodes, about 4 times the number it failed. See [Accessibility](#accessibility-axe).
- **Two routes crash during server rendering on every request.** The pages still answer 200, and the only audit hint is a console error on settings. The server log shows the cause. See [Runtime](#runtime).
- **One test fails, and it has failed since April.** 145 of 146 pass. See [Test health](#test-health).

## Metrics and suggested gates

The target column is the owner's to fill. 

| Metric | Today | Runs and spread | Suggested later gate | Target |
| --- | --- | --- | --- | --- |
| axe critical nodes, routes | 122 | 2 passes, no spread | 0 | |
| axe serious nodes, routes | 432 | 2 passes, 430 to 434 | 0 | |
| axe moderate nodes, routes | 933 | 2 passes, no spread | Under 50, after adding `<main>` | |
| axe critical nodes, modals | 14 | 2 passes, no spread | 0 | |
| axe serious nodes, modals | 91 | 2 passes, 90 to 91 | 0 | |
| axe contrast nodes needing review | 1,908 | 1 pass counted | Falling, with a manual contrast check on key screens | |
| Lighthouse Accessibility, lowest cell | 82 | 3 runs, no spread on that cell | At least 95 on all, 100 on public pages | |
| Lighthouse Accessibility, cells at 100 | 5 of 18 | 3 runs, landing mobile 94 to 100 | 18 of 18 | |
| Lighthouse SEO, public pages | `/` 100, `/login` 91 | 3 runs, no spread | 100 on public pages only | |
| Lighthouse SEO, signed-in pages | 91 to 92 | 3 runs, one run at 82 | No gate, these pages are behind login | |
| Lighthouse Best Practices, lowest median | 96 | 3 runs, one run at 93 | 100 | |
| Lighthouse Performance, all cells | Mobile 52 to 59 as served, desktop 69 to 88 | See quiet-machine results | Compare the same column | |
| Client JS total | 2,947,749 B raw, 845,505 B gzip | Deterministic, 1 build | Under 450 KB gzip | |
| Client CSS total | 233,581 B raw, 34,385 B gzip | Deterministic, 1 build | No increase | |
| Entry JS, `/` | 807,917 B raw, 252,647 B gzip | Deterministic, 1 build | Under 200 KB gzip | |
| Entry JS, `/app/settings` | 2,318,395 B raw, 642,856 B gzip | Deterministic, 1 build | Under 350 KB gzip | |
| Dev tools or recharts in client JS | None | Two methods agree | Stays none | |
| First-load requests, title page | 62 | 3 runs, no spread | Report only | |
| tRPC procedure calls, search landing | 25 | 3 runs, 23 to 25 | Report only | |
| Server response times | Cold title 466.1 ms, slowest tRPC 200.1 ms | See quiet-machine results | Compare the same measure | |
| Routes throwing during SSR | 2 route trees, 3 paths | Every request in the log | 0 | |
| Hydration errors on first load | 4 of 14 routes | 3 runs | 0 | |
| Files over 500 lines | 19 | Deterministic | Under 8 | |
| Largest file | 1,944 lines | Deterministic | Under 600 | |
| tRPC procedures | 113, of which 2 are template `todos` | Runtime count | Report only | |
| Tables | 21 | Deterministic | Report only | |
| `any` in `src`, TODO or FIXME | 0 and 0 | AST and grep agree | Stays 0 | |
| tsc errors, biome diagnostics | 0 and 0 | 238 and 240 files checked | Stays 0 | |
| Tests passing | 145 of 146 | 6 runs, same failure | All pass | |
| Routers with no test | 11 of 15 | Import scan | Report only, or 5 or fewer | |
| End-to-end test in CI | None | Read from `ci.yml` | At least sign-in and mark-watched | |
| Mark-watched control has a name | No, axe and ARIA agree | 3 sessions | Named | |
| Focus returns after closing Review | No, falls to `body` | 3 sessions | Returns to trigger | |
| Skip link, `<main>` landmark | Neither on any of 4 routes checked | 3 sessions | Both present | |
| Sideways scroll at 390 px | Movie title page, 36 px | 1 run of final probe | 0 | |
| Screens scrolling sideways at 320 px | 5 of 9 | 1 run of final probe | 0 | |
| Infinite animations under reduced motion | 0 on all 9 screens | 2 runs | Stays 0 | |

## Quiet-machine timing results

These are baselines. The run on 2026-11-07 produced 510 samples, all clean, with 1-minute load between 1.64 and 3.67 on 10 cores. Each Lighthouse cell has 5 runs, and server fetches have 20 per route. Everything ran on localhost against a production build, a small seeded DB and a mobile or desktop Lighthouse preset. Treat these as comparison points for before and after, not as what production users experience.

Lighthouse Performance, median with range. FCP and LCP are medians in milliseconds.

| Route | Desktop | Mobile as served | Mobile FCP | Mobile LCP | Mobile with gzip | Mobile, TMDB images blocked |
| --- | --- | --- | ---: | ---: | --- | --- |
| Landing | 88 (86 to 89) | 59 (59 to 59) | 7,202 | 7,202 | 90 (89 to 90) | 59 (59 to 59) |
| Login | 87 (87 to 91) | 59 (59 to 59) | 7,202 | 7,202 | Not run | Not run |
| Feed | 81 (80 to 81) | 57 (57 to 57) | 9,002 | 9,002 | 80 (80 to 80) | 57 (57 to 57) |
| Search | 82 (81 to 82) | 57 (57 to 57) | 8,553 | 10,683 | Not run | Not run |
| Title (film) | 77 (76 to 77) | 52 (45 to 53) | 9,602 | 9,677 | 61 (59 to 62) | 45 (45 to 52) |
| Tracker | 82 (81 to 82) | 57 (57 to 57) | 8,402 | 8,402 | Not run | Not run |
| Watchlists | 81 (80 to 81) | 58 (58 to 58) | 8,102 | 8,102 | Not run | Not run |
| Profile (self) | 79 (79 to 80) | 56 (56 to 56) | 9,452 | 9,452 | Not run | Not run |
| Settings | 69 (69 to 70) | 55 (55 to 55) | 15,201 | 15,374 | Not run | Not run |

What limits these numbers:

- **Transfer size limits mobile.** The local Bun server sends text uncompressed. Adding a gzip proxy lifts Landing by 31 points and Feed by 23, and FCP falls by about 60%. Total blocking time stays near 7 ms, so CPU is not the limit.
- **Whether production compresses is unknown.** If it does, the gzip column is the realistic one. Compare the same column before and after.
- **TMDB images are not the limit.** Blocking them leaves Landing and Feed unchanged. The Title page gets worse (52 to 45) because CLS rises from 0.115 to 0.229, which points to images with no reserved space (inferred).
- **Settings is slowest** because its entry JS is 643 KB gzip, and `heic2any` is 46% of all client JS.
- **Zero spread is not perfect repeatability.** Lighthouse simulates throttling, so identical inputs give identical scores. The spread shows only that the bytes did not change.

Server and data timing:

| Measure | Value |
| --- | --- |
| Document first byte, all routes | 1 to 6 ms median, 20 runs per route |
| Cold title page first byte | 466.1 ms (356.0 to 554.8), 10 runs |
| Direct TMDB call | 41.6 ms (29.1 to 160.6), 10 runs |
| Slowest tRPC call, Tracker show | 200.1 ms (88.1 to 280.6), 5 runs |
| Slowest tRPC call, Tracker | 190.1 ms (147.8 to 274.4), 5 runs |
| Slowest tRPC call, Title (film) | 150.5 ms (87.7 to 184.1), 5 runs |
| tRPC procedure calls on Search | 23 on first load, the most of any route |

Document first byte says little here. Every sample returned 200 at the right path, but the server sends a small document and the data arrives through tRPC, so these times measure a shell on localhost with a small DB. Use the slowest tRPC call and the cold title time as the comparison points.

Regenerate with these commands, from the repo root, when `uptime` shows the 1-minute load well under the core count.

```bash
VP=.claude/skills/verify-popcorn/scripts/verify-popcorn
export VP_RUN_ID=vp-timing-$(date +%Y%m%d-%H%M%S)
$VP up && $VP doctor
BASELINE_LH_RUNS=5 BASELINE_RUNTIME_RUNS=5 docs/redesign/phase-1/tools/baselines.sh timing
docs/redesign/phase-1/tools/baselines.sh tables
$VP down
```

**Excluding contaminated samples.** `timingSamples` in `06-baselines.json` has one row per sample with `load1Before`, `load5Before`, `load1After`, `load5After`, `ncpu` and `status`. A sample is `PROVISIONAL` when the 1-minute load exceeded `ncpu` before or after it. Comparisons should filter to `status == "BASELINE"`. The rows now in the file are from the overloaded period, so treat them as a record of the load and nothing else.

**What will limit these numbers, once measured.** Lighthouse uses simulated throttling. Mobile is 150 ms RTT, 1,638.4 Kbps and 4x CPU slowdown. Desktop is 40 ms RTT, 10,240 Kbps and no CPU slowdown. It ran on localhost over HTTP/1.1 against a Bun server that sends no `Content-Encoding`, so all JS is scored at raw size, 779 KB for `main` alone. Whether production compresses behind its proxy was not measured, so the `gzip` variant bounds the effect. TMDB images and Google Fonts come from the real network and vary run to run. The server's query client is a module-level singleton (`getContext` in `root-provider.tsx`, read from source), so a title page is cold only once per server process. That is why the run measures unvisited title ids separately.

## Regenerating everything

```bash
export VP_RUN_ID=<live run>
docs/redesign/phase-1/tools/baselines.sh all      # every section, then merge
docs/redesign/phase-1/tools/baselines.sh tables   # markdown tables from the JSON
```

Each stage also runs alone, using the subcommands below. `all` has not been run as one command, though every stage it calls has. Run `prod-up` and `seed` first when running a browser stage alone. Tools install in `~/.cache/verify-popcorn/baseline-tools`, not in the repo. Screenshots and raw Lighthouse JSON stay in `~/.cache/verify-popcorn/evidence/<run>/baselines/`.

| Numbers | Subcommand | Run count here |
| --- | --- | --- |
| Accounts and sample data | `seed` | 1 |
| Build, bundle attribution, code shape | `build`, `build-map`, `static` | 1, deterministic |
| Tests | `tests` | 3, twice |
| axe, including modals | `axe` (`BASELINE_AXE_PASSES`, default 3) | 2 |
| Lighthouse Accessibility, SEO, Best Practices | `lighthouse quality` | 3 |
| Lighthouse Performance and variants | `lighthouse perf` | Quiet-machine run, 5 runs per cell |
| Request counts, server times | `runtime` | 3 (default 5) |
| Keyboard | `keyboard` | 3 sessions |
| Reduced motion, zoom, colour scheme | `motion` | 2 for motion, 1 for final zoom probe |

axe ran 2 passes rather than the default 3 to hand back sooner on the loaded machine.

**Accounts.** Signed out. `erin` is signed in and empty. `vera` is lightly populated, with 5 watch events, a shared watchlist of 3 titles, a tracked show, a journal entry and a recommendation, created through real tRPC calls. `nora` is a new user at onboarding. `mia` is reset between flows to reach first-watch modals. All sign-ins use the real magic-link form.

## Accessibility (axe)

axe-core 4.11.0, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice`. `wcag21a` and `wcag22aa` are additions to the brief. 68 route scenarios and 60 modal scenarios per pass at 390x844 and 1440x900, 0 skipped, 0 retries. Counts are nodes summed over scenarios, so a defect in the shared header counts once per screen. The distinct-selector column corrects for that. Modal scans are scoped to the modal itself.

| Scope | critical | serious | moderate | minor |
| --- | --- | --- | --- | --- |
| routes | 122 | 432 (430 to 434) | 933 | 0 |
| modals | 14 | 91 (90 to 91) | 0 | 0 |

Routes by tag:

| Tag | critical | serious | moderate | minor |
| --- | --- | --- | --- | --- |
| wcag2a | 122 | 10 | 0 | 0 |
| wcag2aa | 0 | 422 (420 to 424) | 0 | 0 |
| wcag21a | 0 | 0 | 0 | 0 |
| wcag21aa | 0 | 0 | 0 | 0 |
| wcag22aa | 0 | 0 | 0 | 0 |
| best-practice | 0 | 0 | 933 | 0 |

Modals by tag:

| Tag | critical | serious | moderate | minor |
| --- | --- | --- | --- | --- |
| wcag2a | 14 | 2 | 0 | 0 |
| wcag2aa | 0 | 79 (78 to 79) | 0 | 0 |
| wcag21a | 0 | 0 | 0 | 0 |
| wcag21aa | 0 | 0 | 0 | 0 |
| wcag22aa | 0 | 2 | 0 | 0 |
| best-practice | 0 | 8 | 0 | 0 |

Rules, with the worst first:

| Rule | Impact | Nodes | Scenarios | Distinct selectors | Example |
| --- | --- | --- | --- | --- | --- |
| button-name | critical | 116 | 59 | 21 | `.left-4` |
| select-name | critical | 10 | 10 | 1 | `select` |
| aria-allowed-attr | critical | 8 | 8 | 1 | `div[aria-controls="radix-_r_2_"]` |
| label | critical | 2 | 2 | 1 | `input` |
| color-contrast | serious | 503 | 73 | 203 | `a[href="/app/title/movie/1423191"] > .group.bg-cream\/\[0\.0` |
| scrollable-region-focusable | serious | 11 | 11 | 3 | `.gap-7` |
| aria-dialog-name | serious | 8 | 8 | 3 | `#radix-_r_2_` |
| target-size | serious | 2 | 2 | 1 | `.p-0\.5` |
| aria-prohibited-attr | serious | 1 | 1 | 1 | `.sm\:pl-2\.5` |
| region | moderate | 855 | 68 | 258 | `.py-20` |
| landmark-one-main | moderate | 68 | 68 | 1 | `html` |
| page-has-heading-one | moderate | 8 | 8 | 1 | `html` |
| heading-order | moderate | 2 | 2 | 1 | `.no-underline[href="/app/title/tv/1396"] > h3` |

**What drives the numbers.**

- `color-contrast` is nearly all of the serious count. The cause is low-opacity cream text. Computed against the `#050508` background, `text-cream/30` is 2.52:1, `/40` is 3.69:1, `/45` is 4.43:1 and `/50` is 5.27:1, against a 4.5:1 requirement. So every step at `/45` or below fails for body text. Those tokens appear 351 times in `src` (`text-cream/15` to `/45`, counted by grep, some on large text or decoration).
- `button-name` comes from a few shared controls. The mobile menu button and the arcade buttons have no name. The notification bell has none either, which is why empty accounts count one more than populated ones. With unread items, the badge text gives it the accidental name "1" (inferred from the count difference and `notification-bell.tsx`).
- `region` and `landmark-one-main` come from one cause. No live page has a `<main>`. The only `<main>` in `src` is in the unused `ui/sidebar.tsx`. Adding one should clear most of the 923 nodes from these two rules (estimate).
- `aria-allowed-attr` is the Radix popover trigger on the title page, which is applied to a plain `div`.

**The needs-review count matters.** axe reports these as neither pass nor fail.

| Rule | Nodes | Scenarios | Reasons |
| --- | --- | --- | --- |
| color-contrast | 1908 | 103 | bgGradient 1083, shortTextContent 262, bgOverlap 194, bgImage 125 |
| aria-valid-attr-value | 219 | 78 | aria-valid-attr-value 219 |
| aria-prohibited-attr | 1 | 1 | aria-prohibited-attr 1 |

`bgGradient` dominates because the theme paints text over gradients. Reaching "axe reports no serious issues" therefore does not establish that contrast passes. The done criterion needs a manual contrast check alongside it.

Per screen, as critical/serious/moderate medians:

| Screen | signed-out mobile | signed-out desktop | newbie mobile | newbie desktop | empty mobile | empty desktop | populated mobile | populated desktop | modal mobile | modal desktop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| landing | 0/0/4 | 0/0/4 |  |  |  |  |  |  |  |  |
| login | 0/0/7 | 0/0/7 |  |  |  |  |  |  |  |  |
| not-found | 0/0/3 | 0/0/3 |  |  |  |  |  |  |  |  |
| onboarding |  |  | 0/0/6 | 0/0/6 |  |  |  |  |  |  |
| feed |  |  |  |  | 3/0/5 | 2/0/5 | 7/0/35 | 6/0/35 |  |  |
| search |  |  |  |  | 2/52.5/60 | 1/52.5/60 | 1/52.5/60 | 0/52.5/60 |  |  |
| search-results |  |  |  |  |  |  | 2/44/64 | 1/68/65 |  |  |
| title-movie |  |  |  |  | 6/2/14 | 5/2/14 | 7/3/18 | 6/3/18 |  |  |
| title-tv |  |  |  |  | 6/2/15 | 5/2/15 | 5/2/15 | 4/2/15 |  |  |
| tracker |  |  |  |  | 2/0/6 | 1/0/6 | 1/0/8 | 0/0/8 |  |  |
| tracker-show |  |  |  |  | 3/4/6 | 2/4/6 | 4/6/9 | 3/6/9 |  |  |
| watchlists |  |  |  |  | 2/1/4 | 1/1/4 | 1/1/4 | 0/1/4 |  |  |
| watchlist-detail |  |  |  |  | 2/0/8 | 1/0/8 | 1/1/17 | 0/0/17 |  |  |
| shuffle |  |  |  |  | 2/0/9 | 1/0/9 | 1/0/9 | 0/0/9 |  |  |
| shuffle-hidden |  |  |  |  | 2/0/2 | 1/0/2 | 1/0/2 | 0/0/2 |  |  |
| friends |  |  |  |  | 2/0/6 | 1/0/6 | 1/0/5 | 0/0/5 |  |  |
| profile-self |  |  |  |  | 2/1/10 | 1/0/10 | 3/0/14 | 2/0/14 |  |  |
| profile-friend |  |  |  |  |  |  | 1/0/15 | 0/0/15 |  |  |
| settings |  |  |  |  | 2/15/7 | 1/15/7 | 1/14/7 | 0/14/7 |  |  |
| settings-blocked |  |  |  |  | 2/2/6 | 1/2/6 | 1/2/6 | 0/2/6 |  |  |
| modal:review |  |  |  |  |  |  |  |  | 0/1/0 | 0/0/0 |
| modal:watched-with |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:achievement-popup |  |  |  |  |  |  |  |  | 0/0/0 | 0/0/0 |
| modal:add-to-watchlist-popover |  |  |  |  |  |  |  |  | 0/2/0 | 0/2/0 |
| modal:create-watchlist |  |  |  |  |  |  |  |  | 0/1.5/0 | 0/3/0 |
| modal:recommend |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:hide-confirm |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:watchlist-removal |  |  |  |  |  |  |  |  | 1/1/0 | 1/1/0 |
| modal:watchlist-invite |  |  |  |  |  |  | 0/1/0 | 0/1/0 |  |  |
| modal:notifications-popover |  |  |  |  |  |  | 1/6/0 | 1/6/0 |  |  |
| modal:user-menu |  |  |  |  |  |  |  |  | 0/0/0 | 0/0/0 |
| modal:nav-drawer |  |  |  |  |  |  |  |  | 0/0/0 |  |
| modal:search-filters-sheet |  |  |  |  |  |  |  |  | 0/23/0 |  |
| modal:settings-avatar |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:settings-username |  |  |  |  |  |  |  |  | 1/1/0 | 1/1/0 |
| modal:settings-email |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:settings-genres |  |  |  |  |  |  |  |  | 0/1/0 | 0/0/0 |
| modal:settings-favourite-film |  |  |  |  |  |  |  |  | 0/1/0 | 0/1/0 |
| modal:settings-favourite-genre |  |  |  |  |  |  |  |  | 0/1/0 | 0/0/0 |
| modal:settings-bio |  |  |  |  |  |  |  |  | 0/2/0 | 0/2/0 |
| modal:settings-delete-account |  |  |  |  |  |  |  |  | 0/0/0 | 0/0/0 |
| modal:profile-achievements |  |  |  |  |  |  | 1/4/0 | 1/4/0 |  |  |
| modal:profile-watch-history |  |  |  |  |  |  | 0/0/0 | 0/0/0 |  |  |
| modal:profile-star-ratings |  |  |  |  |  |  | 0/0/0 | 0/0/0 |  |  |
| modal:watch-event-menu |  |  |  |  |  |  | 0/2/0 | 0/2/0 |  |  |
| modal:tracker-write-about |  |  |  |  |  |  | 1/1/0 | 1/1/0 |  |  |
| modal:tracker-rewatch-confirm |  |  |  |  |  |  | 0/0/0 | 0/0/0 |  |  |
| modal:tracker-journal-menu |  |  |  |  |  |  | 0/2/0 | 0/2/0 |  |  |
| modal:tracker-edit-note |  |  |  |  |  |  | 2/1/0 | 2/1/0 |  |  |
| modal:tracker-completion |  |  |  |  |  |  |  |  | 0/0/0 | 0/0/0 |
| modal:shuffle-card-detail |  |  |  |  |  |  | 0/1/0 | 0/1/0 |  |  |

**Unnamed controls by route** (axe `button-name` and `select-name`, pass 1). Screens not listed have none.

| Route | empty mobile | empty desktop | populated mobile | populated desktop |
| --- | --- | --- | --- | --- |
| feed | button-name 2, select-name 1 | button-name 1, select-name 1 | button-name 6, select-name 1 | button-name 5, select-name 1 |
| search | button-name 2 | button-name 1 | button-name 1 | 0 |
| search-results | 0 | 0 | button-name 1, select-name 1 | select-name 1 |
| title-movie | button-name 5 | button-name 4 | button-name 6 | button-name 5 |
| title-tv | button-name 5 | button-name 4 | button-name 4 | button-name 3 |
| tracker | button-name 2 | button-name 1 | button-name 1 | 0 |
| tracker-show | button-name 2, select-name 1 | button-name 1, select-name 1 | button-name 3, select-name 1 | button-name 2, select-name 1 |
| watchlists | button-name 2 | button-name 1 | button-name 1 | 0 |
| watchlist-detail | button-name 2 | button-name 1 | button-name 1 | 0 |
| shuffle | button-name 2 | button-name 1 | button-name 1 | 0 |
| shuffle-hidden | button-name 2 | button-name 1 | button-name 1 | 0 |
| friends | button-name 2 | button-name 1 | button-name 1 | 0 |
| profile-self | button-name 2 | button-name 1 | button-name 3 | button-name 2 |
| profile-friend | 0 | 0 | button-name 1 | 0 |
| settings | button-name 2 | button-name 1 | button-name 1 | 0 |
| settings-blocked | button-name 2 | button-name 1 | button-name 1 | 0 |

| Modal | Unnamed, same at both viewports |
| --- | --- |
| add-to-watchlist-popover | aria-dialog-name 1 |
| watchlist-removal | button-name 1 |
| notifications-popover | aria-dialog-name 1, button-name 1 |
| settings-username | label 1 |
| profile-achievements | button-name 1 |
| watch-event-menu | aria-dialog-name 1 |
| tracker-write-about | button-name 1 |
| tracker-journal-menu | aria-dialog-name 1 |
| tracker-edit-note | button-name 2 |

**Modals.** 30 modal types opened. In `tracker-rewatch-confirm` and `tracker-completion`, focus did not move into the dialog, in every run. 4 types were not reached, listed under [Not measured](#not-measured).

**Colour scheme.** Counts did not change between light and dark `prefers-color-scheme` on landing, login, feed and title (1 run). The theme appears dark in both (inferred from equal counts and screenshots).

## Lighthouse quality

Lighthouse 12.8.2 on Chrome headless shell 156, one fresh browser profile per run, so the cache is cold. Signed-in runs inject the session cookie. All 54 runs were valid, with none retried, and every run landed on the intended page. Scores do not depend on machine speed, and the spread confirms it. Load was high during these runs.

| Route | Preset | Valid runs | Accessibility | SEO | Best Practices |
| --- | --- | --- | --- | --- | --- |
| landing | mobile | 3/3 | 100 (94 to 100) | 100 | 96 |
| login | mobile | 3/3 | 100 | 91 | 100 |
| feed | mobile | 3/3 | 88 | 91 | 96 |
| search | mobile | 3/3 | 89 | 92 | 100 |
| title-movie | mobile | 3/3 | 82 | 92 | 96 |
| tracker | mobile | 3/3 | 93 | 92 | 96 |
| watchlists | mobile | 3/3 | 88 | 92 | 100 |
| profile-self | mobile | 3/3 | 93 | 91 (82 to 91) | 96 (93 to 96) |
| settings | mobile | 3/3 | 87 | 91 | 96 |
| landing | desktop | 3/3 | 100 | 100 | 100 |
| login | desktop | 3/3 | 100 | 91 | 100 |
| feed | desktop | 3/3 | 88 | 91 | 100 |
| search | desktop | 3/3 | 95 | 92 | 100 |
| title-movie | desktop | 3/3 | 82 | 92 | 96 |
| tracker | desktop | 3/3 | 100 | 92 | 100 |
| watchlists | desktop | 3/3 | 95 | 92 | 100 |
| profile-self | desktop | 3/3 | 94 | 91 | 100 |
| settings | desktop | 3/3 | 95 | 91 | 96 |

Failing audits, with cells out of 18:

| Category | Audit | Weight | Cells failing | Where |
| --- | --- | --- | --- | --- |
| accessibility | button-name | 10 | 10 | feed, search, title-movie, tracker, watchlists, profile-self, settings |
| accessibility | color-contrast | 7 | 9 | landing, search, title-movie, watchlists, settings |
| accessibility | select-name | 7 | 2 | feed |
| accessibility | aria-allowed-attr | 10 | 2 | title-movie |
| best-practices | errors-in-console | 1 | 5 | title-movie, profile-self, settings |
| best-practices | font-size | 1 | 4 | landing, feed, tracker, profile-self |
| seo | meta-description | 1 | 16 | login, feed, search, title-movie, tracker, watchlists, profile-self, settings |
| seo | robots-txt | 1 | 1 | profile-self |

- **`meta-description`.** Only landing has one. It is the whole SEO gap on `/login`.
- **`errors-in-console`.** React errors #418 and #419, explained under [Runtime](#runtime).
- **`font-size`.** Text too small on mobile, from the 9 to 11 px retro labels.
- **Intermittent, not findings.** `robots-txt` and a chunked-encoding console error each failed 1 of 3 runs on profile mobile. `public/robots.txt` exists, so I suspect load (guess). Landing mobile contrast failed 1 of 3 on one animated neon line, so the score depends on animation phase (inferred).
- **Lighthouse 100 is weaker than axe.** Landing scores 100 while axe reports 4 moderate landmark nodes, and no Lighthouse cell was marked down for them (observed). The two gates are not interchangeable.

SEO on `/app/*` means little, since those pages redirect to `/login` for crawlers. I suggest gating SEO on public pages only.

## Build

Regenerate with `baselines.sh build` and `static`. Sizes are exact for this tree. Gzip is level 9 and brotli quality 11, computed from the files, because the local server sends them uncompressed. 66 JS files and 1 CSS file.

| Asset | Raw | Gzip | Brotli |
| --- | --- | --- | --- |
| Client JS | 2,947,749 B | 845,505 B | 697,556 B |
| Client CSS | 233,581 B | 34,385 B | 26,965 B |

Largest files:

| File | Raw | Gzip | Brotli |
| --- | --- | --- | --- |
| settings-GLw83X9D.js | 1361 KB | 342 KB | 266 KB |
| main-UFMRxEaH.js | 761 KB | 237 KB | 203 KB |
| styles-DAiSeHOo.css | 228 KB | 34 KB | 26 KB |
| review-modal-C9Vzs2k6.js | 112 KB | 34 KB | 29 KB |
| tracker._tmdbId-Dg2KnUPL.js | 76 KB | 22 KB | 19 KB |
| profile._userId-CRj6msdO.js | 66 KB | 19 KB | 16 KB |
| route-D0o5ulhs.js | 55 KB | 16 KB | 14 KB |
| title._mediaType._tmdbId-D9J4W3DM.js | 43 KB | 13 KB | 11 KB |
| index-BbiIISBq.js | 43 KB | 12 KB | 10 KB |
| tracker.index-D-IrHJFa.js | 39 KB | 12 KB | 10 KB |

Entry weight per route, as the union of the manifest preloads along the route chain, JS only. Every route also loads the one CSS file.

| Route | JS files | JS raw | JS gzip |
| --- | --- | --- | --- |
| /app/settings/blocked | 24 | 2273 KB | 632 KB |
| /app/settings | 20 | 2264 KB | 628 KB |
| /app/tracker/$tmdbId | 29 | 1077 KB | 338 KB |
| /app/profile/$userId | 34 | 1072 KB | 337 KB |
| /app/title/$mediaType/$tmdbId | 35 | 1072 KB | 339 KB |
| /app/watchlists/$watchlistId | 26 | 1024 KB | 322 KB |
| /app/feed | 33 | 1022 KB | 324 KB |
| /app/shuffle/ | 20 | 922 KB | 290 KB |
| /app/search | 26 | 916 KB | 290 KB |
| /app/tracker/ | 26 | 916 KB | 289 KB |
| /app/friends | 19 | 900 KB | 283 KB |
| /app/watchlists/ | 21 | 896 KB | 283 KB |
| /app/shuffle/hidden | 17 | 875 KB | 275 KB |
| /onboarding/ | 13 | 873 KB | 277 KB |
| /login | 5 | 806 KB | 254 KB |
| / | 4 | 789 KB | 247 KB |

Where the bytes go, from a separate sourcemapped build, accurate to a few percent:

| Package | Approx raw bytes |
| --- | --- |
| heic2any | 1,352,548 |
| src/components | 414,689 |
| src/routes | 201,403 |
| react-dom | 181,087 |
| motion-dom | 92,814 |
| @tanstack/router-core | 66,842 |
| zod | 63,963 |
| react-day-picker | 40,791 |

- **`heic2any` is 46% of all client JS.** It is 1.35 MB of the 1.39 MB `settings` chunk, imported at the top of `change-avatar-dialog.tsx` for one rare path. It is why `/app/settings` costs about double any other route, and it also causes the SSR crash below.
- **Dev tools do not ship.** `TanStackDevtools` is rendered unconditionally in `__root.tsx`, but the `devtools()` Vite plugin strips it on build. Neither string scan nor sourcemap attribution finds devtools in client JS, and the server bundle has none either. This depends on that plugin. The packages sit in `dependencies`, not `devDependencies`.
- **recharts does not ship.** The only hit is Tailwind classes in the CSS, generated from `ui/chart.tsx`, which nothing imports. It is an unused dependency.

## Runtime

Regenerate with `baselines.sh runtime`. Mobile viewport, cold cache per run, 3 runs, routes interleaved. Counts are load-independent. Timing is in the quiet-machine results section. Any timing columns in this table come from the first, overloaded pass and do not count.

| Route | Requests | Own | External | tRPC HTTP | Procedure calls | JS loaded gzip | Failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| landing | 12 (12 to 13) | 7 (7 to 8) | 5 | 1 (1 to 2) | 1 (1 to 2) | 247 KB | 0 |
| login | 12 | 8 | 4 | 1 | 1 | 254 KB | 0 |
| feed | 43 | 38 | 5 | 2 | 3 | 324 KB | 0 |
| search | 58 | 35 | 23 | 5 | 25 (23 to 25) | 290 KB | 0 |
| title-movie | 62 | 42 | 20 | 4 | 10 | 339 KB | 0 |
| title-tv | 58 | 42 | 16 | 4 | 10 | 339 KB | 0 |
| tracker | 39 | 32 | 7 | 3 | 5 | 289 KB | 0 |
| tracker-show | 43 | 36 | 7 | 4 | 11 | 338 KB | 0 |
| watchlists | 34 | 26 | 8 | 2 | 3 | 283 KB | 0 |
| watchlist-detail | 42 | 33 | 9 | 3 | 4 | 322 KB | 0 |
| shuffle | 29 | 24 | 5 | 1 | 3 | 290 KB | 0 |
| friends | 30 | 24 | 6 | 2 | 4 | 283 KB | 0 |
| profile-self | 47 | 42 | 5 | 5 | 11 | 337 KB | 0 |
| settings | 32 | 26 | 6 | 2 | 4 | 628 KB | 0 |

0 failed requests on every route. tRPC's stream link aborts each finished stream, so raw browser events report `ERR_ABORTED` after a good 200. The script counts those as success. Search landing makes 25 procedure calls in 5 requests, the most of any route. Server-side tRPC calls are not counted, because the browser cannot see them. Only the title route has a loader.

HTML per route, 20 fetches each. The bytes are load-independent:

| Route | Status | HTML bytes |
| --- | --- | --- |
| api-health | 200 | 2 |
| landing | 200 | 57563 |
| login | 200 | 46294 |
| feed | 200 | 62221 |
| search | 307 | 0 |
| title-movie | 200 | 101352 |
| title-tv | 200 | 99427 |
| tracker | 200 | 54054 |
| tracker-show | 200 | 46973 |
| watchlists | 200 | 53516 |
| watchlist-detail | 307 | 0 |
| shuffle | 200 | 4450 |
| friends | 200 | 54292 |
| profile-self | 200 | 48146 |
| settings | 200 | 4475 |

**SSR crashes, measured in the server log.** `/app/shuffle`, `/app/settings` and `/app/settings/blocked` return 200 with a shell of 4 to 5 KB, and the page then renders only in the client.

- `/app/shuffle` throws `ReferenceError: sessionStorage is not defined`, 72 times in the log. `sessionStorage` is read in a `useState` initialiser in `routes/app/shuffle/index.tsx`.
- `/app/settings` and `/app/settings/blocked` throw `ReferenceError: window is not defined`, 114 times, from `heic2any` at import.
- The client then logs React error #419 on shuffle and settings.
- Title pages log React error #418, a hydration mismatch, in the runtime runs and in all 3 Lighthouse runs per preset for the movie page. The cause was not investigated.
- `/app/search` and `/app/watchlists/$id` answer 307 to add default search params, so a bare first load costs an extra hop.

## Code shape

Regenerate with `baselines.sh static`. Line counts include blanks and exclude `routeTree.gen.ts`. 237 files, 45,311 lines, of which 42,005 are product code.

- **Top routes and components.** Tables below. Files under 500 lines appear so the top 20 is complete.
- **tRPC procedures.** 113, counted from the live router object: todos 2, achievement 4, friend 15, review 3, recommendation 4, tasteProfile 10, search 4, shuffle 10, title 1, notification 7, watched 7, watchEvent 8, watchlist 19, user 1, episodeTracker 13, journalEntry 5. The `todos` router is unused template code.
- **Tables.** 21. **TODO or FIXME.** 0. **`any`.** 0 by AST, and grep agrees. **`biome-ignore`.** 46. **`@ts-ignore`.** 0.
- **tsc.** Exit 0, 238 strict files. **biome ci.** Exit 0, 240 files. Note that `biome.json` limits scope to `src`, `.vscode`, `index.html` and `vite.config.ts`.

Files over 500 lines (19):

| File | Lines |
| --- | --- |
| `src/routes/app/profile.$userId.tsx` | 1944 |
| `src/routes/app/tracker.$tmdbId.tsx` | 1733 |
| `src/integrations/trpc/routers/friend.ts` | 989 |
| `src/integrations/trpc/routers/watchlist.ts` | 987 |
| `src/integrations/trpc/routers/watch-event.ts` | 926 |
| `src/db/schema.ts` | 781 |
| `src/routes/app/friends.tsx` | 753 |
| `src/components/tracker/write-about-modal.tsx` | 736 |
| `src/routes/app/tracker.index.tsx` | 729 |
| `src/components/ui/sidebar.tsx` | 724 |
| `src/integrations/trpc/routers/shuffle.ts` | 652 |
| `src/routes/app/feed.tsx` | 566 |
| `src/components/tracker/tracker-show-card.tsx` | 560 |
| `src/integrations/trpc/routers/episode-tracker.ts` | 553 |
| `src/lib/evaluate-achievements.ts` | 548 |
| `src/lib/quote-generator.ts` | 536 |
| `src/lib/achievements.ts` | 517 |
| `src/components/title/title-actions.tsx` | 514 |
| `src/components/recommend/recommend-modal.tsx` | 511 |

Top 20 routes:

| File | Lines |
| --- | --- |
| `src/routes/app/profile.$userId.tsx` | 1944 |
| `src/routes/app/tracker.$tmdbId.tsx` | 1733 |
| `src/routes/app/friends.tsx` | 753 |
| `src/routes/app/tracker.index.tsx` | 729 |
| `src/routes/app/feed.tsx` | 566 |
| `src/routes/app/settings.tsx` | 393 |
| `src/routes/app/route.tsx` | 269 |
| `src/routes/onboarding/index.tsx` | 268 |
| `src/routes/app/title.$mediaType.$tmdbId.tsx` | 238 |
| `src/routes/app/watchlists/$watchlistId.tsx` | 214 |
| `src/routes/app/settings/blocked.tsx` | 168 |
| `src/routes/index.tsx` | 167 |
| `src/routes/app/shuffle/hidden.tsx` | 156 |
| `src/routes/login.tsx` | 143 |
| `src/routes/__root.tsx` | 99 |
| `src/routes/app/shuffle/index.tsx` | 95 |
| `src/routes/app/search.tsx` | 79 |
| `src/routes/app/watchlists/index.tsx` | 76 |
| `src/routes/api/cron/review-reminders.ts` | 58 |
| `src/routes/api.trpc.$.tsx` | 28 |

Top 20 components:

| File | Lines |
| --- | --- |
| `src/components/tracker/write-about-modal.tsx` | 736 |
| `src/components/ui/sidebar.tsx` | 724 |
| `src/components/tracker/tracker-show-card.tsx` | 560 |
| `src/components/title/title-actions.tsx` | 514 |
| `src/components/recommend/recommend-modal.tsx` | 511 |
| `src/components/shuffle/swipe-card.tsx` | 479 |
| `src/components/notifications/notification-item.tsx` | 475 |
| `src/components/watched/review-modal.tsx` | 445 |
| `src/components/watched/watch-event-card.tsx` | 432 |
| `src/components/achievements/achievement-popup.tsx` | 405 |
| `src/components/watchlist/create-watchlist-dialog.tsx` | 374 |
| `src/components/ui/chart.tsx` | 356 |
| `src/components/ui/combobox.tsx` | 309 |
| `src/components/watchlist/watchlist-item-card.tsx` | 302 |
| `src/components/achievements/achievement-grid.tsx` | 301 |
| `src/components/tracker/journal-entry-card.tsx` | 285 |
| `src/components/search/filter-sidebar.tsx` | 280 |
| `src/components/ui/menubar.tsx` | 276 |
| `src/components/onboarding/taste-profile-step.tsx` | 274 |
| `src/components/watchlist/watchlist-removal-dialog.tsx` | 274 |

## Test health

Regenerate with `baselines.sh tests`, which runs `bun run test` 3 times. Across 6 runs, 146 tests in 13 files gave 145 passed and 1 failed, the same one each time.

- **The failure.** `watchlist.list returns watchlists the user is a member of` in `src/integrations/trpc/__tests__/watchlist.test.ts`, with `TypeError: Cannot read properties of undefined (reading 'groupBy')`.
- **Not caused by load, and not caused by the uncommitted changes.** It fails the same way on a clean export of HEAD.
- **Cause.** The test's mock database has no `groupBy`. Commit `14d3db4` (2026-04-14) added `.groupBy` to `watchlist.list`, and the test file was last changed 2026-04-04. The test is stale and the product code works, since `/app/watchlists` renders in every browser run.
- **Why nobody saw it.** CI runs only on pull requests to main. `14d3db4` is on main with no PR number and no matching CI run in `gh run list`, so it appears to have been pushed directly (inferred).
- **Slow exit.** Vitest reports `close timed out after 10000ms`, so each run hangs 10 seconds after the tests finish.

**CI.** Biome, typecheck, build and tests, on pull requests only. No end-to-end test runs in CI, no end-to-end dependency exists in `package.json`, and coverage is not configured.

**Routers with no test (11 of 15).** `achievement`, `episode-tracker`, `journal-entry`, `notification`, `recommendation`, `review`, `shuffle`, `title`, `user`, `watch-event`, `watched`. `notification` appears in two test files, but only as a mock. Tested routers use a mocked database, so none exercise real SQL.

## Keyboard

Regenerate with `baselines.sh keyboard`. Same result in 3 sessions, at 1440x900 on `/app/title/movie/603`.

**Can a keyboard-only user reach and name the mark-watched control? Reach, yes. Name, no.**

- **Reach.** It is tab stop 12, and the focus outline changes.
- **Name.** The ARIA snapshot at the target is `- button`, with no `aria-label`, `aria-labelledby` or `title`. The visible "Watched" text is a sibling. A screen reader says "button".
- **On the way.** 3 of the 12 stops have no name (bell, Watchlist, Watched).
- **Operate.** Enter and Space both open Review. Focus lands on Close inside the dialog and stays in. Public is 10 stops in. Save & Done is reachable after choosing a visibility. A keyboard-only run wrote one `watch_event` row, checked in the database.
- **Close.** Escape closes it, but focus falls to `body`, so the user restarts from the top of the page.
- **Whole app.** No skip link and no `<main>` on landing, login, feed or title. `/login` has 2 `h1` elements.

Separate from keyboard access, the "Marked as watched" toast appears before any diary entry exists. Pressing Escape on Review leaves 0 `watch_event` rows, while `quickMarkWatched` has already set `watchlist_item.watched`.

## Reduced motion and zoom

Regenerate with `baselines.sh motion`.

**Reduced motion mostly works.** One blanket rule in `styles.css` stops the CSS animations.

| Screen | Infinite animations, no preference | Infinite, reduce | Other running, reduce | Pixels move after settle, reduce |
| --- | --- | --- | --- | --- |
| landing | 144 | 0 | 0 | no |
| login | 143 | 0 | 0 | no |
| feed | 146 | 0 | 0 | no |
| title-movie | 143 | 0 | 0 | no |
| tracker-show | 103 | 0 | 0 | no |
| watchlists | 148 | 0 | 0 | no |
| shuffle | 168 | 0 | 2 | yes |
| profile-self | 134 | 0 | 0 | no |
| settings | 103 | 0 | 0 | no |

- **Shuffle** still moves under reduced motion, with 2 running animations and changing pixels.
- **The achievement celebration** still ran up to 46 animations under reduced motion, against 222 without, none infinite. These are script-driven, so the CSS rule misses them (inferred). Sampling happens over 1.5 seconds. The reduced-motion frame shows no confetti.
- Nothing else in `src` checks for reduced motion.

**Zoom breaks layout.** 200% at a 390 px window is 195 CSS px, emulated at device scale 2. That is the same layout width as browser zoom, not browser zoom itself. WCAG 1.4.10 requires 320 px, so I added that width. Values are how far the page actually scrolls sideways, in px, proven with `scrollTo`. 1 run of the final probe. An earlier probe gave the same 77 and 137.

| Screen | 390 px | 320 px (WCAG 1.4.10) | 195 px (200% at 390) | Cause at 195 px |
| --- | --- | --- | --- | --- |
| landing | 0 | 0 | 0 | none |
| login | 0 | 14 | 77 | `div.bg-neon-amber rounded-full` |
| feed | 0 | 14 | 77 | `div.bg-neon-amber rounded-full` |
| title-movie | 36 | 36 | 137 | `div.absolute pointer-events-none z-[-1]` |
| tracker-show | 0 | 0 | 13 | `button.flex flex-1 flex-col items-center gap` |
| watchlists | 0 | 14 | 77 | `div.bg-neon-amber rounded-full` |
| shuffle | 0 | 14 | 77 | `div.bg-neon-amber rounded-full` |
| profile-self | 0 | 0 | 0 | none |
| settings | 0 | 0 | 0 | none |

- **The movie title page scrolls sideways at normal zoom on a phone.** 36 px at 390, with an absolute glow layer the widest offender at 195 px. Users see this with no zoom at all. The TV title page was not in this probe.
- **Fixed-width marquee bulb rows** cause the overflow on login, feed, watchlists and shuffle.
- **Visible at 195 px.** The logo overlaps the bell and the avatar, and "FEED" breaks as "FEE/D". See `zoom200-feed.png` in the evidence directory.
- Landing, profile and settings do not scroll sideways at any width tested.

## Not measured

| What | Command tried or reason | Effect |
| --- | --- | --- |
| Any timing number from the first pass | Measured with `runtime` and `lighthouse perf`, load 5 to 64 on 10 cores | Replaced by the quiet-machine run |
| `match-celebration` modal | No journey written, needs two users swiping the same title in a shared list | One modal unscanned |
| `season-picker-modal`, `watchlist/review-dialog`, `CommandDialog` | No caller in `src`, so no user can open them | Likely dead code |
| Onboarding steps 2 to 6 | Registry scans `/onboarding`, step 1 only | Five screens unscanned, including taste profile |
| Production compression, HTTP version, CDN | Production is off limits | `gzip` variant bounds the first |
| Server-side tRPC calls per route | Browser cannot see them | Undercount on title routes only |
| Real browser zoom | Emulated by width and scale | Layout equivalent, text-only zoom untested |
| Real screen reader | Not available here | Names checked by axe and ARIA snapshot only |
| Realistic data size | 5 watch events, not years of diary | Long lists and pagination unmeasured |

Two harness errors were caught and fixed, and are recorded because they would have produced false numbers.

- An achievement popup opened by itself on first profile visit and hid the page from axe, giving a false 0. Seeding now drains popups, and scans record any dialog left open. 0 occurred in the final passes.
- Normal tRPC stream aborts first appeared as failed requests. They are now classified by their response.
