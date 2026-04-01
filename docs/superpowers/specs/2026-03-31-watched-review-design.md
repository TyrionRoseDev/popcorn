# Watched & Review Feature — Design Spec

## Overview

Users can log films and TV shows as "watched," creating a journal-style watch event that captures the date, time, optional star rating, and optional written review. Watch events are not toggles — a user can watch the same film multiple times, and each creates a separate entry. The watch count for a title equals the number of watch events for that user.

## Entry Points

### 1. Title Page — "Watched" Arcade Button

The existing cyan arcade button on the title detail page (`/app/title/:mediaType/:tmdbId`). Currently has no click handler.

**On click:**
- Immediately creates a watch event (date/time defaults to now)
- Opens the review modal
- Does NOT affect any watchlist items

### 2. Watchlist — "Mark as Watched" Toggle

The existing eye/check toggle on watchlist item cards.

**On click:**
- Ticks off the item in that specific watchlist (existing behavior)
- Also creates a watch event
- Opens the review modal
- The watch event is independent of the watchlist tick-off

## Review Modal

A center modal (dialog) that appears over the current page after a watch event is created. Uses the app's existing section-board card style with a marquee header.

### Layout

**Marquee header:** Amber-bordered marquee with chasing bulbs. Title text: "Watched". Subtitle: film/show name and year.

**Modal body (single scrollable form, all fields optional):**

1. **Star Rating** — 5 tappable stars with amber glow when lit. Labels "Unwatchable" to "Masterpiece" below the track. A dynamic label shows the current rating text (e.g., "Great Film" for 4 stars).

2. **Review Text** — Freeform text area. Placeholder: contextual hint text.

3. **Watched On (date & time)** — Single pill showing the pre-filled date and time (defaults to when the user clicked "Watched"). Tapping opens a calendar date picker and time picker. The date/time can be changed but defaults are always provided.

4. **Recommend to a Friend** — A pink-bordered row that opens the recommend sub-modal (see below).

**Footer — three paths, all create the watch event:**

- **Save & Done** (cyan button, primary) — Saves the review with whatever the user filled in.
- **Skip** (subtle text link) — Closes the modal. Watch event is saved with just the date/time, no review, no reminder.
- **Remind Me Later** (amber text link) — Closes the modal. Watch event is saved with just the date/time. Schedules a 7-day reminder notification to review.

### Behavior Notes

- If the modal is dismissed (click outside, press Escape), treat it the same as "Skip" — watch event already created, no review, no reminder.
- Star ratings: 1-5 scale. No half stars. Tapping a lit star deselects it (back to no rating).
- Review text has no character limit enforced on the frontend (server can enforce a reasonable max).

## Recommend Sub-Modal

Opened from the "Recommend to a friend" row in the review modal. Pink-themed marquee header.

### Layout

1. **Search field** — Text input with autocomplete that searches the user's friends list by username/display name. Only friends can be recommended to.

2. **Autocomplete results** — Shows matching friends with avatar, display name, and @handle. Clicking selects/deselects.

3. **Selected chips** — Shows selected friends as dismissible chips below the search.

4. **Message (optional)** — Freeform text area for a personal note.

5. **Send Recommendation** (pink button) — Sends the recommendation to all selected friends.

### Recommendation Flow

1. User sends recommendation to one or more friends.
2. Each recipient gets a notification: "[User] recommended [Title] to you" with the optional message.
3. Recipient can **Accept** or **Decline** from the notification.
4. **Accept** — The title is added to the recipient's "Recommendations" watchlist (auto-created per user if it doesn't exist).
5. **Decline** — Nothing happens. No notification sent back to the recommender.
6. If the recipient later watches that title and leaves a **public** review, the recommender gets a notification: "[Recipient] just watched [Title] that you recommended. Click to see their review."

## 7-Day Review Reminder

### Scheduling

When a user clicks "Remind Me Later" in the review modal, a reminder is scheduled for 7 days from now.

**Implementation:** Store a `reviewReminderAt` timestamp on the watch event record. A scheduled cron job (or equivalent) runs periodically, queries for watch events where `reviewReminderAt <= now` and `reviewReminderAt` has not been cleared, creates the reminder notification, and clears the `reviewReminderAt` field.

