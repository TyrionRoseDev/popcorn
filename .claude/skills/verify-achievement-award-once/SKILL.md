---
name: verify-achievement-award-once
description: "Checks that concurrent achievement evaluations award and announce each achievement once. Use when a change touches src/lib/evaluate-achievements.ts (evaluateAchievements, syncAchievements, checkCondition), the earned_achievement table or its unique index in src/db/schema.ts, ACTION_CONTEXT_MAP or ACHIEVEMENTS in src/lib/achievements.ts, or the way a tRPC procedure turns `newAchievements` into achievement_earned notifications (watchlist.markWatched, friend.acceptRequest). Also use when someone asks whether achievements can double-award, double-notify, or get skipped."
---

# Verify: each achievement is awarded and announced once

## The promise

- **Property:** when several requests for the same user evaluate achievements at once, each achievement gets one `earned_achievement` row, and exactly one call returns it as newly earned.
- **Harm if broken:** friends get duplicate "X earned Y" notifications (or none), the user gets a 500 on a normal action, or a meta achievement like Trophy Case is skipped.

Unit tests (`src/lib/__tests__/evaluate-achievements.test.ts`) run one call at a time, so they never reach the overlap case. This check does.

## How it works (tool and why)

`check/award-once.verify.ts` runs the **real** `evaluateAchievements` / `syncAchievements` from `src/lib/evaluate-achievements.ts` against an in-memory `#/db` (`check/fake-db.ts`). It starts 2 or 3 calls for one user at once. Then it explores **every** order in which their `earned_achievement` statements can commit: depth-first, replaying each schedule from scratch. It checks the properties on each schedule. This is stateless model checking of the real TypeScript, so no hand model can drift from the code. A TLA+ model was not used: it would restate code that can be run directly, and this machine has no Java runtime for TLC.

Why the step granularity is exact: Node runs the JS between two `await`s without interleaving, and Postgres runs each statement atomically. So the atomic steps are exactly the awaited drizzle statements.

### Properties (checked on every schedule)

| name | plain meaning |
| --- | --- |
| `noThrow` | No call rejects. A duplicate INSERT must not become a 500. |
| `sound` | Every id a call returns was not earned at the start and is earned at the end. |
| `complete` | Every new `earned_achievement` row is returned by some call. Otherwise there is no popup and no friend notification. |
| `reportOnceSerial` | When the calls run one after another, each id is returned at most once in total. |
| `reportOnce` | Even when the calls overlap, each id is returned at most once in total. |
| `sameOutcomeAsSerial` | Overlapping calls end with the same rows as some serial order, so no cascade is lost. |

### Scenarios (in `SCENARIOS`)

- `two-first-watches`: two `evaluateAchievements(user, "watched")` calls, watchlist_item count 1. These come from `watchlist.markWatched`.
- `two-swipes-cascade` and `three-swipes-cascade`: 2 or 3 `"swipe"` calls at 50 swipes with 9 achievements already earned. Each awards channel-surfer, then trophy-case through the `achievementCount` cascade.
- `swipe-vs-sync`: a `"swipe"` call alongside `syncAchievements` (`achievement.sync`, run from `src/routes/app/profile.$userId.tsx`).
- `swipe-vs-review`: `"swipe"` and `"review"` calls with 8 achievements earned. Each call earns one, and together they reach trophy-case.

### Bounds and assumptions

- 1 user, 2 or 3 concurrent calls, the five scenarios above, and every interleaving of their `earned_achievement` statements: 966 schedules in total, in about 1 second.
- Other tables are constant while the calls run. Their statements run immediately with no scheduling point, which is sound because they commute. A count query on table T answers `counts[T]` and **ignores `where` filters**. `selectDistinct`, `db.execute`, and `db.query.*` return empty results, so conditions that depend on them (genre, rec*, clearedWatchlist, series, and so on) evaluate false.
- The unique index `earned_achievement_unique` (src/db/schema.ts) is modeled. A duplicate INSERT without `ON CONFLICT DO NOTHING` throws 23505.
- The check does not model transactions, row locks, advisory locks, retries, or a DB connection failing midway. Any use of `db.transaction`, `db.update`, `db.delete`, `db.query.earnedAchievement`, or an unknown builder method throws `FakeDbGap`.

## Run it

```sh
.claude/skills/verify-achievement-award-once/run.sh
```

It uses the repo's own vitest (pinned by bun.lock), so run `bun install` once first. It needs no database, no network, and no env vars (`#/env` and `#/db` are mocked). It has its own `vitest.config.ts`, so `bun run test` never picks it up. Exit 0 means the violations seen are exactly the list in `known-findings.json`.

## Reading the result

Each scenario prints `PASS`, `KNOWN FINDING`, or `VIOLATED` for each property. For any non-pass it also prints the shortest counterexample as statements per call, followed by what each call returned.

