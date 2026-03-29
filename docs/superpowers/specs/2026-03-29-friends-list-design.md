# Friends List Feature Design

## Overview

A mutual friendship system that serves as both a social discovery layer (see what friends are watching, browse their profiles) and an access control boundary (gate watchlist invites, full profile visibility, and activity feeds behind friendship).

## Data Model

### New Tables

**`friendship`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | text | PK |
| `requesterId` | text (FK → user) | Who sent the request |
| `addresseeId` | text (FK → user) | Who received it |
| `status` | enum: `pending`, `accepted` | Request state |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

- Unique constraint: `(requesterId, addresseeId)`
- Declining deletes the row (allows re-sending)

**`block`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | text | PK |
| `blockerId` | text (FK → user) | Who blocked |
| `blockedId` | text (FK → user) | Who got blocked |
| `createdAt` | timestamp | |

- Unique constraint: `(blockerId, blockedId)`

### User Table Additions

| Column | Type | Notes |
|--------|------|-------|
| `bio` | text, nullable | Short tagline, max 100 chars |
| `favouriteFilmTmdbId` | integer, nullable | TMDB ID of favourite film |
| `favouriteGenreId` | integer, nullable | Genre ID from the existing TMDB genre list (same source as `userGenre` table). This is a single "favourite" pick, separate from the multi-select genre preferences in `userGenre`. |

## API Layer (tRPC)

### New `friend` Router

**Queries:**
- `list` — returns accepted friends with profile info (avatar, username, favourite film, favourite genre, friend count)
- `pendingRequests` — incoming requests awaiting response
- `mutualFriends(userId)` — returns mutual friends between current user and target user
- `profile(userId)` — returns full or slim profile depending on friendship status:
  - **Slim (non-friend):** avatar, username, favourite film, favourite genre, friend count, mutual friends, bio (if set)
  - **Full (friend):** all of slim + public watchlists, top genres breakdown (derived from watchlist items by genre)

**Mutations:**
- `sendRequest(userId)` — creates pending friendship, sends `friend_request` notification. Blocked users cannot send.
- `acceptRequest(friendshipId)` — sets status to accepted, sends `friend_request_accepted` notification to requester.
- `declineRequest(friendshipId)` — deletes the friendship row
- `cancelRequest(friendshipId)` — sender withdraws their pending request
- `removeFriend(userId)` — deletes friendship, forks shared watchlists for the removed user (no notification sent)
- `block(userId)` — creates block, removes friendship if exists, forks shared watchlists
- `unblock(userId)` — deletes block row

### Existing Router Modifications

- `watchlist.searchUsers` — exclude blocked users from results
- `watchlist.addMember` — check friendship before allowing invite
- `watchlist.knownUsers` — deprecated, replaced by `friend.list`. Remove usages in `create-watchlist-dialog.tsx` and `invite-member-modal.tsx`, replacing with `friend.list` for the "People you know" section.

### New Notification Types

- `friend_request_accepted` — sent when someone accepts a friend request (the existing `friend_request` type covers incoming requests)

## Watchlist Fork Behavior

When unfriending or blocking, for each shared watchlist:
1. Create a personal copy of the watchlist for the removed user, containing all current items
2. The copy is owned by the removed user
3. Remove the user from the original watchlist
4. The removed user keeps a snapshot but loses access to the living version

## Profile Pages

### Non-Friend (Slim) Profile

Top-to-bottom layout inside a drive-in themed card:

1. **Marquee lights** — amber bulbs chasing across top
2. **Avatar** — with rotating neon gradient ring
3. **Username**
4. **"Add Friend" button** — or contextual state:
   - No relationship → "Add Friend" (neon pink)
   - Request sent by you → "Request Sent" with cancel option
   - Request sent to you → "Accept / Decline" buttons
5. **Stats row** — 3 columns: Friends count | Minutes Watched | Favourite Genre
6. **Bio** (if set) — marquee-style amber-bordered box with star decorations. Completely absent if empty.
7. **Favourite film** — portrait poster (2:3 aspect ratio) with film grain/projector effects, title, year, genre, star rating alongside
8. **Achievements counter** — trophy icon + "X / Y" progress bar with amber shimmer. Placeholder for future achievements system — shows "0 / 0" or a "Coming soon" state until achievements are implemented.
9. **Blurred activity teaser** — 3 frosted placeholder rows with lock overlay ("Add friend to see activity"). Content is mocked/placeholder until activity feed system is built.
10. **Gated message** — lock icon + "Add as a friend to see watchlists, reviews & activity"

### Friend (Full) Profile

Same card layout, with these differences:

