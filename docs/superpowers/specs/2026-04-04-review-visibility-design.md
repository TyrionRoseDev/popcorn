# Review Visibility

Allow users to control who can see their review (rating + text) when logging a watch event.

## Visibility Levels

| Level | Who sees the review | When available |
|-------|-------------------|----------------|
| **Public** | All friends | Always |
| **Companion** | Only you + your companions | When at least one companion is added (friend or freetext) |
| **Private** | Only you | Always |

Visibility controls **only the review content** (rating and review text). The watch event itself always appears in the feed regardless of visibility — it just looks as if no review was left when the viewer doesn't have access.

No indication is shown to friends that a hidden review exists.

## UI

### Selector placement

The visibility selector sits just above the "Save & Done" button in the review modal — the last step before submitting.

### Selector style

Stacked card radio group. Each option is a row with an icon, label, short description, and a radio indicator on the right. The selected option gets a cyan border glow matching the existing modal aesthetic.

### Dynamic options

- **Default state (no companions):** Public and Private shown
- **With companions:** Public, Companion, and Private shown
- Companion appears/disappears dynamically as companions are added/removed
- If Companion was selected and all companions are removed, selection resets (user must pick again)

### Required field

No default value — the user must explicitly choose visibility each time. The "Save & Done" button is disabled until a visibility is selected.

### Edit mode

When editing an existing watch event, the selector loads the saved visibility value.

## Schema

Replace the existing `reviewPublic` boolean on the `watchEvent` table with a `visibility` text enum column.

```
visibility: text("visibility").notNull()  // "public" | "companion" | "private"
```

Migrate existing data:
- `reviewPublic = true` → `visibility = "public"`
- `reviewPublic = false` → `visibility = "private"`

The dedicated `review` table does not need a visibility field — it is not used in the feed system.

## Backend

### Watch event creation/update

- The `watchEvent.create` and `watchEvent.update` mutations accept a `visibility` field (required on create, optional on update)
- Validation: `z.enum(["public", "companion", "private"])`

### Feed query

The feed query (`watchEvent.getFeed`) must strip review content based on the viewer's access:

```
For each watch event in the feed:
  if visibility = "public" → show rating + review text
  if visibility = "companion" → show rating + review text ONLY IF viewer's userId matches a companion's friendId
  if visibility = "private" → show rating + review text ONLY IF viewer is the event owner
  otherwise → return rating and review text as null
```

This filtering happens server-side — private review content never reaches the client for unauthorized viewers.

### Companion access check

A viewer has companion access if their userId matches any `friendId` in the watch event's companions array. Freetext companions (no `friendId`) cannot match any viewer, so companion-visibility with only freetext companions effectively behaves as private.

### Notification gating

The existing notification logic in `watched.ts` (`updateReview`) already checks `reviewPublic` before notifying recommenders. Update this to check `visibility === "public"` instead.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Freetext-only companions, Companion selected | Effectively private — no app user can match. Option still shown for simplicity. |
| User adds companion, selects Companion, then removes all companions | Selection resets; user must pick Public or Private |
| Watch event with rating but no review text | Visibility still applies — rating is hidden too |
| Watch event with no rating and no review text | Visibility selector still shown, but nothing to hide in practice |
| Existing watch events (migration) | `reviewPublic=true` → public, `reviewPublic=false` → private |
| "Remind me later" / "Skip" flows | Defaults to `public` (matches current behavior where all events are public). User sets visibility when they come back to review. |
