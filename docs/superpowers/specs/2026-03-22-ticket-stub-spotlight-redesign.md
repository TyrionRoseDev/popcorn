# Ticket Stub Transition & Spotlight Redesign

## Problem

The landing page has three issues in the section between the hero and the marquee board:

1. **Spotlights too far away / too slow** — beams never reach the central marquee UI, animation feels sluggish
2. **Section feels squished** — insufficient vertical padding around the marquee board
3. **Hard color change** — abrupt background shift from hero (`#050508`) to marquee section (`#0a0a1e`) with no visual bridge

## Solution

Replace the film strip divider between hero and marquee with a retro admission ticket stub, merge into one combined section with a smooth gradient, and fix the spotlight positioning/speed.

## Design

### Layout Restructure

**Current flow**: `Hero → FilmStrip → Marquee Section → FilmStrip → Footer`

**New flow**: `Hero → Combined Ticket+Marquee Section → FilmStrip → Footer`

- One `<section>` replaces the first `<FilmStrip />` and the old marquee section
- Background: smooth linear gradient `#050508 → #070714 (15%) → #0a0a1e (40%) → #0a0a1e (100%)`
- Ticket stub at top with `pt-16 pb-12` padding
- Marquee board below with `pb-24` padding
- Spotlights and vignette overlay remain inside this section
- Second `<FilmStrip />` before footer stays unchanged

### Ticket Stub Component (`src/components/ticket-stub.tsx`)

A purely decorative, static component. No click handlers or navigation. Subtle hover glow only.

**Structure**: Centered card (`max-w-md`), three-column flex layout:

| Left stub | Center content | Right stub |
|-----------|---------------|------------|
| "ADMIT ONE" (vertical, `Space Mono`, rotated 180deg) | Header + dividers + title + serial | "ADMIT ONE" (vertical, `Space Mono`) |

**Visual details**:

- **Background**: Warm parchment gradient — `linear-gradient(165deg, #f5e6c8, #ecdbb2, #f0ddb5)`
- **Side notch cutouts**: Two 28px circles at left/right midpoints, bg `#070714` (matches section gradient at that height), `inset box-shadow` for depth
- **Perforation lines**: `border-dashed` separating stubs from center, color `rgba(196,168,112,0.35)`
- **Center content**:
  - "✦ POPCORN DRIVE-IN ✦" — `Space Mono`, 7px, tracking 4px, color `#9a825e`
  - Decorative divider — horizontal rules with centered diamond (`♦`)
  - "Admit One" — `Righteous` display font, ~20px, color `#3d2810`, light text-shadow
  - Second decorative divider
  - "SCREEN 01 · No. 000001" — `Space Mono`, 7px, color `#9a825e`
- **Glow**: `box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(255,184,0,0.08)`
- **Hover**: Subtle glow increase via `ticket-glow` animation
- **Paper texture**: Noise SVG overlay at `opacity: 0.03`
- **Stub text colors**: `rgba(139,112,80,0.6)` — warm brown, muted

### Spotlight Fixes (`src/components/spotlight.tsx`)

**Position changes** (bring beams closer to center):

| Property | Left beam (before → after) | Right beam (before → after) |
|----------|---------------------------|----------------------------|
| `left` / `right` | `-20%` → `0%` | `-20%` → `0%` |
| `width` | `65vw` → `55vw` | `55vw` → `48vw` |
| `maxWidth` | `850px` → `750px` | `720px` → `650px` |
| `bottom` | `-5%` → `-8%` | `-5%` → `-8%` |
| `animationDuration` | `8s` → `5s` | `7s` → `4.5s` |

Transform origins stay unchanged (`20% 95%` left, `80% 95%` right).

### CSS Changes (`src/styles.css`)

**Updated sway keyframes** (wider range for center coverage):

```css
@keyframes sway-left {
  0% { transform: rotate(-10deg); }
  100% { transform: rotate(16deg); }
}

@keyframes sway-right {
  0% { transform: rotate(10deg); }
  100% { transform: rotate(-16deg); }
}
```

**New ticket glow keyframe**:

```css
@keyframes ticket-glow {
  0%, 100% { box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(255,184,0,0.06); }
  50% { box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(255,184,0,0.12); }
}
```

Applied to ticket on hover only. Duration: `4s`, timing: `ease-in-out`, infinite.

No other CSS changes — all existing animations remain as-is.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ticket-stub.tsx` | **New** — ticket stub component |
| `src/components/spotlight.tsx` | Edit — reposition beams closer, speed up |
| `src/routes/index.tsx` | Edit — restructure layout, remove first FilmStrip, merge sections |
| `src/styles.css` | Edit — update sway keyframes, add ticket-glow keyframe |
