# Arcade Button Active States & Click Feedback

## Problem

The title page arcade buttons (Watchlist, Watched, Invite) are too subtle once clicked. The toggled/active state is hard to distinguish from inactive, and the click feedback lacks impact.

## Design

### Active State: Plasma Core

When a button is in its active/toggled state, it displays an animated shifting gradient fill that creates a "swirling energy" effect.

**Visual properties (active):**
- Background: animated linear gradient (270deg) cycling through color-specific stops at varying opacities (0.3–0.6), `background-size: 300% 300%`, animated over 3s ease infinite
- Icon: white (`#fff`) with a colored `drop-shadow(0 0 3px)` matching the button's neon color
- Box-shadow: `0 2px 0 rgba(color, 0.4), 0 0 30px rgba(color, 0.35), 0 0 60px rgba(color, 0.15)` — wider and brighter ambient glow than inactive
- Transform: `translateY(2px)` — button stays pressed down
- Label: turns the button's neon color and `font-weight: 700`

**Gradient stops per color:**

| Color | Stops |
|-------|-------|
| Pink (#FF2D78) | `rgba(255,45,120,0.6)` → `rgba(200,20,80,0.3)` → `rgba(255,100,160,0.5)` → `rgba(255,45,120,0.6)` |
| Cyan (#00E5FF) | `rgba(0,229,255,0.6)` → `rgba(0,150,200,0.3)` → `rgba(80,240,255,0.5)` → `rgba(0,229,255,0.6)` |
| Amber (#FFB800) | `rgba(255,184,0,0.6)` → `rgba(200,140,0,0.3)` → `rgba(255,210,80,0.5)` → `rgba(255,184,0,0.6)` |

### Click Feedback: Scale Bounce + Flash

On click, the button plays a 500ms `ease-out` keyframe animation:

| Keyframe | Transform | Box-shadow |
|----------|-----------|------------|
| 0% | `scale(1)` | default |
| 15% | `scale(0.85)` | dimmed (8px glow) |
| 40% | `scale(1.15)` | bright flash (40px + 80px glow) |
| 60% | `scale(0.95)` | — |
| 80% | `scale(1.05)` | — |
| 100% | `scale(1)` | default |

The animation plays on every click, whether the button is transitioning to active or triggering an action (like opening the watchlist popover).

### Which Buttons Get Active States

| Button | Active when | Behavior on click |
|--------|-------------|-------------------|
| **Watched** (cyan) | Film has been watched (`isWatched` is truthy) | Toggles watched status, opens review modal |
| **Watchlist** (pink) | Film is on at least one watchlist | Always opens the watchlist popover (user can add to more lists even when active) |
| **Invite** (amber) | Never — no active state | Opens the recommend modal |

### Inactive State

No changes to the existing inactive state. The current styling (low-opacity background, neon border, neon icon, 3D shadow) remains as-is.

## Files to Modify

- `src/components/title/arcade-button.tsx` — add Plasma Core active styles, add click animation keyframes and trigger logic
- `src/components/title/title-actions.tsx` — query `trpc.watchlist.isBookmarked` (already exists in the router, already invalidated on add/remove) and pass `active={!!bookmarked}` to the Watchlist ArcadeButton

## Out of Scope

- Changes to the inactive/default button appearance
- Changes to the Invite button's behavior
- Changes to the watchlist popover or review modal
