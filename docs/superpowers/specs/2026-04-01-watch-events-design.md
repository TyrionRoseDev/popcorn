# Watch Events — Journal Model, Edit/Delete, Activity Feed

## Overview

Replace the current `review` table and `watched` boolean toggle with a proper **watch event journal**. Each watch event captures a specific viewing experience — date, time, rating, note, and who you watched with. Users can log multiple watch events per title (re-watches). Watch events can be edited and deleted.

A new **Activity Feed** page shows a chronological stream of friends' activity (watch events, watchlist creations) with a dropdown to filter to just your own.

## Data Model

### New table: `watch_event`

| Column | Type | Notes |
|--------|------|-------|
| id | text (nanoid) | Primary key |
| userId | text | FK → user |
| tmdbId | integer | TMDB title ID |
| mediaType | text | "movie" \| "tv" |
| rating | integer (nullable) | 1–5 stars, optional |
| note | text (nullable) | Review / thoughts |
| watchedAt | timestamp | When they watched it (user-editable, defaults to now) |
| createdAt | timestamp | When the record was created (system) |

No unique constraint — multiple events per user per title is expected (re-watches).

### New table: `watch_event_companion`

| Column | Type | Notes |
|--------|------|-------|
| id | text (nanoid) | Primary key |
| watchEventId | text | FK → watch_event (cascade delete) |
| friendId | text (nullable) | FK → user. Null if free text. |
| name | text | Always set. Friend's display name or typed text (e.g., "mam") |

- Linked friend: `friendId = "user_abc"`, `name = "Sarah"`
- Free text: `friendId = null`, `name = "mam"`
- Notifications only sent for companions where `friendId` is not null.

### Migration from `review` table

1. Create `watch_event` and `watch_event_companion` tables.
2. Migrate existing `review` rows → `watch_event` rows:
   - `review.rating` → `watch_event.rating`
   - `review.text` → `watch_event.note`
   - `review.createdAt` → `watch_event.watchedAt` and `watch_event.createdAt`
   - `review.userId` → `watch_event.userId`
   - `review.tmdbId` → `watch_event.tmdbId`
   - `review.mediaType` → `watch_event.mediaType`
3. Drop the `review` table and remove its schema definition.
4. Update all queries that reference `review` to use `watch_event`.

### Derived values

- **"Your rating" for a title** = most recent watch event's rating for that user + title (where rating is not null).
- **Watch count for a title** = count of watch events for that user + title.
- **Watch time minutes** = sum of runtime across all unique watched titles (deduplicated by tmdbId + mediaType, using the watchlist_item.runtime field).

## Backend — tRPC Procedures

### New procedures (watchEvent router or within watchlist router)

- **`createWatchEvent`** — Create a watch event with optional rating, note, watchedAt, and companions (array of `{ friendId?: string, name: string }`).
  - Inserts `watch_event` row.
  - Inserts `watch_event_companion` rows.
  - Sends `watched_with` notification to each companion with a non-null `friendId`.
  - Sends `item_watched` notification to watchlist members (existing behavior).

- **`updateWatchEvent`** — Edit a watch event. User can change rating, note, watchedAt, and companions.
  - Only the owner (`userId`) can edit.
  - Replaces companion rows (delete all, re-insert).
  - New companions with `friendId` get notifications; removed companions do not get un-notified.

- **`deleteWatchEvent`** — Delete a watch event.
  - Only the owner can delete.
  - Cascade deletes companion rows.
  - If this was the last watch event for that title across the user's watchlists, unmark the corresponding `watchlist_item.watched` as false.
  - Clean up related notifications.

- **`getWatchEvents`** — Get watch events for a user + title (for the title page history section). Returns events with companions, ordered by `watchedAt` desc.

- **`getUserWatchEvents`** — Get all watch events for a user (for the profile diary tab). Paginated, ordered by `watchedAt` desc.

- **`getFeed`** — Get activity feed. Returns a chronological list of events from the user and their friends. Supports a `filter` parameter: `"all"` (default) or `"mine"`.
  - Event types in feed: watch events and watchlist creations.
  - Paginated (cursor-based or offset).
  - Each feed item includes: actor info (name, avatar), event type, event data, timestamp.
  - Watch event items: title, rating, note, companions, watchedAt.
  - Watchlist creation items: watchlist name, item count, createdAt.

### Modified procedures