- **`VIOLATED` (not in known-findings.json):** the change broke the promise, or found a new break. Read the trace as steps in the code. Tell the user what the counterexample means in plain words. Do not add the entry to known-findings.json just to make the run pass.
- **"Known findings that no longer reproduce":** a fix landed. Confirm the fix is intended, then remove those entries from known-findings.json.
- **Error containing `FakeDbGap`:** a modeling error, not a product bug. The code now uses a DB feature the fake does not model, such as a transaction or `db.query.earnedAchievement`. Extend `check/fake-db.ts` to model it faithfully (a transaction is one atomic step only if it really is serializable for these rows), then rerun.
- **A scenario that stops awarding anything** (for example, after renaming an achievement id or changing thresholds in src/lib/achievements.ts): update `NINE`, `counts`, or the scenario so it still triggers the cascade. Then check that the counterexample traces still name real ids.

## Current findings (at the sync commit)

1. **`reportOnce` is violated** (two-first-watches, the swipe cascades, swipe-vs-sync). Counterexample: call#1 and call#2 both `SELECT earned_achievement` (0 rows). call#1 INSERTs first-watch. call#2's INSERT hits ON CONFLICT DO NOTHING and inserts 0 rows. Both calls still return `[first-watch]`. The cause is in `evaluateAchievements` and `syncAchievements`: `newlyEarned.push(achievement.id)` runs whether or not the INSERT inserted a row. `watchlist.markWatched` and `friend.acceptRequest` then send `achievement_earned` notifications to every friend once per call, so friends get duplicates. In-app popups are deduped within one browser session by `knownIdsRef` in `src/components/achievements/achievement-celebration-provider.tsx` (an uncommitted change), but not across tabs or devices. A scratch run that added `.returning({ id: earnedAchievement.id })` and pushed only when `inserted.length > 0` made every `reportOnce` entry stop reproducing, with all other properties still passing.
2. **`sameOutcomeAsSerial` is violated** (swipe-vs-review). Both calls read 8 earned. Each inserts its own achievement (channel-surfer, opening-review) and counts only its own `earnedIds` (9). Neither awards trophy-case, although a serial run awards it. This is low severity, because the next evaluation in any context (all include `achievementCount`) or `achievement.sync` awards it later.

## Coverage record

| file | what is covered |
| --- | --- |
| `src/lib/evaluate-achievements.ts` | `evaluateAchievements` and `syncAchievements` in full. In `checkCondition`, the `watchedCount`, `totalSwipes`, `shuffleToWatchlist`, `firstReview`, `reviewCount`, `achievementCount`, and `achievementCountAll` branches (others run but evaluate false under the fake). |
| `src/lib/achievements.ts` | `ACTION_CONTEXT_MAP` for `watched`, `swipe`, `review`. `ACHIEVEMENTS` ids and thresholds used by the scenarios (first-watch, channel-surfer, opening-review, trophy-case, and the ids in `NINE`). |
| `src/db/schema.ts` | `earnedAchievement` and its `earned_achievement_unique` index (assumed, modeled in fake-db.ts). |
| Callers (harm only, not executed) | `src/integrations/trpc/routers/watchlist.ts` `markWatched` (friend notifications per returned id). `src/integrations/trpc/routers/friend.ts` `acceptRequest`. `src/integrations/trpc/routers/shuffle.ts` `recordSwipe`. `src/integrations/trpc/routers/review.ts` `upsert`. `src/integrations/trpc/routers/achievement.ts` `sync`. |

**Sync commit:** `0562c2665749ad7eda2c3dcec5020cb047496bdd`. It was recorded while the working tree had uncommitted changes. Of the files above, only `src/integrations/trpc/routers/watchlist.ts` was dirty; its change is in the watchlist list query, not in `markWatched`. `src/components/achievements/achievement-celebration-provider.tsx`, named under findings, was also dirty. `src/lib/evaluate-achievements.ts`, `src/lib/achievements.ts`, and `src/db/schema.ts` were clean. The verification describes that working-tree code.

To see whether the verification needs another look:

```sh
git diff --stat 0562c2665749ad7eda2c3dcec5020cb047496bdd -- src/lib/evaluate-achievements.ts src/lib/achievements.ts src/db/schema.ts src/integrations/trpc/routers/watchlist.ts src/integrations/trpc/routers/friend.ts src/integrations/trpc/routers/shuffle.ts src/integrations/trpc/routers/review.ts src/integrations/trpc/routers/achievement.ts
```

Move the sync commit forward only after you have rerun the check and confirmed that the fake DB, the scenarios, and this coverage record still describe the code at the new commit. Update the Current findings section and known-findings.json in the same change.

## Proven able to fail

At the sync commit, a scratch edit removed `.onConflictDoNothing()` from the INSERT in `evaluateAchievements` (the file was restored byte-identical afterwards). The run failed with new `noThrow` violations in four scenarios: call#2's INSERT throws 23505 `earned_achievement_unique` and the request rejects. It also showed `complete` violations in the cascades, where a row lands but the call that would have announced it rejected. Reproduce this after any change to the fake to confirm the check can still fail.
