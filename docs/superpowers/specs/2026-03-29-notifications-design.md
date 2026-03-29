# Notification Dropdown & Icon — Design Spec

## Overview

Add a notification system to Popcorn with a bell icon in the navbar and a dropdown showing recent notifications. Notifications are created server-side when actions occur and polled by the client every 30 seconds.

## Notification Types

| Type | Trigger | Message | Actions |
|------|---------|---------|---------|
| `watchlist_invite` | User invited to a watchlist | "X invited you to Y" | Accept / Decline |
| `watchlist_item_added` | Item added to a shared watchlist | "X added Y to Z" | — |
| `watchlist_member_joined` | New member joins a watchlist | "X joined Y" | — |
| `shuffle_match` | Two members both swiped yes | "You and X both want to watch Y!" | — |
| `friend_request` | Someone sends a friend request | "X has added you as a friend" | Accept / Decline |
| `title_reviewed` | Someone reviews a title you recommended | "X just reviewed Y" | View review |
| `item_watched` | Item marked as watched in your watchlist | "X marked Y as watched in Z" | View reviews |

## Database Schema

Single `notification` table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `recipientId` | `text` | FK → `user.id`, cascade delete |
| `actorId` | `text` | FK → `user.id`, cascade delete |
| `type` | `text` | One of the notification type values above |
| `data` | `jsonb` | Type-specific payload (see below) |
| `read` | `boolean` | Default `false` |
| `actionTaken` | `text` | Nullable — `accepted`, `declined`, or `null` |
| `createdAt` | `timestamp` | Default `now()` |

### `data` Payloads by Type

- **`watchlist_invite`**: `{ watchlistId: string, watchlistName: string }`
- **`watchlist_item_added`**: `{ watchlistId: string, watchlistName: string, titleName: string, tmdbId: number, mediaType: string }`
- **`watchlist_member_joined`**: `{ watchlistId: string, watchlistName: string }`
- **`shuffle_match`**: `{ watchlistId: string, titleName: string, tmdbId: number, mediaType: string }`
- **`friend_request`**: `{}`
- **`title_reviewed`**: `{ titleName: string, tmdbId: number, mediaType: string }`
- **`item_watched`**: `{ watchlistId: string, watchlistName: string, titleName: string, tmdbId: number, mediaType: string }`

## tRPC Router — `notification`

### Queries

- **`getAll`** — Returns all notifications for the current user from the last 20 days, ordered newest first. Joins with user table to include actor's `username` and `avatarUrl`. Only fetched when the dropdown is opened.
- **`getUnreadCount`** — Returns the count of unread notifications (last 20 days). Polled every 30 seconds via React Query's `refetchInterval`.

### Mutations

- **`markAsRead`** — Input: `{ id: string }`. Marks a single notification as read.
- **`markAllAsRead`** — Marks all unread notifications for the current user as read.
- **`delete`** — Input: `{ id: string }`. Deletes a single notification.
- **`deleteAll`** — Deletes all notifications for the current user.
- **`respondToInvite`** — Input: `{ id: string, response: "accepted" | "declined" }`. Updates `actionTaken` on the notification. If accepted, adds the user as a member of the watchlist.
- **`respondToFriendRequest`** — Input: `{ id: string, response: "accepted" | "declined" }`. Updates `actionTaken` on the notification. If accepted, creates the friendship record.

### Helper — `createNotification()`

Shared function that other routers call to create notifications:

```ts
createNotification({
  recipientId: string,
  actorId: string,
  type: NotificationType,
  data: Record<string, unknown>,
})
```

Called from existing routers:
- `watchlist.addItem` → `watchlist_item_added` for all other watchlist members
- `watchlist.inviteMember` → `watchlist_invite` for the invited user
- Shuffle match logic → `shuffle_match` for both users
- `watchlist.markWatched` → `item_watched` for other watchlist members
- Friend request procedure → `friend_request` for the recipient
- Review procedure → `title_reviewed` for the recommender

## Frontend Components

### `NotificationBell`

- Location: Navbar, immediately left of user avatar
- Icon: Lucide `Bell`, styled in `cream/50` to match nav links, `neon-cyan` when dropdown is open
- Badge: Unread count displayed in a small circle (neon-pink background, white text). Hidden when count is 0.
- Trigger: Opens a Radix `Popover` on click

### `NotificationDropdown` (Popover content)

- **Header:** "Notifications" title (left) + "Mark all read" link (right, `cream/40`)
- **List:** Scrollable area, max ~400px height
- **Empty state:** "No notifications" centered text
- **Footer:** "Delete all notifications" link in neon-pink

### `NotificationItem`

- **Layout:** Avatar | Message + timestamp + actions | Dismiss button
- **Unread style:** Cyan left-border (2px), subtle `neon-cyan/4` background
- **Read style:** No left-border, no background tint
- **Avatar:** Actor's avatar (32px circle), or 🎉 emoji for shuffle matches
- **Message:** Bold actor name and entity names, regular weight for connecting text. 13px.
- **Timestamp:** Relative time ("2 min ago", "Yesterday"), 11px, `cream/35`
- **Dismiss:** × button on the right, `cream/20`
- **Action buttons:** Inline below message text for actionable types:
  - Accept: `neon-cyan/15` background, `neon-cyan` text
  - Decline: `cream/6` background, `cream/50` text
  - View review: Same style as Accept
- **Click behavior:** Non-actionable notifications mark as read and navigate to the relevant page (watchlist, title, etc.)

### Polling Strategy

- `getUnreadCount` polled every 30 seconds via `refetchInterval: 30000`
- `getAll` fetched on popover open, invalidated on mutations (mark read, delete, respond)
- No WebSocket/SSE infrastructure needed

## Lifecycle

- Notifications auto-expire after 20 days (filtered at query time, not deleted by cron)
- Users can dismiss individual notifications or delete all
- Actionable notifications (invites, friend requests) show accept/decline buttons until acted upon; once acted upon, the buttons are replaced with the result text ("Accepted" / "Declined")
