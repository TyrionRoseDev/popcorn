# Watch History — Neon Journal Redesign

## Summary

Restyle the watch history cards on the title detail page from plain bordered cards to a "Neon Journal" aesthetic — glowing amber borders, radial light, star bloom, cyan accents on companions and notes. Add a scrollable container with a fade hint when entries overflow.

## Scope

- **In scope**: Visual restyling of `WatchEventCard` (title-page context only), scrollable container in `TitleActions`
- **Out of scope**: Data model, props interface, API calls, edit/delete popover behavior, feed/profile usage of `WatchEventCard`

## Card Visual Treatment

Each watch event card gets the following treatment:

### Background & Border
- `background`: linear-gradient from `rgba(10,10,30,0.95)` to `rgba(15,15,35,0.8)` at 145deg
- `border`: 1px solid `rgba(255,184,0,0.2)` (amber tint)
- `border-radius`: 10px
- `box-shadow`: `0 0 12px rgba(255,184,0,0.05)` outer glow + `inset 0 1px 0 rgba(255,255,240,0.03)` top highlight
- Pseudo-element `::after` with `radial-gradient(ellipse at top left, rgba(255,184,0,0.06), transparent 50%)` for warm light spill

### Stars
- Slightly larger than current (15px vs 12px)
- Filled stars get `filter: drop-shadow(0 0 6px rgba(255,184,0,0.5))` for amber bloom
- Empty stars remain `rgba(255,255,240,0.08)` with no filter

### Date
- Font: Space Mono, 10px, `letter-spacing: 1px`
- Color: `rgba(255,184,0,0.45)` (amber-tinted)
- Positioned below the stars row

### Divider
- Thin 1px line: `linear-gradient(90deg, rgba(255,184,0,0.2), transparent 80%)`
- Separates header (stars + date) from body (companions + note)

### Companions
- Small cyan dot prefix (`4px` circle, `rgba(0,229,255,0.5)`)
- Text: 11px, `rgba(255,255,240,0.3)`

### Note
- 12.5px, `rgba(255,255,240,0.55)`, `line-height: 1.6`
- Left quote-bar: 2px wide, `rgba(0,229,255,0.2)`, with 12px left padding
- Keep existing `line-clamp-2` truncation

### Menu
- `···` button stays top-right of header row, same popover behavior

## Scrollable Container

Applied to the watch history list wrapper in `TitleActions`:

- `max-h-[360px]` (~3 cards visible at once)
- `overflow-y-auto` with custom scrollbar:
  - Thin track (`4px` width)
  - Thumb: `rgba(255,184,0,0.25)` with `rounded-full`
  - Track: transparent
- Bottom fade mask: pseudo-element or CSS mask with `linear-gradient(to bottom, black 80%, transparent)` applied only when content overflows (via a simple scroll-detection class or always-on since it's subtle)

## Files to Modify

1. **`src/components/watched/watch-event-card.tsx`** — restyle the card markup and classes for the neon journal look. This component is also used in the feed and profile diary, so the restyling should apply everywhere it's rendered (same data, same visual).
2. **`src/components/title/title-actions.tsx`** — wrap the watch event list in a scrollable container with max-height, custom scrollbar, and fade mask.
3. **`src/styles.css`** — add custom scrollbar utility classes if needed (thin amber scrollbar).
