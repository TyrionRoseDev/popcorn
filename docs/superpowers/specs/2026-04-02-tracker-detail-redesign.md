# Tracker Detail Page Redesign

## Overview

Full visual redesign of the show detail page (`/tracker/:tmdbId`) to match the drive-in theatre aesthetic. Approved mockup: `.superpowers/brainstorm/11992-1775158415/content/full-page-v2.html`

## Design Elements

### Drive-In Screen (Header)
- Show's TMDB backdrop fills a 16:9 aspect-ratio container styled as a projected screen
- Scanline overlay (repeating horizontal lines at low opacity)
- Dark gradient overlay (transparent top, opaque bottom)
- Poster thumbnail + title + metadata overlaid at bottom-left
- Thick `#1a1a2e` border (like a screen frame)
- Ambient glow shadow (amber tint)
- **Speaker posts** — 5 small vertical bars below the screen, gradient from dark to amber

### Progress Marquee
- Recessed panel with amber border (`rgba(255,184,0,0.12)`)
- "Progress" label in small amber uppercase
- Episode count in Playfair Display serif (`1 / 171`)
- Percentage in cyan with glow
- 6px progress bar with cyan gradient fill and glow

### Action Strip
- Three equal-width icon tiles (not pill buttons): Write (pink), Mark All (amber), Rewatch (cyan)
- Each tile: icon on top, label below, colored border accent
- Rounded 8px corners, dark background

### Film-Strip Divider
- Small colored perforation dots (amber, cyan, pink) + gradient line
- Used between action strip and episode list

### Episode Rows
- **Left accent strip** — 4px wide, dark when unwatched, cyan-to-pink gradient when watched with glow
- **Body** — episode number (Playfair Display serif, bold, large), dot separator, episode name (Special Elite typewriter font), runtime below
- **Right status section** — separated by subtle border, contains circle checkbox (empty when unwatched, glowing cyan check when watched)
- **Watched state** — cyan wash background, glowing number, brighter text
- **Hover** — row slides right 4px, unwatched accent turns cyan, "watch"/"undo" hint appears, checkbox border glows
- 3px gap between rows, 8px border-radius

### Season Selector
- Dropdown to pick which season to view (only that season's episodes show)
- Styled as a custom select matching the drive-in aesthetic
- Shows season name + watched/total count
- "Mark All" button next to the dropdown for the selected season

### Fonts
- **Playfair Display** — titles, episode numbers, percentage
- **Special Elite** — episode names (typewriter feel)
- **Space Mono** — labels, metadata, runtime (already in use as mono-retro)

### Removed
- The standalone rewatch strip at the bottom (rewatch is only in the action strip)
- Old circular episode indicators
- Old pill-style action buttons

### Unchanged
- Notes & Reviews section at the bottom
- Coming Soon section for upcoming episodes
- Watch-through switcher (from rewatch feature)
- Completion celebration modal
- Write About modal
