# Shared Watching & Privacy

Reciprocal watch events for companions, three-tier visibility, and inline episode review prompts.

## Problem

When User A watches something with User B and logs it, only User A gets a watch event. User B receives a notification but has no event on their profile. Additionally, the `reviewPublic` field on watch events exists in the schema but is completely unused — there's no UI to set it and no query filtering on it.

Separately, marking episodes as watched in the tracker has no review prompt, so episode-level reviews require a separate manual flow.

## Features

### 1. Reciprocal Watch Events

When a user creates a watch event with linked friend companions, a **reciprocal watch event** is automatically created for each companion.

**Reciprocal event characteristics:**
- View-only — shows the original reviewer's review (rating + note) as attributed content
- Owned by the companion (`userId` = companion's ID)
- Links back to the original via `originEventId` (nullable FK on `watchEvent`, `SET NULL ON DELETE`)
- Copies `tmdbId`, `mediaType`, `titleName`, `posterPath`, `scope`, `scopeSeasonNumber`, `scopeEpisodeNumber`, `genreIds`, `watchNumber`, `watchedAt` from the original
- `rating` and `reviewText` are null (companion hasn't reviewed)
- `visibility` defaults to `'public'`
- Free-text companions (no `friendId`) do not get reciprocal events

**Dedup rule:** Before creating a reciprocal event, check if the companion already has a watch event for the same `tmdbId` + `scope` + `scopeSeasonNumber` + `scopeEpisodeNumber` + `watchNumber`. If one exists, skip creation.

**Upgrade flow:** If a companion has a reciprocal event and later creates their own full watch event for the same title+scope, delete the reciprocal and create the authored event.

### 2. Reciprocal Event Lifecycle

**Creation (in `watchEvent.create`):**
1. Create the primary watch event as today
2. For each companion with a `friendId`:
   - Run dedup check
   - If clear, create reciprocal event row with `originEventId` set
   - Send appropriate notification

**Update (in `watchEvent.update`):**
- Original review changes don't require updating reciprocal rows — reciprocal events fetch the original's review at read time via `originEventId`
- If companions are added/removed, create/delete reciprocal events accordingly

**Deletion:**
- Original event deleted → `originEventId` on reciprocal events set to null (FK cascade: `SET NULL`)
- Reciprocal persists as a bare watch log: "Watched [Title] with [User A]", no review attribution
- Companion relationship data (`watchEventCompanion`) stays intact on the reciprocal event

### 3. Three-Tier Visibility

Replace `reviewPublic` (boolean, default true) with `visibility` (text enum, default `'public'`).

**Values:**
- `public` — visible to all friends in feeds and profiles
- `private` — visible only to the event owner
- `companion` — visible to the owner and the companions on that event

**Query filtering:**
- Feed (`getFeed`): exclude `private` events (unless own); exclude `companion` events (unless viewer is owner or a companion on that event)
- Profile (`getUserEvents`, `getForTitle`): same rules apply
- Private events show a lock icon and muted border so the owner knows at a glance
- Companion-only events show a people icon with "Shared" badge

**Privacy on reciprocal events:**
- Each user controls their own event's visibility independently
- Review content from the original is gated by the original's visibility:
  - Original is `public` → review shown on reciprocal
  - Original is `companion` → review shown only to the reciprocal owner (the companion)
  - Original is `private` → review never shown on the reciprocal

### 4. Notifications

**Two notification variants based on whether the original event has a review:**

- **Has review (`companion_reviewed`):** "[User] shared their thoughts on [Title] that you watched together — add yours?"
  - Links to the title page
  - For TV: includes a "Mark in tracker?" action
- **No review (`watched_with`):** "[User] watched [Title] with you"
  - Informational only, no review nudge

**TV tracker prompt in notification:**
- "Mark in tracker?" action on companion notifications for TV shows
- Accepting adds the show to the companion's `userTitle` (if not already there) and marks the relevant episodes as watched in `episodeWatch`

### 5. Inline Episode Review Prompt (TV Only)

When a user marks an episode as watched in the tracker:

1. Episode is marked watched (mutation fires as normal)
2. A small popup appears: "Add thoughts on S2E5?" with Yes / Dismiss
3. **Yes** → full review modal opens, pre-scoped to the episode (`scope: 'episode'`, `scopeSeasonNumber`, `scopeEpisodeNumber` pre-filled)
4. **Dismiss** → popup closes, no watch event created (just the `episodeWatch` row as today)

**Batch marking:** If multiple episodes are marked at once, only show the prompt for the last episode in the batch.

**Films:** No change. Marking a film as watched continues to open the review modal directly.

### 6. UI Components

**Review modal — visibility selector:**
- Three-button segmented control below the companion selector: Public / Shared / Private
- Public selected by default
- "Shared" option is visually disabled (grayed out, not clickable) when no companions are selected

**Watch event card changes:**
- Private events: lock icon badge in top-right, muted border (`cream/0.08` instead of `neon-amber/20`)
- Companion-only events: people icon badge in top-right with "Shared" label, cyan-tinted border
- Reciprocal events: amber-bordered attribution block showing "[Original reviewer]'s review" with their stars and note text, visually distinct from the owner's own review style (amber left border instead of cyan)

**Episode card — no changes to the card itself.** The popup is a separate toast/dialog component triggered after the mark mutation succeeds.

## Data Model Changes

### `watchEvent` table

| Change | Before | After |
|--------|--------|-------|
| `reviewPublic` | `boolean`, default `true` | **Remove** |
| `visibility` | — | `text`, default `'public'`, values: `'public'` \| `'private'` \| `'companion'` |
| `originEventId` | — | `text`, nullable FK → `watchEvent.id`, `SET NULL ON DELETE` |

### Migration

- Map existing `reviewPublic = true` rows to `visibility = 'public'`
- Map existing `reviewPublic = false` rows to `visibility = 'private'`
- All existing events get `originEventId = null`

## Applies To

Both movies and TV shows. All reciprocal event, privacy, and companion features work identically for films and TV. The inline episode review prompt is TV-only.
