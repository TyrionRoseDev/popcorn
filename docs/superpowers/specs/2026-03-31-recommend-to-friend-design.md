# Recommend to Friend — Design Spec

## Overview

Users can recommend movies/TV shows to friends. Recommendations are sent as notifications with an optional message. Accepting a recommendation adds the title to a dedicated "Recommendations" watchlist. When the recipient watches and publicly reviews a recommended title, the recommender is notified.

## Data Model

### `recommendation` table (exists in schema, needs migration)

Existing fields: `senderId`, `recipientId`, `tmdbId`, `mediaType`, `createdAt`.

Add:
- `message` — text, nullable. Optional note from the sender (max 150 characters).

### `watchlist` table changes

Add `type` column: `"default" | "recommendations"`.
- Defaults to `"default"` for all existing and new user-created watchlists.
- Each user gets exactly one `"recommendations"` type watchlist, auto-created on first accepted recommendation.

### `watchlist_item` table changes

Add:
- `recommendedBy` — nullable, references `user.id`. Who recommended this item.
- `recommendationMessage` — text, nullable. The message sent with the recommendation.

## Send Flow

### Entry point

The existing Send/Invite button on the title page (`title.$mediaType.$tmdbId.tsx`). Currently has no onClick handler.

### Popup UI

- Small modal overlay (consistent with existing invite-member-modal style).
- Text input at top with autocomplete — searches accepted friends by username.
- Multi-select — selected friends appear as chips/tags below the input.
- Optional message text field (150 character limit).
- "Send" button.

### On send

1. Insert one `recommendation` row per selected recipient.
2. Create a `recommendation_received` notification for each recipient containing: sender info, title name, media type, tmdbId, and the optional message.
3. Trigger achievement evaluation for the sender ("Word of Mouth").

### Constraints

- Only accepted friends appear in search results.
- Non-friends cannot send recommendations.
- Duplicate recommendations to the same friend are allowed.

## Receive Flow

### Notification

- New type: `recommendation_received`.
- Display: "[Sender] recommended [Title]" plus the optional message.
- Two action buttons: **Accept** and **Decline**.

### Accept

1. Find or auto-create the user's "Recommendations" watchlist (type `"recommendations"`).
2. Add the title as a watchlist item with `recommendedBy` and `recommendationMessage` set.
3. Dismiss the notification.

### Decline

- Silently dismisses the notification.
- No notification sent to the sender.

## Recommendations Watchlist

- Standard watchlist UI — same film reel cards, same layout as all other watchlists.
- Items display a "Recommended by [username]" label and the message if present.
- Additional sort option: "Sort by recommender" — groups items by who recommended them.
- System-managed: user cannot delete or rename it. Other users cannot be invited as members.

## Review Feedback Loop

When a user watches, logs, and publicly reviews a title that exists in their Recommendations watchlist with a `recommendedBy` value:

1. Send a `recommendation_reviewed` notification to the original recommender with a link to the review.
2. Trigger achievement evaluation for the recommender ("Trusted Critic", "Good Taste").
3. Trigger achievement evaluation for the reviewer (general watch/review achievements).

No notification if:
- The review is private.
- The title was not in the Recommendations watchlist or has no `recommendedBy`.

## Notification Types (new)

| Type | Recipient | Content |
|------|-----------|---------|
| `recommendation_received` | Friend | "[Sender] recommended [Title]" + message. Accept/Decline buttons. |
| `recommendation_reviewed` | Recommender | "[User] watched [Title] and left a review" with link to review. |

## Achievements (already defined)

- **Word of Mouth** — send 1 recommendation (sender, on send).
- **Trusted Critic** — friend watches your recommendation (recommender, on review).
- **Good Taste** — friend rates your recommendation 4+ stars (recommender, on review).