### Reminder Notification

Appears in the user's notification feed (existing notification bell system).

**Content:** "How was [Title]? You watched it a week ago — leave a quick review."

**Actions:**
- **Leave Review** — Opens the review modal for that watch event, pre-filled with the original date/time. User can change the date/time via calendar picker if desired.
- **Not Now** — Dismisses the notification. No further reminders are sent.

### Reminder Review Modal

Same as the original review modal but:
- The marquee or a badge indicates this is a reminder/late review.
- Date & time are pre-filled with the original watch event date/time.
- Date & time are editable via a calendar date picker and time picker.
- No "Remind Me Later" option — just "Save & Done" and "Skip."
- The review is attached to the original watch event (not a new one).

## Data Model

### New: `watchEvent` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| userId | uuid | FK to user |
| tmdbId | integer | TMDB title ID |
| mediaType | text | "movie" or "tv" |
| titleName | text | Denormalized title name for notifications/display |
| rating | integer | 1-5, nullable |
| reviewText | text | Nullable |
| reviewPublic | boolean | Default true |
| watchedAt | timestamp | When the user watched it (user-provided or auto) |
| reviewReminderAt | timestamp | Nullable. When set, a reminder notification should be sent at this time |
| createdAt | timestamp | When the record was created |
| updatedAt | timestamp | When last modified |

### New: `recommendation` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| senderId | uuid | FK to user who recommended |
| recipientId | uuid | FK to user who received |
| tmdbId | integer | TMDB title ID |
| mediaType | text | "movie" or "tv" |
| titleName | text | Denormalized |
| message | text | Optional personal message |
| status | text | "pending", "accepted", "declined" |
| createdAt | timestamp | |

### New notification types

- `recommendation_received` — "[User] recommended [Title] to you" with accept/decline actions
- `recommendation_watched` — "[User] watched [Title] you recommended. See their review."
- `review_reminder` — "How was [Title]? Leave a review." with review/dismiss actions

### Existing tables affected

- `watchlistItem` — No schema changes. The existing `watched` boolean and `markWatched` mutation continue to work. The mutation is extended to also create a watch event and open the review modal.

### "Recommendations" Watchlist

Auto-created per user on first accepted recommendation. Uses the existing `watchlist` and `watchlistItem` tables. Distinguished by a `type: "recommendations"` field or a reserved name convention. Private by default (only visible to the owner).

## Achievements Integration

The watch event captures `watchedAt` (date and time), which is the data needed for time-based achievements (e.g., "watched a horror film on Halloween"). Achievement-checking logic is on a separate branch.

<!-- TODO: Wire in achievement checks from the achievements branch after merge -->

## Notification Scheduling Infrastructure

The current notification system creates notifications immediately on user action. The 7-day review reminder requires a new scheduling mechanism.

**Approach:** A cron endpoint (`/api/cron/review-reminders`) that:
1. Queries `watchEvent` records where `reviewReminderAt <= now` and `reviewReminderAt IS NOT NULL`
2. Creates a `review_reminder` notification for each
3. Sets `reviewReminderAt = NULL` to prevent re-sending

This endpoint should be called by an external scheduler (Vercel Cron, Railway cron, or similar) every hour.

## Screens Summary

1. **Review Modal** — Center dialog. Stars, review text, date/time pill, recommend button. Footer: Save / Skip / Remind Me Later.
2. **Recommend Sub-Modal** — Pink-themed. Friend search with autocomplete, multi-select chips, optional message, send button.
3. **7-Day Reminder Notification** — In-app notification with "Leave Review" and "Not Now" actions.
4. **Reminder Review Modal** — Same as review modal but pre-filled with original date/time, editable via calendar. No "Remind Me Later" option.

## Out of Scope

- Achievement logic (separate branch, TODO comment for wiring)
- Push notifications (only in-app notification bell for now)
- Review visibility/privacy settings beyond the public boolean
- Review editing after submission
- Review feed/social timeline
