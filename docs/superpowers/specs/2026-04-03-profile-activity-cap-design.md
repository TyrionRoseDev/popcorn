# Profile Activity Cap + Feed User Filter

**Date:** 2026-04-03

## Problem

The profile page's tabbed sections (Activity, Journal, Watchlists) grow unbounded. There's no way to view a specific user's full activity on the feed page.

## Design

### 1. Profile Tab Height Cap

All three tabs get the same treatment:

- **Container**: `max-h-[400px]` with `overflow-hidden` on the tab content area
- **Fade overlay**: A gradient from transparent to the page background at the bottom of the container, so content fades out rather than hard-clipping
- **"See more" button**: Positioned below the fade. Links to `/app/feed?userId=<profileUserId>`. Always visible for Activity and Journal tabs (dynamic content). For Watchlists, visible when items exceed the container height.
- The existing infinite scroll / "Load more" inside ActivityTab is removed since the container is capped and "See more" replaces that UX on the profile

### 2. Feed Page — userId Search Param

**Route change:**
- Add `validateSearch` to the `/app/feed` route to accept an optional `userId: string` search param

**When `userId` is present:**
- Fetch the user's username via a lightweight query (e.g. `friend.profile` which is already available, or a minimal lookup)
- **Header**: Show `"{username}'s Feed"` instead of `"Feed"`
- **Filter dropdown**: Hidden — not applicable when viewing a single user's feed
- **"Back to full feed" link**: A subtle link/button near the header that navigates to `/app/feed` (clears the userId param)
- **Data**: Pass `userId` to `watchEvent.getFeed({ userId, limit: 20 })` — already supported by the backend

**When `userId` is absent:**
- No changes — existing behavior (Everyone / Just Me filter)

### 3. Navigation Flow

```
Profile tab → "See more" → /app/feed?userId=abc123
Feed reads userId from search params
Feed fetches username → shows "Edog's Feed"
User clicks "Back to full feed" → /app/feed
```

### 4. No Backend Changes

The `watchEvent.getFeed` procedure already accepts an optional `userId` param. No new tRPC procedures or schema changes required.

## Files to Modify

1. **`src/routes/app/profile.$userId.tsx`** — Add height cap, fade overlay, and "See more" links to all three tab content areas. Remove "Load more" from ActivityTab.
2. **`src/routes/app/feed.tsx`** — Add `validateSearch` for `userId`, conditional header/title, hide filter when userId present, add "Back to full feed" link.