- **`quickMarkWatched`** — Instead of just toggling a boolean, this now also opens the watch event modal. When marking as watched: creates a `watch_event`. When un-marking: if there are watch events, prompt to confirm (since deleting watch events is destructive). The toggle behavior stays for the watchlist item's `watched` boolean.

- **`markWatched`** (watchlist context) — Same change: marking watched creates a watch event via the modal. Unmarking toggles the boolean back.

- **`getReview`** → replaced by reading the most recent `watch_event` with a rating for that user + title.

- **`getUserReviews`** → replaced by `getUserWatchEvents`.

- **`submitReview`** → removed. The watch event modal handles this now.

### New notification type

- `"watched_with"` — "Sarah watched Interstellar with you". Data: `{ titleName, tmdbId, mediaType, watchEventId }`.

## UI Components

### Watch Event Modal (modified `review-modal.tsx`)

The existing review modal stays structurally the same. Changes:

- Add a **"Watched with…"** button below "Recommend to a friend", styled identically but cyan-themed with a 👥 icon.
- Tapping it opens a **Watched With Modal** (similar to `recommend-modal.tsx`):
  - Search input that searches friends and also offers "Add [typed text] as text" at the bottom.
  - Selected companions shown as chips: cyan for linked friends, amber for free text.
  - Chips are removable (✕ button).
  - "Done" button returns to the watch event modal with companions set.
- The modal now creates a `watch_event` instead of a `review`.
- When opened for editing, all fields are pre-filled with the existing watch event data.
- Date/time picker is always visible (defaults to now on create). Users can backdate if logging a past viewing.

### Watch Event Card

A reusable card component for displaying a watch event. Used in:
- Profile diary tab
- Title page watch history
- Activity feed

Shows: title (when needed), star rating, date, companions ("with Sarah, mam"), note snippet. Has a `⋯` overflow menu on the user's own events with Edit and Delete options.

### Title Page — Watch History Section

Below the action buttons on the title detail page, if the user has watch events for this title, show a compact list:
- Each row: date, stars, note snippet, companions, `⋯` menu.
- Ordered by `watchedAt` desc (most recent first).
- If no events, section is hidden.

### Profile Page — Diary Tab

Rename "Reviews" tab to **"Diary"**. Shows all the user's watch events across all titles, ordered by `watchedAt` desc. Uses the watch event card component. The `⋯` menu only appears when viewing your own profile.

### Activity Feed Page (`/app/feed`)

A new top-level page with its own entry in the app navbar.

- **Default view**: mixed chronological feed of the user's activity and friends' activity.
- **Dropdown filter** (small, top-right): "Everyone" (default) / "Just Me".
- Each feed item shows: avatar, "[Name] watched [Title]", star rating, note, companions, relative timestamp.
- The `⋯` menu appears only on your own events.
- Two event types at launch: **watch events** and **watchlist creations**. The feed item shape uses a `type` discriminator for extensibility.
- Watchlist creation items show: "[Name] created [Watchlist Name]" with item count.
- Paginated with infinite scroll or "load more" button.

### Notification rendering

Add rendering for the `"watched_with"` notification type: "[Name] watched [Title] with you" with a link to the title page.

## Edit & Delete Flows

### Edit

1. User taps `⋯` → "Edit" on a watch event (from diary, title page, or feed).
2. The watch event modal opens pre-filled with the event's data (rating, note, companions).
3. Date/time fields are visible in edit mode.
4. On save, calls `updateWatchEvent`.
5. Optimistic UI update.

### Delete

1. User taps `⋯` → "Delete" on a watch event.
2. Confirmation dialog: "Delete this watch event? This can't be undone."
3. On confirm, calls `deleteWatchEvent`.
4. If it was the last watch event for that title in a watchlist, the watchlist item gets unmarked as watched.
5. Optimistic UI removal with toast: "Watch event deleted".

## Scope boundaries

**In scope:**
- `watch_event` and `watch_event_companion` tables + migration
- `review` table migration and removal
- Watch event CRUD (create, read, update, delete)
- Watched With modal (friend search + free text)
- `watched_with` notification type
- Profile diary tab (replaces reviews tab)
- Title page watch history section
- Activity feed page with navbar entry and dropdown filter
- Edit and delete flows with `⋯` menu

**Out of scope (for now):**
- Feed event types beyond watch events and watchlist creations (recommendations, friend requests, etc.)
- Activity heatmap / calendar visualization
- Public/private toggle on individual watch events
- Watch event reactions or comments from friends
