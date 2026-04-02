# Rewatch Feature Design

## Overview

Add the ability to rewatch a show from the tracker. Starting a rewatch preserves all previous episode progress, notes, and reviews, but gives the user a fresh slate to mark episodes and write new notes. Each watch-through is numbered (Watch 1, Rewatch 2, Rewatch 3, etc.).

## Data Model

### Schema Changes

**`userTitle`** — new column:
- `currentWatchNumber` integer, default 1, not null. Tracks the active watch-through.

**`episodeWatch`** — new column:
- `watchNumber` integer, default 1, not null.
- Unique constraint changes from `(userId, tmdbId, seasonNumber, episodeNumber)` to `(userId, tmdbId, seasonNumber, episodeNumber, watchNumber)`.

**`journalEntry`** — new column:
- `watchNumber` integer, default 1, not null. Tags the note to a specific watch-through.

**`watchEvent`** — new column:
- `watchNumber` integer, default 1, not null. Tags the review to a specific watch-through.

All existing rows receive `watchNumber = 1` via the column default. No backfill migration needed.

### Starting a Rewatch

Increment `userTitle.currentWatchNumber` by 1. All subsequent episode marks, journal entries, and watch events use the new number. Old data remains untouched under its original `watchNumber`.

## Rewatch Flow

### Trigger Points

1. **Tracker dashboard card** — on hover, a pink pill "Rewatch" button fades in at the top-left of the card (mirrors the X remove button at top-right). Clicking stops link navigation and opens a confirmation modal.
2. **Show detail page** — a persistent "Rewatch" button in the action bar alongside "Write" and "Mark All". Uses a `RotateCcw` lucide icon. Same pink pill style.

### Confirmation Modal

Two variants based on completion state:

**Completed show:**
> "Start rewatching **{title}**?"
> "Your progress and notes from Watch 1 are saved. You'll start fresh tracking episodes again."
> [Cancel] [Start Rewatch]

**Incomplete show** (missing episodes or still airing):
> "Start rewatching **{title}**?"
> "You haven't finished this show yet — you've watched {n} of {total} episodes. Your progress is saved but you'll be starting a fresh watch-through."
> [Cancel] [Start Rewatch Anyway]

### On Confirm

- `userTitle.currentWatchNumber` increments by 1 (server mutation).
- Progress bar resets to 0% (now filtering by the new `watchNumber`).
- All episode cards return to unwatched state.
- Old notes/reviews remain visible, tagged with their watch-through label.
- Toast: "Rewatch started — you're on Watch 2" (or appropriate number).

## UI: Tracker Dashboard Card

### Hover Button

- Appears on hover alongside the existing X remove button.
- Position: top-left of the card.
- Style: `bg-neon-pink/15 border border-neon-pink/30 text-neon-pink`, rounded-full, `text-[9px] font-mono-retro tracking-wider uppercase`.
- `e.preventDefault()` + `e.stopPropagation()` to prevent card link navigation.

### Rewatch Badge

- When `currentWatchNumber > 1`, a small badge appears in the metadata area: "Watch 2", "Rewatch 3", etc.
- Pink-tinted style to distinguish from the status badge.
- Progress bar and episode counts reflect only the current watch-through's data.

## UI: Show Detail Page

### Action Bar Button

- Sits alongside "Write" and "Mark All" buttons.
- Pink pill: `border border-neon-pink/20 text-neon-pink hover:bg-neon-pink/10`, rounded-full, `RotateCcw` icon.
- Always visible (not hover-dependent).

### Watch-Through Switcher

- Only rendered when `currentWatchNumber > 1`.
- Horizontal pill group below the progress bar area.
- Active pill: `bg-neon-pink/15 text-neon-pink border-neon-pink/30`.
- Inactive pills: `text-cream/30 border-cream/10 hover:text-cream/50`.
- Defaults to the current (latest) watch-through.
- Switching changes which `watchNumber` the episode grid, progress bar, and stats filter on.
- Viewing an older watch-through makes the episode grid **read-only** — episodes are visible but not toggleable. A subtle "Viewing Watch 1" label in `text-cream/25` clarifies the state.

### Episode Grid

- Filters `episodeWatch` rows by the selected `watchNumber`.
- Marking/unmarking only works on the current (latest) watch-through.
- Progress stats (count, percentage, bar color) recalculate per selected watch-through.

## UI: Notes & Reviews

### Watch-Through Labels

- Every timeline item (note or review) gets a small badge: "Watch 1", "Rewatch 2", "Rewatch 3", etc.
- Badge style: `bg-neon-pink/[0.06] text-neon-pink/40 text-[9px] font-mono-retro`.
- Positioned in the top row alongside the existing scope badge and timestamp.

### Display Behavior

- Notes from **all** watch-throughs are shown together chronologically (newest first), regardless of which watch-through is selected in the switcher.
- The watch-through badge is the visual differentiator.

### Writing New Notes

- New journal entries and reviews automatically receive the current `userTitle.currentWatchNumber`.
- No extra UI for selecting which watch-through to write under.

## Query Changes

### `episodeTracker.getForShow`
- Accepts optional `watchNumber` parameter.
- Defaults to the user's `currentWatchNumber` from `userTitle`.
- Returns only episodes matching that `watchNumber`.

### `episodeTracker.markEpisodes`
- Uses `currentWatchNumber` from `userTitle` when inserting `episodeWatch` rows.

### `episodeTracker.getTrackedShows`
- Dashboard query filters episode counts by each show's `currentWatchNumber`.
- Includes `currentWatchNumber` in the response for badge display.

### `journalEntry.create` / `watchEvent.create`
- Automatically tag with `currentWatchNumber`.

### `journalEntry.getForShow` / `watchEvent.getForTitle`
- Return all entries across all watch-throughs (no filter).
- Include `watchNumber` in the response for badge rendering.
