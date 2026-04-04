# Friends Page Redesign

Redesign the friends page (`src/routes/app/friends.tsx`) with a pink neon identity, film strip card metaphor, richer friend data, and atmosphere layer. Also fix marquee header consistency across the 4 pages that use `NowShowingHeader`.

## 1. Friends Atmosphere

New `FriendsAtmosphere` component at `src/components/friends/friends-atmosphere.tsx`. Same structural pattern as `FeedAtmosphere` (`src/components/feed/feed-atmosphere.tsx`) but with pink/magenta tones.

Elements:
- **Pink ground glow**: fixed to bottom, 220px height, `radial-gradient(ellipse at 50% 100%, rgba(255,45,120,0.12) 0%, transparent 70%)`
- **3 fog layers**: reuse existing `fog-drift-1`, `fog-drift-2`, `fog-drift-3` keyframes from `styles.css`. Same white-at-low-opacity approach as feed fog.
- **Film strip edges**: left and right, 22px wide, 6% opacity. Same `repeating-linear-gradient` pattern as `FeedAtmosphere`.
- **Scattered light orbs**: 3 radial gradients — pink at top-left (`rgba(255,45,120,0.04)`), cyan at top-right (`rgba(0,229,255,0.03)`), amber at bottom-left (`rgba(255,184,0,0.03)`).

Rendered as the first child in `FriendsPage`, `pointer-events-none`, `fixed inset-0`, `z-index: 0`. Page content gets `relative z-[2]`.

## 2. Film Strip Friend Cards

Replace `TicketStubCard` with `FilmStripCard` (inline in `friends.tsx`, same pattern as the existing components).

### Structure

```
┌──────────────────────────────┐
│ ○ ○ ○ ○ ○ ○  (sprocket row) │
├──────────────────────────────┤
│  [avatar]  @username         │
│            ♥ Favourite Film  │
│                              │
│  ┌────────┬────────┬───────┐ │
│  │   42   │  4.2   │   3   │ │
│  │WATCHED │ AVG ★  │ LISTS │ │
│  └────────┴────────┴───────┘ │
├──────────────────────────────┤
│ ○ ○ ○ ○ ○ ○  (sprocket row) │
└──────────────────────────────┘
```

### Sprocket rows

Top and bottom. 6 small rounded rectangles per row (`8px x 5px`, `border-radius: 2px`). Background color derived from the friend's avatar gradient (use the existing `getAvatarGradient` function, pick the first color at 15% opacity). Row has a faint border separating it from the card interior.

### Interior

- **Avatar**: 50px, circular, gradient background from `getAvatarGradient`. `box-shadow: 0 0 20px rgba(accent, 0.15)`.
- **Username**: `font-mono-retro`, 14px, `font-weight: 700`, `color: cream/92`.
- **Favourite film**: below username, 10px, `cream/30`, prefixed with `♥`. Lazy-loaded from `trpc.title.details` (same pattern as current `TicketStubCard`).

### Stats bar

3 equal columns, no gap (1px gap for visual separation), `border-radius: 6px`, overflow hidden.

| Column | Value | Label | Background | Color |
|--------|-------|-------|------------|-------|
| Watched | `watchCount` | "WATCHED" | `rgba(255,45,120,0.06)` | `#FF2D78` |
| Avg rating | `avgRating` (1 decimal) | "AVG ★" | `rgba(255,184,0,0.06)` | `#FFB800` |
| Lists | `listCount` | "LISTS" | `rgba(0,229,255,0.06)` | `#00E5FF` |

Values: 16px, `font-weight: 700`, `font-family: monospace`. When `avgRating` is null (no rated watches), display `—`.
Labels: 7px, uppercase, `letter-spacing: 1.5px`, `cream/25`.

### Hover state

`hover:-translate-y-0.5`, border brightens to accent/25, `box-shadow` gains glow. Sprocket holes brighten on hover.

### Layout

2-column grid (`grid-cols-2 gap-3`), same as current.

## 3. Backend: Friend Stats

Extend the `friend.list` tRPC procedure in `src/integrations/trpc/routers/friend.ts` to include per-friend stats.

