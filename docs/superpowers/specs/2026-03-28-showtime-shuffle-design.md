# Showtime Shuffle — Design Spec

## Overview

Tinder-style swipe interface for discovering movies and TV shows. Users swipe through a personalized feed of recommendations. "Yes" swipes in solo mode add directly to a dedicated Showtime Shuffle watchlist. In group mode, a title is only added to the group watchlist when **all members** independently swipe yes — a unanimous matching system.

## Entry Points

1. **Nav bar link** — "Shuffle" in the shared app navbar. Opens solo shuffle by default with a dropdown to switch to any group watchlist the user is a member of.
2. **Watchlist detail button** — each watchlist has a "Showtime Shuffle" button. Opens shuffle pre-set to that watchlist context (solo if only one member, group if multiple).

Both entry points lead to the same page (`/app/shuffle`), just with different initial context.

## Data Model

### New table: `shuffleSwipe`

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK, `crypto.randomUUID()` (matches codebase convention) |
| userId | FK → user | NOT NULL, cascade delete |
| watchlistId | FK → watchlist | NOT NULL — solo swipes use the user's shuffle watchlist, group swipes use the group watchlist |
| tmdbId | integer | NOT NULL |
| mediaType | text ('movie' \| 'tv') | NOT NULL |
| action | text ('yes' \| 'no' \| 'hide') | NOT NULL |
| createdAt | timestamp | default now() |

- **Unique index** on (userId, tmdbId, mediaType, watchlistId) — same user can have different swipes in solo vs. different group contexts. Since `watchlistId` is NOT NULL, standard unique index works.
- **Indexes** on userId, watchlistId

### Prerequisite: watchlist schema (from `watchlist` branch)

This feature depends on the watchlist tables already built on the `watchlist` branch. Those tables are:

- **`watchlist`** — id, name, ownerId (FK → user), isPublic, isDefault, createdAt, updatedAt
- **`watchlistItem`** — id, watchlistId (FK), tmdbId, mediaType, addedBy (FK → user), watched, createdAt. Unique on (watchlistId, tmdbId, mediaType)
- **`watchlistMember`** — id, watchlistId (FK), userId (FK), role ('owner' | 'member'), createdAt. Unique on (watchlistId, userId)

### Shuffle watchlist identification

Add a `type` column to the `watchlist` table: `'default' | 'shuffle' | 'custom'` (default: `'custom'`). The auto-created Showtime Shuffle watchlist uses `type: 'shuffle'`. This replaces the existing `isDefault` boolean — migrate existing default watchlists to `type: 'default'` and drop `isDefault`. Cleaner than name-matching and allows reliable querying.

### Existing schema usage

- Auto-create a "Showtime Shuffle" watchlist per user (type: 'shuffle') during first shuffle access
- Group watchlist items added via existing `watchlistItem` table when a match occurs
- No separate notification table — in-app notifications driven by querying recent matches

### How solo and group swipes relate to watchlists

- **Solo swipes:** `watchlistId` references the user's auto-created shuffle watchlist (type: 'shuffle'). A "yes" swipe inserts both a `shuffleSwipe` row AND a `watchlistItem` row into the shuffle watchlist.
- **Group swipes:** `watchlistId` references the group watchlist. A "yes" swipe inserts only a `shuffleSwipe` row. The `watchlistItem` is only inserted when ALL members have swiped yes (match).

### Undo depth

Undo is limited to the **last 1 swipe only** and is session-scoped (resets on page navigation). This keeps the implementation simple — no undo history stack.

## Feed Engine

### Solo feed (new module: `shuffle-feed.ts`)

Assembles cards from three sources via TMDB, building on existing `feed-assembler.ts` patterns:

| Source | Ratio | What |
|--------|-------|------|
| Taste | 50% | `discoverMovies`/`discoverTv` filtered by user's genres from `userGenre` |
| Trending | 30% | `fetchTrending` weekly |
| Discovery | 20% | `discoverMovies`/`discoverTv` with genres the user did NOT pick |

**Filtering out:**
- Items already in the user's shuffle watchlist
- Items with `action: 'hide'` swipes (global — hidden from all contexts)
- Items with `action: 'yes'` swipes in this context (the shuffle watchlist)
- Items with `action: 'no'` swipes in this context less than ~2 weeks old (based on `createdAt`)

**Pagination:** cursor-based, encoding per-source page positions. Prefetch next batch when ~5 cards remain in the stack.

### Group feed

| Source | Ratio | What |
|--------|-------|------|
| Blended taste | 30% | Round-robin across all members' genres |
| Trending | 40% | Same as solo |
| Discovery | 30% | Genres no member picked |

**Key difference:** do NOT filter out items other members said yes to — this user still needs to see them for matching to work. Only filter out items this user has already swiped on in this group context.

## Swipe Card

