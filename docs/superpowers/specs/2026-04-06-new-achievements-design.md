# New Achievements Design

Adds 15 new achievements across 3 areas: a new **Tracker** category, a new **Journal** category, and expanded **Reviews**. Brings total from 31 to 46.

## New Condition Types

These new `AchievementCondition` variants are needed:

| Type | Fields | Query |
|------|--------|-------|
| `trackedShowCount` | `threshold: number` | Count `userTitle` rows where `mediaType = 'tv'` for user |
| `episodeWatchCount` | `threshold: number` | Count `episodeWatch` rows for user |
| `completedSeriesCount` | `threshold: number` | Count shows where all episodes are marked watched (compare `episodeWatch` count per show against TMDB total episode count stored on `userTitle` or fetched) |
| `startedRewatch` | _(none)_ | Check if any `userTitle` has `currentWatchNumber >= 2` |
| `bingeWatchSeason` | _(none)_ | Check if all episodes of any single season for a show were marked watched on the same calendar day |
| `journalEntryCount` | `threshold: number` | Count `journalEntry` rows for user |
| `journalAllScopes` | _(none)_ | Check user has at least one `journalEntry` with scope `episode`, one with `season`, one with `show` |
| `reviewGenreCountAll` | _(none)_ | Check user has reviewed at least one title from every genre (join `review` with `watchEvent.genreIds` or TMDB data) |

## New Action Contexts

| Context | Triggers When | Condition Types Checked |
|---------|---------------|----------------------|
| `episode_marked` | User marks episode(s) as watched in tracker | `trackedShowCount`, `episodeWatchCount`, `completedSeriesCount`, `bingeWatchSeason` |
| `show_tracked` | User adds a show to the tracker | `trackedShowCount` |
| `rewatch_started` | User starts a rewatch | `startedRewatch` |
| `journal_entry` | User creates a journal entry | `journalEntryCount`, `journalAllScopes` |

Existing `review` context also checks `reviewGenreCountAll`.

All new contexts also check `achievementCount` and `achievementCountAll` (meta achievements).

## Tracker Category (8 achievements)

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `now-showing` | Now Showing | `📡` | Add your first show to the tracker | `trackedShowCount` threshold: 1 |
| `episode-one` | Episode One | `▶️` | Watch 50 episodes | `episodeWatchCount` threshold: 50 |
| `season-pass` | Season Pass | `📺` | Watch 200 episodes | `episodeWatchCount` threshold: 200 |
| `marathon-runner` | Marathon Runner | `🏃` | Watch 500 episodes | `episodeWatchCount` threshold: 500 |
| `series-finale` | Series Finale | `🎬` | Complete a full series | `completedSeriesCount` threshold: 1 |
| `serial-finisher` | Serial Finisher | `📚` | Complete 5 series | `completedSeriesCount` threshold: 5 |
| `series-sweep` | Series Sweep | `🧹` | Complete 10 series | `completedSeriesCount` threshold: 10 |
| `binge-watch` | Binge Watch | `🍿` | Watch an entire season in one day | `bingeWatchSeason` |

Note: The existing `🎬` icon is used by "First Watch". Changing "Episode One" to `▶️` to avoid collision. "Binge Watch" uses `🍿` — same as "Shared Popcorn". Let me fix:

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `now-showing` | Now Showing | `📡` | Add your first show to the tracker | `trackedShowCount` threshold: 1 |
| `episode-one` | Episode One | `▶️` | Watch 50 episodes | `episodeWatchCount` threshold: 50 |
| `season-pass` | Season Pass | `📺` | Watch 200 episodes | `episodeWatchCount` threshold: 200 |
| `marathon-runner` | Marathon Runner | `🏃` | Watch 500 episodes | `episodeWatchCount` threshold: 500 |
| `series-finale` | Series Finale | `🔚` | Complete a full series | `completedSeriesCount` threshold: 1 |
| `serial-finisher` | Serial Finisher | `📚` | Complete 5 series | `completedSeriesCount` threshold: 5 |
| `series-sweep` | Series Sweep | `🧹` | Complete 10 series | `completedSeriesCount` threshold: 10 |
| `binge-watch` | Binge Watch | `⏭️` | Watch an entire season in one day | `bingeWatchSeason` |

## Rewatch (part of Tracker category)

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `rerun` | Rerun | `🔄` | Start a rewatch of a series | `startedRewatch` |

Total tracker achievements: **9**

## Journal Category (3 achievements)

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `dear-diary` | Dear Diary | `📝` | Write your first journal entry | `journalEntryCount` threshold: 1 |
| `frequent-writer` | Frequent Writer | `🖊️` | Write 10 journal entries | `journalEntryCount` threshold: 10 |
| `triple-take` | Triple Take | `🎯` | Write an episode, season, and show journal entry | `journalAllScopes` |

