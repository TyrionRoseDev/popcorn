# Achievement Celebration Popup — Theatre Redesign

## Problem

The current achievement popup uses a dark blur backdrop with neon-colored card borders that don't match the app's drive-in cinema aesthetic. The celebration moment should feel like a grand theatre awards ceremony.

## Design

Full-screen overlay that transforms the screen into a theatre stage when achievements are earned.

### Visual Elements (layered back to front)

1. **Dark backdrop** — `rgba(5,5,8,0.92)` with backdrop blur (same as current)

2. **Red curtain swag** — SVG scalloped valance draped across the top edge of the screen. Uses crimson-to-dark-red gradient to simulate velvet folds. No gold pelmet bar.

3. **Thin curtain slivers** — 8% width strips at left and right edges. Red velvet gradient with `inset box-shadow` to simulate fabric folds and depth. Cast shadow toward the stage center.

4. **Spotlight cone** — Radial gradient from top center, warm white fading to transparent. Illuminates the badge area.

5. **Stage floor** — Gradient strip at the bottom (dark warm brown), with a subtle gold highlight line at the stage edge.

6. **Confetti particles** — Existing rectangular tumbling confetti (already implemented) renders over everything.

7. **Trophy emojis** — Two 🏆 at 72px flanking the badge card, slightly rotated (±5deg), with gold `drop-shadow` glow. Positioned vertically centered alongside the card in a horizontal flex row.

8. **Badge card** — 180×220px, `border-radius: 16px`, 3px gold gradient border (`linear-gradient(135deg, #FFD700, #B8860B, #DAA520, #B8860B, #FFD700)`). Dark purple interior (`#1a1020` to `#0f0a18`). Contains:
   - Achievement icon (56px) with gold drop-shadow
   - Achievement name in gold (`#FFD700`) with glow text-shadow
   - Description in bright cream (`rgba(245,240,232,0.8)`)

9. **"Achievement Unlocked" label** — Above the card, gold monospace, letter-spacing 5px, with gold text-shadow glow.

10. **Progress counter** — Below the card, gold monospace, shows `{earned} / {total} Achievements`.

11. **Continue button** — Positioned at the bottom on the stage floor area. Gold border, gold text, rounded pill shape, monospace uppercase.

### Multiple Achievements Layout

When multiple achievements are earned at once, cards are arranged in a horizontal row:
- `🏆 [Card] [Card] 🏆` — trophies bookend the row
- Cards use the same staggered flip-in animation (delay per card)
- For 3+ cards, reduce card size slightly to fit

### Animations

- Badge cards: staggered flip-in (`rotateY 90→0`, 0.15s delay per card) — keep existing
- Trophies: fade-in with slight upward bounce (spring animation)
- Curtain swag: static (no animation needed)
- Confetti: existing tumbling rectangular particles — keep as-is
- Spotlight: subtle slow pulse (opacity 0.08 ↔ 0.12)

### What Changes

| Element | Current | New |
|---|---|---|
| Backdrop overlay | Dark blur | Dark blur + curtain swag + curtain slivers + stage floor |
| Card border | Neon conic gradient (pink→amber→cyan) | Gold gradient matching theatre trim |
| Card interior | `#0a0a1e` | Dark purple `#1a1020` to `#0f0a18` |
| Achievement name color | `cream/90` | `#FFD700` (gold) |
| Description color | `cream/40` | `cream/80` (brighter) |
| Trophies | None | Two 🏆 emoji flanking the card |
| Confetti | Rectangular tumbling particles | Keep as-is |

### Files Touched

- `src/components/achievements/achievement-popup.tsx` — replace backdrop, card styling, add theatre elements and trophies