### Content
- Movie poster (dominant)
- Title + year
- Genre tags (pills)
- 2-3 line synopsis
- Tap card to expand: full details view (cast, ratings, trailer, similar titles)

### Swipe gestures (Framer Motion)
- `drag: "x"` — horizontal only
- Threshold: 120px displacement triggers action
- Rotation: ±15° proportional to drag distance
- Exit animation: `x: ±800, opacity: 0, rotate: ±30°`
- Enter animation: back card promotes with `scale: 0.96 → 1, opacity: 0.6 → 1`
- Color overlay: green/red gradient opacity tied to drag x value

### Swipe feedback stamps

**Clapperboard style** — white/dark chevron stripes, dark board body, muted labels. Only the main text is colored.

**Yes stamps (green, randomly picked):**
- "YES! / TAKE 1"
- "LET'S GO / ACTION!"
- "OH YEAH / ROLLING"
- (pool expanded during implementation)

**No stamps (red, randomly picked):**
- "NOPE / CUT!"
- "SKIP / NEXT"
- "NAH / WRAP"
- (pool expanded during implementation)

## Action Buttons (Arc Layout)

Below the card stack. Primary actions larger and colored, utility actions smaller, muted, and slightly raised to create a thumb-friendly arc.

| Button | Icon (Lucide) | Size | Color | Action |
|--------|---------------|------|-------|--------|
| No | X | 48px | red border | Swipe left (skip, can resurface) |
| Undo | RotateCcw | 40px | muted border | Undo last swipe |
| Hide | EyeOff | 40px | muted border | Never show again (permanent) |
| Yes | Check | 48px | green border | Swipe right (add/vote) |

## Three Swipe Outcomes

1. **Yes** — solo: instantly added to Showtime Shuffle watchlist. Group: vote registered server-side, invisible to other members.
2. **No** — skipped. Can resurface after ~2 weeks (based on `createdAt`).
3. **Hide** — permanent. Title removed from all feeds. Accessible via profile settings ("Hidden Titles") to unhide.

## Group Matching

### Flow
1. Members swipe independently on the same group shuffle feed
2. Swipes are stored server-side with no visibility to other members
3. When a swipe comes in, server checks: do all members of this watchlist have `action: 'yes'` for this tmdbId + mediaType?
4. If yes → **match!**
   - Insert item into group's `watchlistItem` table
   - The user who triggered the match sees the celebration animation
   - All other members receive an in-app notification

### Match detection query (pseudo)
```sql
-- On each 'yes' swipe for a group watchlist:
-- Count distinct users who swiped 'yes' on this item for this watchlist
-- Compare to total member count of the watchlist
-- If equal → match
```

### Match celebration: Red Curtains

Full-screen modal overlay with Framer Motion animation:
1. Red velvet curtains animate open (parting from center)
2. Golden curtain rod visible at top
3. "CURTAIN CALL / MATCH!" text revealed on the stage
4. Movie poster displayed behind the curtains
5. Title name, watchlist name, and overlapping member avatars shown
6. Auto-dismiss after 3 seconds or tap to close

### Notifications (in-app only)
- Toast notification when a match occurs (for members who aren't the triggering swiper)
- Badge indicator on the watchlist in the nav/watchlist list
- No push notifications for now

## Page Layout

- Route: `/app/shuffle` with optional search param for watchlist context (`?watchlistId=xxx`)
- Uses shared app layout (navbar with "Shuffle" link)
- Background: `RetroOverlays` (stars, grain, scanlines — same as all app pages)
- Content: mode switcher (solo vs group watchlists) → card stack → action buttons
- Exact layout styling to be refined during implementation with real content

## Technical Approach

- **Animations:** Framer Motion — `drag`, `AnimatePresence`, spring physics, layout transitions
- **Data fetching:** tRPC procedures + React Query (consistent with existing patterns)
- **Database:** Drizzle ORM (new `shuffleSwipe` table + migration)
- **TMDB integration:** extends existing `tmdb.ts` functions
- **Feed assembly:** new `shuffle-feed.ts` module following `feed-assembler.ts` patterns
- **Card stack:** custom component with Framer Motion gestures (no external swipe library)

## Scope Boundaries

**In scope:**
- Solo shuffle with personalized feed
- Group shuffle with unanimous matching
- Swipe card UI with Framer Motion gestures
- Clapperboard stamp feedback (random text pool)
- Red curtain match celebration
- Hide/unhide functionality
- Undo last swipe
- "Showtime Shuffle" auto-created watchlist
- Nav entry point + watchlist button entry point
- In-app match notifications (toast + badge)

**Out of scope (future):**
- Push notifications
- Swipe analytics/stats
- "Super like" or additional swipe actions
- Social features beyond group matching (comments, reactions)
- Algorithmic learning from swipe history