1. **Marquee lights + Avatar + Username** (same)
2. **Remove / Block buttons** — subtle inline buttons above stats (muted styling)
3. **Stats row** — same 3 columns
4. **Bio** (same)
5. **Favourite film** — portrait poster (same)
6. **Achievements** — expanded: progress bar + 3 most recent achievement badges + "View all achievements" button. Placeholder until achievements system is built — show "Coming soon" state.
7. **Top Genres bar chart** — horizontal neon bars (cyan, pink, amber, purple) with percentages, no shimmer animation. Derived from the user's watchlist items grouped by genre (using TMDB genre data from titles already in their watchlists).
8. **Watch Activity heatmap** — GitHub-style grid with cyan glow cells, Less/More legend. Derived from `watchlistItem` `createdAt` timestamps (items added/watched over time). Shows empty state if insufficient data.
9. **Tabbed content** — color-coded tabs with smooth height transition (use Motion library):
   - **Watchlists** (cyan) — recent public watchlists + "See all watchlists" button
   - **Reviews** (amber) — placeholder "Coming soon" state until reviews system is built
   - **Activity** (pink) — derived from watchlist actions (items watched, items added). Shows recent events. + "See all activity" button
   - Each tab's "See all" button navigates to a dedicated page

### Design Notes

- All profile views use the app's existing starry background, drive-in atmosphere (fog, grain, twinkling stars)
- Tab switching uses Motion for smooth height transitions between different-sized tab content
- Portrait film poster will use actual TMDB poster image in implementation
- All icons are Lucide React

## Friends Page (`/app/friends`)

### Visual Theme

Cinema lobby aesthetic with amber/gold neon tones:

- **F.R.I.E.N.D.S title** — gold amber letters with pink neon dots between each letter (TV show reference)
- **Marquee light strip** — chasing amber bulbs above the title
- **"NOW SHOWING"** subtitle
- Starry sky + film grain + atmospheric glow background

### My Friends Tab

- Amber-tinted underline tabs with Lucide icons
- Search bar with amber border
- 2-column grid of **ticket stub cards**:
  - Top section: avatar + username
  - Dashed tear line with circular punch holes on sides
  - "ADMIT ONE" text rotated on the right edge
  - Bottom section: favourite film (pink heart icon) + minutes watched (clock icon)
  - Hover: amber border glow + lift effect
- Clicking a card navigates to that user's profile

### Requests Tab

- Same page layout, tab switches
- Shows **incoming requests only** (sent requests show on the recipient's profile page)
- Each request is a ticket-stub card:
  - Top: avatar + username
  - Below tear: mutual friends count
  - Bottom: Accept (cyan) / Decline (muted) buttons

### Profile-Based Request States

The profile page's action area reflects the relationship state:
- No relationship → "Add Friend" button
- You sent them a request → "Request Sent" with cancel option
- They sent you a request → "Accept / Decline" buttons
- Already friends → Remove / Block buttons

## Blocked Users Page

Follows the existing hidden titles pattern (`/app/shuffle/hidden`):

- **Route:** `/app/settings/blocked` (or similar, accessible from profile dropdown menu)
- **Menu access:** New "Blocked Users" item in header-user dropdown (with Lucide Ban icon)
- **Layout:**
  - Back link
  - "Blocked Users" title
  - Descriptive subtitle
  - List of blocked users: muted/desaturated avatar + username + "Blocked X ago" + Unblock button
  - Empty state: "No blocked users" message

## Deferred Systems

The following UI sections are designed but depend on systems not yet built. They should render placeholder/coming-soon states in v1:

- **Achievements** — no achievements system exists. Show "0 / 0" progress bar or "Coming soon" badge on both slim and full profiles.
- **Reviews tab** — no reviews table exists. Show "Coming soon" state in the reviews tab.
- **Watched minutes** — no watch-time tracking exists. Derive an approximation from `watchlistItem` entries marked as `watched: true` using average film runtime from TMDB, or show "—" if not calculable.

These will be fully implemented when their respective features are built.

## Onboarding Additions

Three new steps appended after the existing onboarding steps (Username, Avatar, Taste Profile). The existing 3 steps remain unchanged. New total: 6 steps.

### Step 4: Pick Your Favourite Film
- TMDB search input (debounced)
- Search results list with small poster thumbnail, title, year
- Single select with check indicator
- Skip button available

### Step 5: Pick Your Favourite Genre
- 3-column grid of genre chips
- Single select (highlight selected with pink)
- Skip button available

### Step 6: Write a Short Bio (Optional)
- Textarea input, max 100 characters
- Placeholder: "horror enthusiast. no spoilers."
- Character count hint
- Skip button + Finish button

All steps show progress dots at top (existing pattern extended).

## Blocking Behavior

- Blocked users are excluded from search results
- Blocked users cannot send friend requests
- Blocking auto-deletes any existing friendship
- Blocking forks shared watchlists (same as unfriend behavior)
- Blocked users see your slim public profile (same as any non-friend) but cannot send a friend request — the "Add Friend" button is hidden/disabled
- Unblocking does not restore the previous friendship — they would need to send a new request

## Friend Request Rules

- **Anyone** can send a friend request (unless blocked)
- **Mutual opt-in required** — both users must agree (request/accept flow)
- **Declining** deletes the request — the sender can send another one
- **No cooldown** on re-sending — if someone is being annoying, the recipient can block them
- **Sender can cancel** a pending request before it's accepted/declined
- **Unfriending is silent** — no notification sent

## Notifications

| Type | Trigger | Recipient |
|------|---------|-----------|
| `friend_request` | User sends a friend request | Addressee |
| `friend_request_accepted` | User accepts a friend request | Original requester |

No notifications for: decline, cancel, unfriend, block, unblock.
