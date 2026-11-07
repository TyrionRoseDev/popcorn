# Watchlists

Users keep any number of watchlists. Each user has a default `My Picks` list, created lazily. They can create custom lists, which can be public or private and can include friends as members, and they add titles from a title page or a poster card. `/app/watchlists` shows every list as a reel, and `/app/watchlists/<id>` shows one list.

## Sub-features

- `wl-create-page`: on `/app/watchlists`, click `New Watchlist`, which opens the dialog `Create New Watchlist`. Enter a name, then click `Create`.
- `wl-create-from-title`: the Watchlist arcade button opens the `Add to Watchlist` popover. `Create New Watchlist` opens the same dialog and adds the current title to the new list.
- `wl-add`: the Watchlist popover lists each watchlist as a button. Clicking one shows the toast `Added to <name>`.
- `wl-visibility`: a switch (`aria-checked`) toggles between `Private — members only` and `Public — anyone can view`.
- `wl-members`: inside the create dialog, the user can search `Search username...` to invite friends (for example `felixfriend`).
- `wl-detail`: open a list to see its items.

## How to get to it (user POV)

- The `Watchlists` tab, which opens `/app/watchlists`.
- The Watchlist arcade button on any title page `/app/title/<type>/<id>`.
- The hover `AddToWatchlistDropdown` on search poster cards.

## Driving it with verify-popcorn

Preconditions:

- `vp doctor` exits 0. Vera has no custom watchlists.
- There is no journey script yet. Write `journeys/watchlists.ts`.

- **Create from page.** Run `vp.goto("/app/watchlists")`, click the button `New Watchlist`, fill the placeholder `e.g. Friday Night Horror` with `Verify Night`, then click `Create`. The dialog closes and a reel titled `Verify Night` appears. `vp.sql("select name, type, is_public from watchlist where owner_id='vp-user-vera'")` contains `Verify Night	custom	f`.
- **Add from title.** Run `vp.goto("/app/title/movie/603")`. Click the arcade button labelled `Watchlist` (`div.text-center:has(text "Watchlist") >> role=button`), then click the popover button `Verify Night`. The toast `Added to Verify Night` appears and the arcade button becomes active.
- **Persistence.** Open `Verify Night` from `/app/watchlists`. The Matrix poster appears. `vp.sql("select wi.tmdb_id from watchlist_item wi join watchlist w on w.id=wi.watchlist_id where w.name='Verify Night'")` returns `603`.
- **Proof.** Capture the dialog, the toast, the list detail, and `db.log`.

## Gotchas

- `New Watchlist` animates its text in letter by letter, so wait for the button to be visible and enabled rather than matching on partial text.
- `My Picks` (`type='default'`) and `Recommendations` cannot be deleted or invited into. Do not use them for the delete or invite paths.
- The popover lists `shuffle` lists too. Match the list by its exact name.
- Not proven yet. The selectors come from `create-watchlist-dialog.tsx`, `title-actions.tsx` and `routes/app/watchlists/index.tsx`.
