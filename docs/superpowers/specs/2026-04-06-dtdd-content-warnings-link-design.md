# Does the Dog Die Content Warnings Link

## Overview

Add an always-visible, caring message with a link to Does the Dog Die on every title page, placed near the synopsis. Helps sensitive viewers check for content warnings before watching.

## Design

### Placement

Near the synopsis section of the title page (`title.$mediaType.$tmdbId.tsx`), always visible — not hidden behind a toggle or icon.

### Content

A short, warm message reassuring the viewer, followed by a link to the movie/show's Does the Dog Die page. The tone should feel caring and loving — not clinical or cautionary.

Example copy (final wording to be refined during implementation):

> "If you're feeling unsure about this one, that's okay. You can check for content warnings before watching."

Followed by a link to Does the Dog Die.

### Link Generation

Does the Dog Die supports direct TMDB-based URLs:

- Movies: `https://www.doesthedogdie.com/media/tmdb-movie/{tmdbId}`
- TV shows: `https://www.doesthedogdie.com/media/tmdb-tv/{tmdbId}`

The app already has `tmdbId` and `mediaType` for every title, so the link is generated automatically with no new API calls or database changes.

### Visual Treatment

- Should feel gentle and unobtrusive — present but not loud
- Opens in a new tab
- Visual styling to be determined during implementation using the frontend-design skill, keeping consistent with the app's existing aesthetic

## Scope

- One new component near the synopsis
- No new API calls
- No database changes
- No external ID fetching
- Movies and TV shows both supported

## Out of Scope

- Other external links (IMDb, Letterboxd, TMDB, etc.)
- Embedding DTDD data directly in the app
- Content warning badges or inline trigger lists
