# Watchlist Feature — Design Spec

## Overview

A multi-watchlist system where users can create named watchlists, add movies and TV shows they want to watch, collaborate with friends, and manage their viewing queue. This is the "want to watch" phase — a future film diary feature will extend this with watched status, ratings, and reviews.

## Data Model

### New Tables

**`watchlist`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | User-defined name |
| ownerId | text | FK → user.id |
| isPublic | boolean | Default false |
| isDefault | boolean | Default false, one per user |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**`watchlistItem`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| watchlistId | uuid | FK → watchlist.id |
| tmdbId | integer | TMDB title ID |
| mediaType | text | 'movie' or 'tv' |
| addedBy | text | FK → user.id |
| watched | boolean | Default false |
| createdAt | timestamp | Date added |

- Unique constraint: (watchlistId, tmdbId, mediaType)

**`watchlistMember`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| watchlistId | uuid | FK → watchlist.id |
| userId | text | FK → user.id |
| role | text | 'owner' or 'member' |
| createdAt | timestamp | |

- Unique constraint: (watchlistId, userId)

### Onboarding Integration

When onboarding completes (`saveTasteProfile` mutation), also:
1. Create a default watchlist named "My Picks" with `isDefault: true`
2. Add all selected onboarding titles as `watchlistItem` entries
3. Add the user as `watchlistMember` with role `owner`

### Existing Table Changes

The existing `userTitle` table (used for onboarding taste picks) remains unchanged. The watchlist system is separate — `watchlistItem` is the new source of truth for "titles the user wants to watch."

## Roles & Permissions

| Action | Owner | Member |
|--------|-------|--------|
| Add titles | Yes | Yes |
| Mark as watched | Yes | Yes |
| Remove titles | Yes | No |
| Invite members | Yes | No |
| Remove members | Yes | No |
| Rename watchlist | Yes | No |
| Toggle public/private | Yes | No |
| Delete watchlist | Yes | No |

## Pages & Routes

### Watchlist Overview — `/app/watchlists`

The main page showing all of the user's watchlists.

