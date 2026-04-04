# Navbar Redesign — Cinematic Marquee

## Overview

Replace the current single-row horizontal navbar with a cinematic marquee header on desktop and a hamburger + left drawer on mobile. The goal is better visual hierarchy, stronger drive-in aesthetic, and a proper mobile experience.

## Desktop (md+)

### Structure

Two-row sticky header:

1. **Top row**: centered POPCORN logo, notification bell + user avatar/dropdown positioned top-right
2. **Bottom row**: uppercase tab strip, centered, with neon underline active indicators

### Logo

- Font: `font-logo` (Bungee Shade), centered
- Animation: `neon-cycle` — continuously cycles through pink → cyan → amber over 6s
- Letter-spacing: wide (matching current)

### Tab Strip

- Text: uppercase, small, letterspaced (`font-mono-retro` or `font-sans` — whichever reads better at small uppercase sizes)
- Inactive: `cream/35`, no underline
- Hover: `cream/60`
- Active: neon color text + 2px bottom border in matching neon color + `box-shadow` glow beneath the underline

### Active Tab Colors (alternating)

| Tab | Neon Color |
|-----|-----------|
| Search | `neon-pink` (#FF2D78) |
| Shuffle | `neon-cyan` (#00E5FF) |
| Watchlists | `neon-amber` (#FFB800) |
| Friends | `neon-pink` (#FF2D78) |
| Feed | `neon-cyan` (#00E5FF) |
| Tracker | `neon-amber` (#FFB800) |

### Header Styling

- `sticky top-0 z-50`
- Background: `drive-in-bg/80` with `backdrop-blur-lg`
- Bottom border: `cream/8` (subtle separator, same as current)
- Max width: `max-w-6xl` centered (same as current)

### Right-side Actions

- Notification bell (existing component, unchanged)
- User dropdown (existing `BetterAuthHeader` component, unchanged)
- Positioned absolute or flex top-right within the top row

## Mobile (< md)

### Top Bar

Slim single row:
- **Left**: hamburger icon (3 horizontal lines)
- **Center**: POPCORN logo (animated gradient, same as desktop but smaller)
- **Right**: notification bell + user avatar

The tab strip is **hidden** on mobile.

### Left Drawer

Triggered by hamburger tap. Uses shadcn Sheet component (already available in the project as `sidebar.tsx` uses it).

**Drawer contents (top to bottom):**

1. POPCORN logo (gradient, static on mobile to avoid distraction)
2. Divider
3. Navigation links with icons — same 6 links as desktop tab strip:
   - Search (Search icon)
   - Shuffle (Shuffle icon)
   - Watchlists (Bookmark icon)
   - Friends (Users icon)
   - Feed (Rss icon)
   - Tracker (Tv icon)
4. Active link gets its neon color as text + subtle background tint (matching the desktop alternating pattern)
5. Spacer / `mt-auto`
6. Divider
7. Secondary links: Profile, Settings, Sign out

**Drawer styling:**
- Background: `drive-in-bg` (near-solid, with slight blur)
- Border-right: `cream/8`
- Width: ~240px
- Overlay: dimmed backdrop behind drawer
- Slide-in animation from left

## Shared Behavior

- Logo animation: `neon-cycle` keyframes (already exist in `styles.css`)
- Active route detection: TanStack Router's `[&.active]` class on `<Link>` components
- All existing neon color tokens already defined in `styles.css`

## Files to Modify

- `src/routes/app/route.tsx` — main layout, replace navbar markup with new desktop marquee + mobile hamburger/drawer
- `src/styles.css` — may need minor additions for tab underline glow utility if not achievable with inline Tailwind

## Files NOT Modified

- `src/components/notifications/notification-bell.tsx` — used as-is
- `src/integrations/better-auth/header-user.tsx` — used as-is
- `src/components/ui/sheet.tsx` — used for mobile drawer (already available via shadcn sidebar)

## Out of Scope

- Landing page header (`src/components/Header.tsx`) — separate component, not part of this work
- Route changes or new pages
- Changes to notification or auth dropdown internals
