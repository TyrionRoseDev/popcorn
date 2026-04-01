# TV Show Watch Time Tracking

## Problem

TV show watch time is currently stored as a single per-episode runtime value on `watchlistItem.runtime`. When a user marks a TV show as watched, only one episode's worth of time is logged — a 50-episode show with 45-minute episodes records as 45 minutes instead of ~37.5 hours.

## Solution

Add season-level tracking for TV shows. When marking a TV show as watched, users pick which seasons they've seen via a season picker modal. Runtime is computed as the sum of episodes across selected seasons multiplied by the per-episode runtime.

## Data Model

### Schema change: `watchlistItem`

Add column:
- `watchedSeasons` — `jsonb`, nullable, integer array (e.g., `[1, 2, 3]`)
  - `null` for movies
  - Populated for TV shows when marked watched

The existing `runtime` column remains but stores the **computed total** instead of per-episode runtime:
- `runtime = episode_run_time × sum(episode_count for each selected season)`
- This keeps the profile stats query (`sum(runtime) where watched = true`) working with zero changes

## TMDB Data

The existing TV detail response from TMDB includes a `seasons` array with per-season metadata including `episode_count`. This data needs to be extracted in `getTitleDetails` (`src/lib/tmdb-title.ts`) and passed through to the UI.

No additional API calls are required.

### Edge case: missing `episode_run_time`

TMDB is deprecating the `episode_run_time` field and it's sometimes empty. When missing:
- Fall back to fetching per-season detail (which includes individual episode runtimes)
- Or store `null` runtime and display "unknown" for watch time

## UX Flow

### Marking a TV show as watched

1. User clicks "Watched" button on a TV show title page
2. **Season picker modal** appears (instead of immediately toggling watched state):
   - Lists all seasons with checkboxes
   - Each row shows: "Season X — Y episodes"
   - "Select All" toggle at the top
   - Confirm button to save
3. On confirm:
   - `watchlistItem.watchedSeasons` is set to selected season numbers
   - `watchlistItem.runtime` is computed and stored
   - `watchlistItem.watched` is set to `true`
   - Review modal opens (rating, note, date) — same as today
4. Movies are **unchanged** — no season picker, existing flow preserved

### Unwatching a TV show

Clicking "Watched" on an already-watched TV show unmarks it directly:
- Clears `watchedSeasons` to `null`
- Clears `runtime`
- Sets `watched` to `false`
- No picker needed for removal

### Editing seasons

If a user returns to a show they've already marked watched and wants to update their progress:
- The season picker opens pre-filled with previously selected seasons
- User can add/remove seasons
- Runtime is recalculated on confirm

## Runtime Calculation

```
total_runtime = per_episode_runtime * sum(episode_count for each selected season)
```

Recalculated:
- On initial season selection (marking watched)
- When editing season selection (adding/removing seasons)

Written to `watchlistItem.runtime` so profile stats aggregation is unaffected.

## What Doesn't Change

- **Movie watch flow** — completely unchanged
- **Profile stats query** — still `sum(runtime) where watched = true`
- **Watch events** — no changes to the `watchEvent` table
- **Review modal** — still opens after marking watched, same fields