**Layout:**
- Now Showing marquee header (amber border, chasing amber bulbs top and bottom, "NOW SHOWING" in Space Mono, "My Watchlists" in Righteous)
- "New Watchlist" pill button centered below marquee
  - Amber color (#FFB800), 1.5px border, rounded pill shape
  - Font: Manrope 13px bold
  - Animation: typewriter effect on page load (text types out letter by letter), then transitions to shimmer sweep loop
- Each watchlist rendered as a continuous film reel strip:
  - Sprocket holes running continuously along top and bottom edges
  - Posters as frames within the strip, thin dividers between
  - Strip edges (2px lines) separating sprockets from poster area
  - All reels scroll at the same speed (45s per loop), pause on hover
  - Posters repeat to fill the strip when a watchlist has few titles (no empty gaps)
  - Fade edges (mask-image gradient) on left and right
- Watchlist header row above each reel:
  - Watchlist name (Manrope 13px bold)
  - Title count
  - Badges: "Default" (pink), "Shared" (cyan)
  - Shared member avatars (stacked circles)
  - Settings gear icon button (Lucide `settings`)

**Atmosphere:**
- Starfield: 90 individually positioned stars with twinkle animation (matching title page approach)
- Film grain overlay
- Pink ground glow: `radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.15), transparent)`
- Low-lying fog: multiple layers of drifting mist at the bottom, subtle blue-white radial gradients with slow horizontal drift animation

### Watchlist Detail — `/app/watchlists/$watchlistId`

Opened by clicking a watchlist's film reel on the overview page.

**Layout:**
- Poster grid matching the search results page design
- Filter and sort controls:
  - Sort by: date added (default), title, year, rating
  - Filter by: media type (all/movie/tv), genre
  - Show "added by" member name when watchlist is shared
- Action buttons per title:
  - Mark as watched
  - Remove from watchlist (owner only)
- Watchlist-level actions:
  - Invite friend (opens invite flow)
  - Rename watchlist
  - Toggle public/private
  - Delete watchlist
- Same starry atmosphere as overview page

### Add to Watchlist Flow

Available from: search results, title detail page, trending/recommendations.

**Interaction:**
1. User clicks "Add to Watchlist" button/icon on a poster card or title detail page
2. Dropdown appears showing the user's watchlists
3. User selects a watchlist, or clicks "Create New Watchlist" at the bottom of the dropdown
4. "Create New Watchlist" opens an inline form (name input) within the dropdown
5. Title is added to the selected watchlist
6. Toast confirmation shown

## tRPC Procedures

### Queries

**`watchlist.list`** — Get all watchlists for the current user (owned + member of)
- Returns: watchlists with title count, member count, first N poster URLs for reel display
- Used by: overview page

**`watchlist.get`** — Get a single watchlist with its items
- Input: watchlistId
- Returns: watchlist details, items with TMDB data, members
- Auth: must be owner or member (or public)
- Used by: detail page

**`watchlist.getForDropdown`** — Lightweight list for the "add to watchlist" dropdown
- Returns: watchlist id, name, isDefault only
- Used by: add-to-watchlist dropdown

### Mutations

**`watchlist.create`** — Create a new watchlist
- Input: name, isPublic (optional, default false)
- Creates watchlist + adds current user as owner

**`watchlist.update`** — Rename or toggle visibility
- Input: watchlistId, name?, isPublic?
- Auth: owner only

**`watchlist.delete`** — Delete a watchlist and all its items/members
- Input: watchlistId
- Auth: owner only
- Cannot delete if isDefault (must have at least one watchlist)

**`watchlist.addItem`** — Add a title to a watchlist
- Input: watchlistId, tmdbId, mediaType
- Auth: owner or member
- No-op if already exists (idempotent)

**`watchlist.removeItem`** — Remove a title from a watchlist
- Input: watchlistId, tmdbId, mediaType
- Auth: owner only

**`watchlist.markWatched`** — Toggle watched status on a title
- Input: watchlistId, tmdbId, mediaType, watched (boolean)
- Auth: owner or member

**`watchlist.addMember`** — Invite a user to a watchlist
- Input: watchlistId, userId (or username/email)
- Auth: owner only
- Adds as role 'member'

**`watchlist.removeMember`** — Remove a member from a watchlist
- Input: watchlistId, userId
- Auth: owner only
- Cannot remove self (owner)

## Component Breakdown

### Overview Page

- `WatchlistOverviewPage` — route component, fetches watchlist list
- `NowShowingMarquee` — reuse from title page branch (amber border, chasing bulbs, title)
- `NewWatchlistButton` — amber pill with typewriter → shimmer animation
- `WatchlistReel` — single watchlist row: header + film strip
- `WatchlistReelHeader` — name, count, badges, avatars, settings button
- `FilmStrip` — continuous scrolling strip with sprocket holes and poster frames
- `WatchlistOverviewAtmosphere` — starfield, grain, fog, pink glow

### Detail Page

- `WatchlistDetailPage` — route component, fetches watchlist items
- `WatchlistDetailHeader` — watchlist name, actions (invite, rename, visibility, delete)
- `WatchlistGrid` — poster grid (reuse PosterGrid from search)
- `WatchlistFilters` — sort/filter controls adapted from search
- `WatchlistItemCard` — poster card with watched/remove actions

### Shared

- `AddToWatchlistDropdown` — dropdown picker with watchlist list + create new option
- `CreateWatchlistInline` — name input form within the dropdown

## Integration Points

### Title Detail Page (title-page branch)

The arcade buttons on the title detail page include a "Watchlist" button. This should open the `AddToWatchlistDropdown`.

### Search Results

Each `PosterCard` in the search results grid should get an "Add to Watchlist" icon button (e.g., a bookmark or plus icon) that opens the `AddToWatchlistDropdown`.

### Search Landing (Trending/Top Rated/New Releases)

Same treatment as search results — add-to-watchlist icon on each poster card.

### Onboarding

The `saveTasteProfile` mutation needs to be extended to also create the default watchlist and seed it with the selected titles.

### Navigation

Add a "Watchlists" link to the app navigation bar (`/app/route.tsx`), alongside the existing "Search" link.

## Out of Scope (Future)

- Film diary (watched log with dates, ratings, reviews)
- Watchlist sharing via link (currently invite-only by username)
- Reordering watchlists on the overview page
- Drag-and-drop reordering of titles within a watchlist
- Notifications when a collaborator adds a title
- Public watchlist discovery/browsing
