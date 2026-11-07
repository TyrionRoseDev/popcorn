# Series tracker

Users track TV shows episode by episode. Pressing **Watched** on a TV title page adds the show to the tracker and opens `/app/tracker/<tmdbId>`. There the user marks single episodes or whole seasons (`Mark All`), sees progress such as `3/10`, and can start a rewatch. `/app/tracker` ("Series Tracker") lists every tracked show.

## Sub-features

- `tracker-add`: Watched on `/app/title/tv/<id>` calls `episodeTracker.addShow` and navigates to `/app/tracker/<id>`.
- `tracker-episode`: clicking an episode row (`E1 · <name>`) marks it watched with a check, and clicking it again unmarks it.
- `tracker-season`: `Mark All` on a season marks every unwatched episode. A full season shows a trophy, and the progress reads `n/n`.
- `tracker-collapse`: the buttons `Collapse season` and `Expand season`.
- `tracker-index`: `/app/tracker` lists tracked shows. Before any show is tracked it shows the empty state `No shows tracked yet`.
- `tracker-complete`: watching every episode triggers the completion celebration. No script yet.

## How to get to it (user POV)

- The `Tracker` tab, which opens `/app/tracker`.
- The Watched arcade button on a TV title page.

## Driving it with verify-popcorn

Preconditions:

- `vp doctor` exits 0. Vera tracks no shows. TMDB is reachable. Use Breaking Bad, `tv/1396`.
- There is no journey script yet. Write `journeys/tracker.ts`.

- **Empty index.** Run `vp.goto("/app/tracker")`. The text `No shows tracked yet` is visible.
- **Add show.** Run `vp.goto("/app/title/tv/1396")` and click the arcade `Watched` button. The URL becomes `/app/tracker/1396`.
- **Mark episode.** Click the first episode row button in season 1, whose name starts with `E1`. The row shows a check, and the season counter goes from `0/7` to `1/7`. `vp.sql("select season_number, episode_number from episode_watch where user_id='vp-user-vera' and tmdb_id=1396")` returns `1	1`.
- **Mark season.** Click `Mark All` on season 1. The counter reads `7/7` and `episode_watch` has 7 season-1 rows.
- **Persistence.** Reload `/app/tracker/1396`, then open `/app/tracker`. Breaking Bad is listed with its progress.
- **Proof.** Capture before and after each mark, plus `db.log`.

## Gotchas

- `src/routes/app/tracker.$tmdbId.tsx` and `completion-celebration.tsx` have uncommitted edits at the time of writing. Re-check the handles if a run fails.
- Episode rows are plain buttons whose accessible name concatenates the number, name and runtime. Match on the `^E1` prefix, not the whole name.
- Marking episodes can unlock achievements, and the `Achievement Unlocked` dialog then covers the page. Dismiss it with `Continue`, as `mark-watched.ts` does.
- A show that is still airing is never auto-removed from watchlists, while an ended show can be. Do not rely on watchlist state here.
- Not proven yet. The season episode counts come from live TMDB.
