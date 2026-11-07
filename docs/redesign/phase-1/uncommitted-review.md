# Review of the uncommitted changes

The owner has 10 modified files on `main`. This review says what each one is for, whether it conflicts with committed behaviour, whether it is finished, and whether it is safe to commit as is. Nothing was changed. Paths are relative to `src/`, and `routers/` means `src/integrations/trpc/routers/`.

## Summary

| File | Verdict |
| --- | --- |
| `CLAUDE.md` | Safe |
| `components/achievements/achievement-celebration-provider.tsx` | Safe with one caveat |
| `components/onboarding/taste-profile-step.tsx` | Safe, commit with `taste-profile.ts` |
| `integrations/trpc/routers/taste-profile.ts` | Not safe as is |
| `integrations/trpc/routers/watchlist.ts` | Safe in code, needs an owner decision |
| `routes/app/tracker.$tmdbId.tsx` | Safe |
| `components/tracker/completion-celebration.tsx` | Safe |
| `components/ui/calendar.tsx` | Safe, commit with `review-modal.tsx` |
| `components/watched/review-modal.tsx` | Safe, commit with `calendar.tsx` |
| `routes/app/profile.$userId.tsx` | Safe |

Checks (measured). `bunx tsc --noEmit` printed no errors. `bun run test` gives 145 of 146 passing across 13 files. The one failure is `watchlist.list > returns watchlists the user is a member of`, where the mock lacks the `itemCounts` chain. It fails the same way on a HEAD export, so it has been failing since 14d3db4 and none of these changes caused it.

## taste-profile.ts and taste-profile-step.tsx

Intent (inferred). Two changes. First, onboarding picks now carry title and poster, so seeded My Picks items stop showing blank (`components/onboarding/taste-profile-step.tsx:160`, `routers/taste-profile.ts:351`, `:399`). Second, completion moves out of step 3. `saveTasteProfile` no longer sets `onboardingCompleted` or evaluates the onboarding achievement.

Conflict with committed behaviour. No achievement is lost if the user reaches step 6, because `saveProfileExtras` already sets the flag and evaluates (`routers/taste-profile.ts:426`, `:430`). `BioStep` calls it from both Continue and Skip (`components/onboarding/bio-step.tsx:37`, `:52`), measured. The likely motive is real. At HEAD the flag flips at step 3, so a refresh during steps 4 to 6 sends the user out through the onboarding guard (`routes/onboarding/route.tsx:12`), and they never see those steps (inferred).

The new risk (inferred, F91). Under the change, a user who leaves during steps 4 to 6 is still not onboarded. `/app` sends them back (`routes/app/route.tsx:36`), and onboarding restarts at step 0 (`routes/onboarding/index.tsx:50`). When they reach step 3 again, `saveTasteProfile` runs a second time.

- It inserts a second default "My Picks" with no guard (`routers/taste-profile.ts:379`). No unique index stops it (`db/schema.ts:157`).
- `getOrCreateDefaultWatchlist` then picks one of the two with `findFirst` (`routers/watchlist.ts:127`), so a user's watched flags can split across two defaults.
- Genres insert with `onConflictDoNothing`, so a second pass adds to the first and can exceed the limit of 5.

HEAD could not reach this path, because the flag blocked re-entry.

Verdict. Not safe as is. Finished in intent, but it opens a duplicate-list path that did not exist. Make the default-list creation in `saveTasteProfile` idempotent first, for instance by reusing `getOrCreateDefaultWatchlist`, and replace genres rather than add to them. The title and poster half is safe alone. `taste-profile-step.tsx` sends fields the router must accept, so commit the two together.

## watchlist.ts

Intent (inferred). Removes the filter that hid lists with 0 items, and keeps the shuffle exclusion (`routers/watchlist.ts:175`, `:178`). This reverses part of commit 14d3db4, "hide empty/shuffle watchlists".

Why it may be right. With the HEAD filter, a newly created list disappears from the index until it has an item, and an emptied My Picks vanishes. A user with only empty lists sees "No watchlists yet" (inferred from reading the filter).

Conflict. It contradicts what 14d3db4 said it wanted. The `itemCount` fallback still works. The failing test is unrelated.

Verdict. Safe in code and finished. It is a product decision only the owner can confirm. If 14d3db4 was hiding something specific, such as empty auto-created lists, that returns. Commit with a message saying the reversal is deliberate.

## achievement-celebration-provider.tsx

Intent (measured from its comment). Poll `myAchievements` every 30 seconds so the requester sees a popup when a friend accepts and both earn Plus One. The mutation-side popup only reaches the accepting client (`components/achievements/achievement-celebration-provider.tsx:66`).

Finished. The first fetch sets a baseline, so old badges do not replay, and `knownIdsRef` stops double popups.

Caveat (inferred). The provider is mounted in the root layout (`routes/__root.tsx:78`), and `myAchievements` is a protected procedure. A logged-out visitor on the landing or login page therefore makes a failing request every 30 seconds. Add an `enabled` check on the session, or move the provider under `/app`.

Verdict. Safe with that caveat. It will not break anything a user sees.

## tracker.$tmdbId.tsx

Intent (measured). Bulk episode marks no longer open an episode review prompt. Only single marks do (`routes/app/tracker.$tmdbId.tsx:185`).

Conflict. None with a rule. One gap to know about. The new comment says the celebration handles the review for whole-show completion. Marking a whole season on an unfinished show now gives no prompt at all, which seems intended.

Verdict. Safe and finished.

## calendar.tsx and review-modal.tsx

Intent (measured). Default the calendar to dropdown month and year captions, and give the review modal a range from 1950 (`components/ui/calendar.tsx:19`, `components/watched/review-modal.tsx:304`). `review-modal.tsx` is the only consumer of the calendar. Other "Calendar" hits are icons.

Conflict. None. This does not fix the date drift in F30 (`components/watched/review-modal.tsx:85`, `:154`).

Verdict. Safe and finished. Commit them together.

## completion-celebration.tsx

Intent (measured). Centres the celebration overlay with `place-items-center` (`components/tracker/completion-celebration.tsx:64`, `:79`). Cosmetic. Safe and finished.

## profile.$userId.tsx

Intent (measured). Passes `friendName` to two child components (`routes/app/profile.$userId.tsx:1297`, `:1347`). The prop already exists. Harmless on your own profile. Safe and finished.

## CLAUDE.md

Removes the "speak like a caveman" instruction. No code effect. An owner preference. Safe.

## Suggested grouping

If the owner commits these, four groups keep each commit about one thing (inferred).

1. `CLAUDE.md`.
2. `calendar.tsx`, `review-modal.tsx`, `completion-celebration.tsx`, `profile.$userId.tsx`, `tracker.$tmdbId.tsx`.
3. `achievement-celebration-provider.tsx`, after the `enabled` check.
4. `watchlist.ts` on its own, so the reversal is visible. `taste-profile.ts` and `taste-profile-step.tsx` after the idempotency fix.
