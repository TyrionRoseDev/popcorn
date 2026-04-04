# Settings Page Redesign

## Overview

Redesign the settings page to feel less empty and visually align with the app's retro/drive-in aesthetic, while keeping it clear and functional. Add taste profile editing and data export.

## Current State

The settings page (`/app/settings`) has three editable fields (profile picture, username, email) in a single card, plus a danger zone with delete account. It's visually plain compared to the rest of the app and feels sparse.

## Design

### Layout: Grouped Sections with Inline Preview

The page uses labeled section groups, each in its own card. The taste profile section shows the user's actual data inline (genre tags, film title, bio text) rather than just navigation links. All editable items have a Lucide pencil icon (`Pencil` from lucide-react) to clearly signal they are tappable/clickable.

**Page structure (top to bottom):**

1. **Header** — "Settings" in Righteous font
2. **Profile summary** — avatar + username + email in a subtle card, pencil icon on the avatar
3. **Account section** — profile picture, username, email rows with current values and pencil icons
4. **Taste Profile section** — inline display of genres (as tags), favorite film (with poster thumbnail), and bio text, each with pencil icons
5. **Data & Privacy section** — export data (with "Download" action label), blocked users (with chevron to sub-route)
6. **Danger Zone** — delete account button in neon-pink styling

### Sections Detail

#### Profile Summary (top of page)

A compact card showing the user's avatar, username, and email at a glance. Tapping opens the avatar change dialog. The pencil icon sits on the avatar to indicate editability.

- Avatar: 48px circle, falls back to initial letter on gradient background
- Username: `text-sm font-semibold text-cream`
- Email: `text-xs text-cream/50`

#### Account Section

Label: "ACCOUNT" (uppercase, small, `text-cream/30`)

Card with three rows, each a button opening the existing dialog:

| Row | Left label | Right side | Action |
|-----|-----------|------------|--------|
| Profile Picture | "Profile Picture" | Avatar thumbnail (24px) + Pencil icon | Opens `ChangeAvatarDialog` |
| Username | "Username" | Current value + Pencil icon | Opens `ChangeUsernameDialog` |
| Email | "Email" | Current value (truncated) + Pencil icon | Opens `ChangeEmailDialog` |

These reuse the existing dialog components with no changes.

#### Taste Profile Section

Label: "TASTE PROFILE" (uppercase, small, `text-cream/30`)

A single card with three inline-preview sub-sections, each clickable:

**Genres:**
- Sub-label: "GENRES" (tiny uppercase)
- Display: Row of pill tags in `bg-neon-cyan/10 text-neon-cyan` for each of the user's `userGenre` entries, resolved to names via `UNIFIED_GENRES`
- Pencil icon top-right
- Action: Opens a genre edit dialog (new component)

**Favorite Film:**
- Sub-label: "FAVORITE FILM"
- Display: Small poster thumbnail (26x38px) + film title, fetched via the existing TMDB integration using `favouriteFilmTmdbId`
- If not set: "Not set" in muted text
- Pencil icon top-right
- Action: Opens a favorite film edit dialog (new component — search-and-select like onboarding step 4)

**Bio:**
- Sub-label: "BIO"
- Display: Bio text in italic muted style, or "Not set"
- Pencil icon top-right
- Action: Opens a bio edit dialog (new component — text input, 100 char limit)

#### Data & Privacy Section

Label: "DATA & PRIVACY" (uppercase, small, `text-cream/30`)

Card with two rows:

| Row | Left label | Right side | Action |
|-----|-----------|------------|--------|
| Export Data | "Export Data" | "Download" in neon-cyan | Triggers data export (JSON download) |
| Blocked Users | "Blocked Users" | Chevron `›` | Navigates to `/app/settings/blocked` |

#### Danger Zone

Label: "DANGER ZONE" (uppercase, small, `text-neon-pink/30`)

Single button styled with `bg-neon-pink/5 border-neon-pink/15 text-neon-pink/70`. Reuses existing `DeleteAccountDialog`.

### New Components Needed

1. **`EditGenresDialog`** — multi-select genre picker (reuse genre data from `UNIFIED_GENRES`). Saves via a new tRPC mutation that replaces the user's `userGenre` rows. Enforce 3-5 genre selection like onboarding.

2. **`EditFavouriteFilmDialog`** — search input that queries TMDB, select a film. Saves `favouriteFilmTmdbId` via `tasteProfile.saveProfileExtras` or a new dedicated mutation. Allow clearing (set to null).

3. **`EditBioDialog`** — text input with 100 character limit and live counter. Saves `bio` via `tasteProfile.saveProfileExtras` or a new dedicated mutation. Allow clearing.

4. **Data export endpoint** — tRPC procedure that queries the user's data across all tables (profile, watchlists, watchlist items, friends, genre preferences, user titles) and returns it as a downloadable JSON file. This is tracked as a separate task.

### Data Export

A tRPC endpoint (`user.exportData` or similar) that:

1. Queries all user-related data: profile fields, watchlists + items, friends, userGenre, userTitle, block list
2. Serializes to a structured JSON object
3. Returns as a downloadable file (`popcorn-export-{username}-{date}.json`)

The settings page triggers the download when the user clicks "Download" in the Data & Privacy section. Show a loading spinner while the export is being generated.

### Styling

- **Fonts:** Righteous for the page heading, Manrope for all body text — matching the rest of the app
- **Colors:** Same theme tokens used throughout: `cream`, `neon-cyan`, `neon-pink`, `drive-in-card`, `drive-in-bg`
- **Cards:** `bg-cream/[0.02] border border-cream/[0.04] rounded-xl` (subtle, not heavy)
- **Section labels:** `text-[9px] uppercase tracking-wider font-semibold text-cream/20`
- **Row items:** `px-3.5 py-3` with `border-b border-cream/[0.04]` dividers, `hover:bg-cream/[0.03]` transition
- **Pencil icons:** `h-3.5 w-3.5 text-cream/20` — subtle but present on every editable row
- **Max width:** `max-w-lg` centered, same as current

### What Stays the Same

- All four existing dialog components (`ChangeAvatarDialog`, `ChangeUsernameDialog`, `ChangeEmailDialog`, `DeleteAccountDialog`) remain unchanged
- The blocked users sub-route at `/app/settings/blocked` remains unchanged
- Auth flows (Better Auth) remain unchanged
- Route guard / authentication check remains unchanged

### What Changes

- `src/routes/app/settings.tsx` — complete rewrite of the page layout
- Three new dialog components in `src/components/settings/`
- New tRPC mutations for updating genres, favorite film, and bio individually
- New tRPC endpoint for data export
