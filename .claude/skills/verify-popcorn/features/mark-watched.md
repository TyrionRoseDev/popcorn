# Mark a film watched

A signed-in user finds a film, opens its title page and presses **Watched**. A review modal opens where they rate, note and set visibility, then save. The title page then shows "Your Watch History", the film counts as watched in their default watchlist (`My Picks`), and a first watch unlocks the "First Watch" achievement popup.

## Sub-features

- `watched-toggle`: Watched marks the film watched (toast `Marked as watched`) and lights up the button.
- `watched-review`: the review modal (dialog `Review`) accepts a star rating, note, date, companions and visibility, and saves with `Save & Done`.
- `watched-skip`: Skip or "remind me later" closes the modal without a rating. No script yet.
- `watched-history`: after a reload, "Your Watch History" lists the event with its note.
- `watched-achievement`: the first ever watch shows the `Achievement Unlocked` dialog with `First Watch`.
- `watched-untoggle`: pressing Watched again shows `Removed from watched`. No script yet.

## How to get to it (user POV)

- Search: type in `Search movies and TV shows` on `/app/search`, then click the poster link.
- Direct URL: `/app/title/movie/<tmdbId>`.
- Other entry points to the title page (feed, watchlists, profile) are not scripted.

## Driving it with verify-popcorn

Preconditions:

- A fresh run (`vp up`, `vp doctor` exits 0). Vera has no `watch_event` for the film. The journey asserts this.
- TMDB is reachable. The default film is The Matrix, `603`.

- **Search.** Run `vp drive mark-watched`. It fills the textbox `Search movies and TV shows` with `The Matrix`. The link `a[href="/app/title/movie/603"]` appears.
- **Open title.** Click that link. The URL is `/app/title/movie/603` and the marquee reads `THE MATRIX`.
- **Press Watched.** Use `div.text-center:has(text "Watched") >> role=button`. The toast `Marked as watched` appears, and the dialog named `Review` opens.
- **Review.** Click the button `Rate 4 stars`, fill the placeholder `Share your thoughts…`, click the button whose name starts with `Public`, then click `Save & Done`. The `Review` dialog closes.
- **Achievement.** The dialog `Achievement Unlocked` shows `First Watch`. Click `Continue`.
- **Persistence.** Reload. `Your Watch History` and the note text are visible.
- **Side effects.** `db.log` shows one `watch_event` (`rating=4`, the note, `visibility=public`), the `My Picks` item (`watchlist.type='default'`) with `watched=t`, and `earned_achievement` containing `first-watch`.
- **Proof.** Evidence is in `evidence/<RUN_ID>/mark-watched/`: `02-search-results` through `08-title-after-reload` (PNG plus ARIA), `trace.zip` and `db.log`. Other films: `vp drive mark-watched <tmdbId> "<query>"`.

## Gotchas

- Watched on a **TV** title does not open the review modal. It adds the show to the tracker and navigates to `/app/tracker/<id>` (see `tracker.md`).
- The arcade buttons have no accessible name. `getByRole("button", { name: "Watched" })` finds nothing.
- `Save & Done` stays disabled until you pick a visibility.
- The achievement popup appears only on the first qualifying watch in a run. In a run that already has watches it will not appear, and waiting for it will time out. Start a fresh run instead.
- The default watchlist removal prompt (`WatchlistRemovalDialog`) can appear after closing the review when the film is in more than one watchlist. The baseline seed never triggers it.