For each friend returned, add:
- `watchCount`: `SELECT COUNT(*) FROM watch_event WHERE user_id = friend.id`
- `avgRating`: `SELECT AVG(rating) FROM watch_event WHERE user_id = friend.id AND rating IS NOT NULL`
- `listCount`: count of watchlists where the friend is owner OR member (public watchlists only)

Implementation: after fetching the friend list, batch-query stats for all friend IDs. Use `GROUP BY user_id` so it's a single query per stat type (not N+1).

Return shape change:
```typescript
// Before
{ id, username, avatarUrl, favouriteFilmTmdbId, ... }

// After
{ id, username, avatarUrl, favouriteFilmTmdbId, ..., watchCount: number, avgRating: number | null, listCount: number }
```

## 4. Pending Request Cards — Mini Film Strip

Replace `PendingRequestCard` with a compact horizontal film strip variant.

### Structure

```
┌───┬──────────────────────────────────────┬───┐
│ ○ │  [avatar]  @username  ·  2h ago  ✓ ✗ │ ○ │
│ ○ │                                       │ ○ │
│ ○ │                                       │ ○ │
│ ○ │                                       │ ○ │
└───┴──────────────────────────────────────┴───┘
```

Sprocket holes on **left and right edges** (vertical, 4 holes each side). Interior is a single horizontal row: avatar (40px) + username + time ago + accept/decline buttons.

- Border: `neon-pink/10`, hover: `neon-pink/25`
- Sprocket color: `rgba(255,45,120,0.15)`
- Accept button: green circular (same as current)
- Decline button: red circular (same as current)
- Preserve `motion` layout animations and `AnimatePresence` exit animations.

## 5. Discover/Search Result Cards — Mini Film Strip

Replace `DiscoverResultCard` with the same compact horizontal film strip layout as pending requests.

- Border: `neon-cyan/10`, hover: `neon-cyan/25`
- Sprocket color: `rgba(0,229,255,0.15)`
- Interior: avatar (44px) + username + action button (Add Friend / Request Sent / Friends badge)
- Preserve `motion` entrance animations.

## 6. Marquee Header Consistency

The `NowShowingHeader` component itself is unchanged. Fix how the 4 pages wrap it so they all look the same:

| Page | Current wrapper | Fix |
|------|----------------|-----|
| `feed.tsx` | `max-w-2xl px-4 py-8`, `CarSilhouettes` above | Keep as-is (this is the reference) |
| `friends.tsx` | `max-w-4xl px-4 pt-10` | Change outer container to `max-w-2xl px-4 pt-8 pb-16` |
| `tracker.index.tsx` | Extra `<div className="mb-6">` wrapper | Remove the extra wrapper div, match `pt-8` on the outer container |
| `watchlists/index.tsx` | `style={{ zIndex: 2, paddingTop: "40px" }}` inline | Change to `className="relative z-[2] pt-8"`, use Tailwind not inline styles |

The goal: all pages use `max-w-2xl` for the marquee container, `pt-8` top padding, Tailwind classes instead of inline styles. Content sections below the marquee can use their own widths and spacing as needed.

## 7. Search Bar Restyle

Change the search bar from amber to pink accent to match the friends page identity:

- Border: `border-neon-pink/25`, focus: `border-neon-pink/50`
- Background: `bg-neon-pink/[0.05]`
- Icon: `text-neon-pink/50`
- Focus shadow: `0 0 20px rgba(255,45,120,0.08)`
- Spinner: `border-neon-pink/20 border-t-neon-pink/60`
- Placeholder text color unchanged (`cream/25`)

## Files Changed

- `src/routes/app/friends.tsx` — main page rewrite (atmosphere, new card components, search bar, header wrapper)
- `src/components/friends/friends-atmosphere.tsx` — new file
- `src/integrations/trpc/routers/friend.ts` — add stats to `friend.list`
- `src/routes/app/tracker.index.tsx` — fix marquee wrapper
- `src/routes/app/watchlists/index.tsx` — fix marquee wrapper

## Components Reused

- `NowShowingHeader` from `src/components/watchlist/now-showing-header.tsx` (unchanged)
- `getAvatarGradient` helper (stays in `friends.tsx`)
- `motion` / `AnimatePresence` from `motion/react`
- Existing fog keyframes from `src/styles.css`
