# Title Page Drive-In Visual Redesign

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Visual/atmospheric upgrade of the existing title page — no new APIs, no new data requirements

## Summary

Transform the title page from a functional but plain layout into an immersive drive-in theater experience. The page should feel like you're at a drive-in movie theater on a starry night, with the trailer playing on the big screen and movie information presented through themed components.

This is a portfolio piece — it needs to wow.

## Page Structure (top to bottom)

### 1. Drive-In Screen (Hero/Trailer)

The trailer plays inside a physical drive-in movie screen structure:

- **Screen frame**: Dark (#111) border with `border-radius: 4px`, padding around the video area
- **Support poles**: Two vertical bars extending below the frame (positioned at 15% and 85% from left), created with `::before`/`::after` pseudo-elements
- **Film strip sprockets**: Top and bottom of the screen inner area. Full-width rows of sprocket holes using `justify-content: space-between` to fill the entire width
- **Play button**: Centered pink neon circle (80px, `border: 2.5px solid var(--neon-pink)`) with glow shadow and play triangle icon. Scales up on hover
- **"Play Trailer" label**: Below the play button, Space Mono uppercase with letter-spacing
- **Projector beam**: Subtle trapezoid gradient above the screen simulating a light beam from behind
- **Screen glow**: Radial gradient around the screen simulating light spill
- **Bottom fade**: Gradient from transparent to background color on the lower 40% of the screen

### 2. Car Silhouettes (Rear View)

Five rear-view car silhouettes below the screen:

- **Structure**: Each car has roof, rear window, body, bumper, license plate, and two tail lights
- **Tail lights**: Red glowing dots (`rgba(255,30,30,0.7)`) with `box-shadow` glow
- **Rear windows**: Subtle blue tint suggesting screen reflection
- **Size variation**: Center car is full size (scale 1), cars get smaller and more transparent toward edges (scale 0.8-0.95, opacity 0.7-0.9) to create depth
- **Spacing**: `gap: 30px`, centered, max-width matches screen area

### 3. Now Showing Marquee

Centered marquee sign announcing the movie:

- **Border**: 2px amber border with border-radius 8px and ambient glow
- **Chasing bulbs**: Two rows (top and bottom) of 6px amber circles. Odd/even children alternate animation (`chase` keyframe) with 0.6s offset to create chasing effect
- **Content**: "NOW SHOWING" in Space Mono (10px, letter-spacing 4px), movie title in Righteous (36px) with text-shadow glow, year/runtime/rating in Space Mono (12px)
- **Max-width**: 700px

### 4. Content Area

Two-column layout, `max-width: 1060px`, `gap: 48px`:

#### Left Column — Poster Display (280px wide)

**Lit display case:**
- Dark background (#0e0e14) with padding 12px, border-radius 6px
- Corner screws (4 x 6px circles with inset shadow)
- **Case light**: Thin bright line across the top (`rgba(255,255,240,0.5)` gradient) with downward box-shadow glow — simulates a lit display case
- **Light wash**: Faint gradient washing down from the top over ~60% of the poster
- **Glass reflection**: Diagonal gradient overlay suggesting glass
- **"Feature Presentation" label**: Centered below the poster, Space Mono 9px
- **Ambient glow**: Blurred pink radial gradient behind the whole case

**Genre neon signs:**
- Horizontal row of pills below the poster, centered
- Each genre is a different neon color: pink, cyan, amber
- Space Mono 11px, with matching `text-shadow` and `box-shadow` glow
- `gap: 8px`, `margin-top: 20px`

**Ring glow arcade buttons:**
- Three circular buttons in a row (`gap: 16px`, centered)
- Each button: 72px diameter, 3px border, with an outer glow ring (`::before` at inset -6px) and inner concave depth (`::after` at inset 3px with brightness filter)
- Colors: Pink (Watchlist +), Cyan (Watched checkmark), Amber (Invite envelope)
- 3D press effect: `box-shadow` with 5px bottom offset, reduces to 3px on hover with `translateY(2px)`
- Outer ring expands to inset -10px on hover
- **Labels**: Below each button, 12px Manrope bold, full cream white color

#### Right Column — Details

All section cards share this treatment:
- Background: gradient from `#0c0c20` to `#08081a`
- Border: `1px solid rgba(255,255,240,0.06)`, border-radius 8px
- Padding: 32px, margin-bottom: 28px
- **Top edge glow**: Subtle warm white line (`rgba(255,255,240,0.12)` gradient, centered 15%-85%)
- **Inner light wash**: Faint gradient from top (`rgba(255,255,240,0.015)`) fading over 60px — gives cards a gently-lit-from-above feel
- **Section headers**: Icon (32px, neutral cream-tinted background) + Righteous title (15px, cream colored `rgba(255,255,240,0.8)` with subtle white text-shadow), separated from content by a `1px solid rgba(255,255,240,0.04)` border

**Synopsis board:**
- Header with clipboard icon + "SYNOPSIS"
- Italic tagline with 3px pink left border and box-shadow glow
- Synopsis text: 15px, line-height 1.9, `rgba(255,255,240,0.7)`

**Details ticket stub:**
- Flex layout: main body | perforation | rating tear-off
- **Main body**: 2x2 metadata grid (Director, Status, Language, Runtime) with Space Mono labels (9px uppercase) and cream values (15px)
- **Perforation**: 32px wide column with dashed left border and 5 circular holes (10px, background matches page)
- **Rating tear-off**: 110px wide, amber-tinted background, Bungee Shade score (36px) with amber glow, "TMDB" label, and star rating row

**Cast film strip:**
- Header with masks icon + "CAST"
- **Film strip perforations**: Full-width rows of sprocket holes (12x8px rectangles) top and bottom, using `justify-content: space-between`
- **Scrolling cast row**: Horizontal scroll, gap 28px, hidden scrollbar
- **Cast members**: 76px circular photos with cyan border and glow, name (13px bold) and role (Space Mono 10px) below
- **Fade edge**: 70px gradient on the right side suggesting more content

### 5. Background Atmosphere

Applied globally via fixed-position overlays:

- **Night sky**: Radial gradient background, dark blue-black at top fading to pure black
- **Stars**: ~70 individually positioned star divs with varied sizes (1-2px), glow intensities, and twinkle animation timings (2.5-6s). Spread across the full viewport. Mix of pure white and slight blue-white tint
- **Film grain**: SVG noise texture at low opacity (0.3 overall, 0.05 in the SVG)
- **Ground glow**: Fixed pink radial gradient at the bottom of the viewport

## Design Decisions

- **No speakers**: Tried speakers beside the screen and as a floating element — neither added enough value. Removed for cleaner look
- **No colored accent lines on sections**: Tried pink/cyan/amber top-edge accents on the content cards — too much neon on screen. Replaced with neutral warm white treatment
- **Trailer stays at top**: Considered moving it below the content for accessibility, but the drive-in screen hero is the wow moment and should come first
- **Arcade ring-glow buttons**: Went through 30+ button style iterations. Ring glow arcade buttons won — circular, physical 3D press feel, each action gets its own neon color identity
- **Rear-view cars**: Tried side profile, simple silhouettes, and tail-lights-only. Rear view won — it's the perspective you'd actually have at a drive-in
- **Section headers neutral**: Icons and titles use cream/white tones instead of neon colors to avoid overusing pink/cyan/amber. The neon stays reserved for interactive elements (genres, buttons, rating)

## Responsive Considerations

The mockup targets desktop. Implementation should handle:
- Mobile: Stack poster above details column, reduce screen aspect ratio, smaller arcade buttons, marquee text scales down
- The existing responsive patterns in the codebase (md:flex-row / flex-col) should be followed

## Components to Create or Modify

**Modify:**
- `title.$mediaType.$tmdbId.tsx` — page layout restructure
- `hero-trailer.tsx` — replace with drive-in screen structure
- `cast-list.tsx` — add film strip frame
- `synopsis.tsx` — wrap in section board card
- `title-metadata.tsx` — ticket stub layout with perforation and rating tear-off
- `title-info-bar.tsx` — neon genre signs
- `section-divider.tsx` — remove (replaced by card spacing)

**Create:**
- `DriveInScreen` — the screen frame, poles, projector beam, screen glow
- `CarSilhouettes` — rear-view car row
- `NowShowingMarquee` — marquee sign with chasing bulbs
- `PosterDisplayCase` — lit case with glass, screws, light bar
- `SectionBoard` — reusable card wrapper with top-edge glow and light wash
- `ArcadeButton` — ring glow arcade button with label
- Night sky stars (could be part of RetroOverlays or a new component)

**Styles:**
- New animations: `chase` (bulb chasing), star `twinkle` timings
- The existing `retro-overlays.tsx` component already handles starfield/grain/scanlines — extend it or compose alongside it

## Reference Mockup

Final approved mockup: `.superpowers/brainstorm/42062-1774292079/final-v3.html`
