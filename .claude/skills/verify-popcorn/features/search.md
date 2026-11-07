# Search

Signed-in users search films and TV shows from `/app/search`. Results arrive as poster cards linking to title pages, and the user can filter by type, genre, year and rating and sort them. With an empty query the page shows a landing view, and a nonsense query shows an empty state.

## Sub-features

- `search-query`: typing debounces for 300 ms, then updates the `?q=` URL and the results grid.
- `search-submit`: pressing Enter or clicking the button `Search` searches immediately.
- `search-filters`: radiogroups `Media type filter`, `Genre filter` and `Minimum rating filter`, plus the textboxes `Year from` and `Year to`.
- `search-clear`: the button `Clear search` resets to the landing view (`q=`).
- `search-invalid-params`: a malformed URL shows "Invalid search parameters" and a `Reset` button.
- `search-focus`: clicking the POPCORN logo or the Search tab focuses the search box.

## How to get to it (user POV)

- The `Search` tab in the header nav, or the POPCORN logo.
- Direct URL: `/app/search?q=<query>&type=all&sort=relevance&page=1`. A magic link also lands here after sign-in.

## Driving it with verify-popcorn

Preconditions:

- `vp doctor` exits 0 and TMDB is reachable.
- There is no journey script yet. Write `journeys/search.ts` using the `vp` API and copy the shape of `mark-watched.ts`, which already drives the first two steps.

- **Query.** Run `vp.goto("/app/search")`, then fill the textbox `Search movies and TV shows` with `The Matrix`. The URL contains `q=The+Matrix`, and `a[href="/app/title/movie/603"]` is visible.
- **Filter.** In the radiogroup `Media type filter`, choose the TV option. The URL contains `type=tv`, and no `a[href^="/app/title/movie/"]` remains.
- **Empty.** Search for `zzqxqzzq`. An empty-results message appears and there are no `a[href^="/app/title/"]` links.
- **Clear.** Click the button `Clear search`. The URL is `q=`, the textbox is empty, and the landing view is back.
- **Proof.** `vp.capture` after each state. This feature has no DB side effects, so the evidence is the URL plus the ARIA snapshot.

## Gotchas

- Wait for the result link or the empty state, never a fixed sleep. Results depend on a 300 ms debounce and a live TMDB call.
- TMDB ranking changes over time. Assert on a stable href, not on result position.
- An invalid `type` or `sort` in the URL renders the error fallback instead of results.
- Not proven yet. The handles come from `src/components/search/*`. The exact accessible names of the filter options and the empty-state text still need to be confirmed with a first run, so update this file after that run.