## Reviews Additions (3 achievements)

Added to the existing `reviews` category.

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `seasoned-critic` | Seasoned Critic | `🎙️` | Leave 25 reviews | `reviewCount` threshold: 25 |
| `review-machine` | Review Machine | `⌨️` | Leave 50 reviews | `reviewCount` threshold: 50 |
| `genre-critic` | Genre Critic | `🎭` | Leave a review for every genre | `reviewGenreCountAll` |

Note: `🎭` is used by "Curtain Call". Changing to:

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `seasoned-critic` | Seasoned Critic | `🎙️` | Leave 25 reviews | `reviewCount` threshold: 25 |
| `review-machine` | Review Machine | `⌨️` | Leave 50 reviews | `reviewCount` threshold: 50 |
| `genre-critic` | Genre Critic | `🎬` | Leave a review for every genre | `reviewGenreCountAll` |

Wait, `🎬` is also taken. Using `📰` instead:

| ID | Name | Icon | Description | Condition |
|----|------|------|-------------|-----------|
| `seasoned-critic` | Seasoned Critic | `🎙️` | Leave 25 reviews | `reviewCount` threshold: 25 |
| `review-machine` | Review Machine | `⌨️` | Leave 50 reviews | `reviewCount` threshold: 50 |
| `genre-critic` | Genre Critic | `📰` | Leave a review for every genre | `reviewGenreCountAll` |

## Meta Achievement Update

The "Award Season" achievement currently requires 25 achievements. With 46 total, that's still reasonable. However, the threshold could be bumped. Leaving as-is for now — the achievement count thresholds (10, 25, all) still work fine with 46 total.

## Completion Detection for `completedSeriesCount`

This is the trickiest condition. We need to know the total episode count for a show to determine if all episodes are watched. Two approaches:

**Approach A: Store total episode count on `userTitle`**
- Add `totalEpisodes` column to `userTitle`
- Populate when show is added to tracker (from TMDB)
- Compare `episodeWatch` count for that show against `totalEpisodes`
- Pros: Fast query, no external API call at evaluation time
- Cons: Can go stale if show is still airing and adds episodes

**Approach B: Use the existing completion detection**
- The tracker detail page already calculates completion by fetching season data from TMDB and comparing against `episodeWatch` records
- Reuse this logic at the point where episodes are marked
- Pros: Always accurate
- Cons: Requires TMDB API call during achievement evaluation

**Recommendation: Approach A** with a `totalEpisodes` column on `userTitle`. Populate it when the show is added and update it when season data is fetched. This keeps achievement evaluation fast and database-only. The slight staleness risk is acceptable — if a show adds new episodes, the completion status should naturally change anyway.

## Binge Watch Detection

For `bingeWatchSeason`: when episodes are marked, check if all episodes of any season for that show have `watchedAt` on the same calendar day. This only needs to check the season that was just marked, using the `extra` context passed to `evaluateAchievements`.

## `reviewGenreCountAll` Detection

Reviews don't store genre IDs directly, but `watchEvent` has a `genreIds` JSONB field. We can join `review` to `watchEvent` on `(tmdbId, mediaType, userId)` to get genre coverage, or store `genreIds` on the review table. Alternatively, since the review router already has access to TMDB data at creation time, we could add `genreIds` to the review table.

**Recommendation:** Join `review` with `watchEvent` on matching `tmdbId`, `mediaType`, and `userId`. This avoids schema changes and works with existing data.

## Files to Modify

1. **`src/lib/achievements.ts`** — Add new condition types, categories, action contexts, and achievement definitions
2. **`src/lib/evaluate-achievements.ts`** — Add `checkCondition` cases for all new condition types, add imports for new tables
3. **`src/integrations/trpc/routers/episode-tracker.ts`** — Call `evaluateAchievements` with new contexts (`episode_marked`, `show_tracked`, `rewatch_started`)
4. **`src/integrations/trpc/routers/journal-entry.ts`** — Call `evaluateAchievements` with `journal_entry` context
5. **`src/integrations/trpc/routers/review.ts`** — Add `reviewGenreCountAll` to the `review` action context
6. **`src/db/schema.ts`** — Add `totalEpisodes` column to `userTitle` table
7. **`src/integrations/trpc/routers/episode-tracker.ts`** — Populate `totalEpisodes` when adding a show

## Summary

| Category | New | Existing | Total |
|----------|-----|----------|-------|
| Tracker | 9 | 0 | 9 |
| Journal | 3 | 0 | 3 |
| Reviews | 3 | 2 | 5 |
| **New achievements** | **15** | | |
| **Grand total** | | | **46** |
