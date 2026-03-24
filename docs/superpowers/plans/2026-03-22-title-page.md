# Title Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a detail page for individual movies/TV shows with hero trailer, sidebar poster, metadata, and horizontal-scroll cast list.

**Architecture:** New tRPC router (`title`) fetches TMDB details/credits/videos in parallel. Single route file at `src/routes/app/title.$mediaType.$tmdbId.tsx` composes five components from `src/components/title/`. PosterCard in search results links to the title page.

**Tech Stack:** TanStack Router + Start, tRPC, TMDB API, Tailwind CSS, React 19

**Spec:** `docs/superpowers/specs/2026-03-22-title-page-design.md`

---

## File Structure

**Create:**
- `src/lib/tmdb-title.ts` — TMDB fetch functions for title details, credits, videos, content ratings
- `src/integrations/trpc/routers/title.ts` — tRPC title router with `details` procedure
- `src/components/title/hero-trailer.tsx` — Hero backdrop with play button → YouTube embed
- `src/components/title/title-info-bar.tsx` — Genre pills and content rating badge
- `src/components/title/synopsis.tsx` — Overview text with read-more toggle
- `src/components/title/title-metadata.tsx` — Director, tagline, rating, TV-specific info
- `src/components/title/cast-list.tsx` — Horizontal scroll of circular cast avatars
- `src/components/title/section-divider.tsx` — Styled gradient `<hr>`
- `src/components/title/title-page-skeleton.tsx` — Loading skeleton for entire page
- `src/routes/app/title.$mediaType.$tmdbId.tsx` — Route file composing all components

**Modify:**
- `src/lib/tmdb.ts` — Export `tmdbFetch`, extend `ImageSize` type with `w1280`
- `src/integrations/trpc/router.ts` — Register `title` router
- `src/components/search/poster-grid.tsx` — Wrap `PosterCard` in `<Link>`

---

### Task 1: Extend TMDB client

**Files:**
- Modify: `src/lib/tmdb.ts:6-13,23` (ImageSize type + export tmdbFetch)
- Create: `src/lib/tmdb-title.ts`

- [ ] **Step 1: Extend ImageSize and export tmdbFetch**

In `src/lib/tmdb.ts`, add `"w1280"` to the `ImageSize` union (line 6-13) and export the `tmdbFetch` function (line 23):

```typescript
// Line 6-13: Add w1280 and export
export type ImageSize =
	| "w92"
	| "w154"
	| "w185"
	| "w342"
	| "w500"
	| "w780"
	| "w1280"
	| "original";

// Line 23: Change `async function` to `export async function`
export async function tmdbFetch<T>(
```

- [ ] **Step 2: Create TMDB title fetch functions**

Create `src/lib/tmdb-title.ts` with types for the TMDB detail/credits/videos responses and a `fetchTitleDetails` function that calls all four endpoints in parallel. This file contains all the data fetching and mapping logic for the title page.

```typescript
import { TRPCError } from "@trpc/server";
import { tmdbFetch } from "#/lib/tmdb";

// --- TMDB response types for detail endpoints ---

interface TmdbMovieDetail {
  id: number;
  title: string;
  tagline: string | null;
  overview: string;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: Array<{ id: number; name: string }>;
  poster_path: string | null;
  backdrop_path: string | null;
}

interface TmdbTvDetail {
  id: number;
  name: string;
  tagline: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  episode_run_time: number[]; // Often empty — TMDB is deprecating this field
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  genres: Array<{ id: number; name: string }>;
  poster_path: string | null;
  backdrop_path: string | null;
  created_by: Array<{ name: string }>;
}

interface TmdbCreditsResponse {
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    order: number;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
  }>;
}

interface TmdbVideosResponse {
  results: Array<{
    key: string;
    site: string;
    type: string;
    official: boolean;
  }>;
}

interface TmdbMovieReleaseDatesResponse {
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ certification: string }>;
  }>;
}

interface TmdbTvContentRatingsResponse {
  results: Array<{
    iso_3166_1: string;
    rating: string;
  }>;
}

// --- Return type ---

export interface TitleData {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  tagline: string | null;
  overview: string;
  year: string;
  runtime: string;
  rating: number;
  contentRating: string;
  genres: string[];
  posterPath: string | null;
  backdropPath: string | null;
  director: string | null;
  trailerKey: string | null;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profilePath: string | null;
  }>;
  seasons?: number;
  episodes?: number;
  status?: string;
}

// --- Helpers ---

function formatRuntime(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function findTrailerKey(videos: TmdbVideosResponse): string | null {
  const trailer = videos.results.find(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official,
  ) ?? videos.results.find(
    (v) => v.site === "YouTube" && v.type === "Trailer",
  ) ?? videos.results.find(
    (v) => v.site === "YouTube",
  );
  return trailer?.key ?? null;
}

function findDirector(credits: TmdbCreditsResponse): string | null {
  const director = credits.crew.find((c) => c.job === "Director");
  return director?.name ?? null;
}

// --- Main fetch function ---

export async function fetchTitleDetails(
  mediaType: "movie" | "tv",
  tmdbId: number,
): Promise<TitleData> {
  const prefix = mediaType === "movie" ? "/movie" : "/tv";

  // Fetch main details first — if this fails with 404, throw NOT_FOUND
  let details: TmdbMovieDetail | TmdbTvDetail;
  try {
    details = await tmdbFetch<TmdbMovieDetail | TmdbTvDetail>(`${prefix}/${tmdbId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("404")) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Title not found" });
    }
    throw error;
  }

  // Fetch non-critical endpoints in parallel — failures return fallbacks
  const [credits, videos, ratings] = await Promise.all([
    tmdbFetch<TmdbCreditsResponse>(`${prefix}/${tmdbId}/credits`).catch(
      () => ({ cast: [], crew: [] }) as TmdbCreditsResponse,
    ),
    tmdbFetch<TmdbVideosResponse>(`${prefix}/${tmdbId}/videos`).catch(
      () => ({ results: [] }) as TmdbVideosResponse,
    ),
    mediaType === "movie"
      ? tmdbFetch<TmdbMovieReleaseDatesResponse>(
          `/movie/${tmdbId}/release_dates`,
        ).catch(() => null)
      : tmdbFetch<TmdbTvContentRatingsResponse>(
          `/tv/${tmdbId}/content_ratings`,
        ).catch(() => null),
  ]);

  // Extract content rating
  let contentRating = "NR";
  if (mediaType === "movie" && ratings) {
    const us = (ratings as TmdbMovieReleaseDatesResponse).results.find(
      (r) => r.iso_3166_1 === "US",
    );
    const cert = us?.release_dates.find((rd) => rd.certification)?.certification;
    if (cert) contentRating = cert;
  } else if (mediaType === "tv" && ratings) {
    const us = (ratings as TmdbTvContentRatingsResponse).results.find(
      (r) => r.iso_3166_1 === "US",
    );
    if (us?.rating) contentRating = us.rating;
  }

  // Build result based on media type
  if (mediaType === "movie") {
    const movie = details as TmdbMovieDetail;
    return {
      tmdbId,
      mediaType,
      title: movie.title,
      tagline: movie.tagline || null,
      overview: movie.overview,
      year: movie.release_date?.slice(0, 4) ?? "",
      runtime: formatRuntime(movie.runtime),
      rating: movie.vote_average,
      contentRating,
      genres: movie.genres.map((g) => g.name),
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      director: findDirector(credits),
      trailerKey: findTrailerKey(videos),
      cast: credits.cast.slice(0, 12).map((c) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path,
      })),
    };
  }

  // TV show
  const tv = details as TmdbTvDetail;
  const episodeRuntime = tv.episode_run_time[0];
  return {
    tmdbId,
    mediaType,
    title: tv.name,
    tagline: tv.tagline || null,
    overview: tv.overview,
    year: tv.first_air_date?.slice(0, 4) ?? "",
    runtime: episodeRuntime ? `${episodeRuntime}m per episode` : "",
    rating: tv.vote_average,
    contentRating,
    genres: tv.genres.map((g) => g.name),
    posterPath: tv.poster_path,
    backdropPath: tv.backdrop_path,
    director: tv.created_by[0]?.name ?? null,
    trailerKey: findTrailerKey(videos),
    cast: credits.cast.slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profilePath: c.profile_path,
    })),
    seasons: tv.number_of_seasons,
    episodes: tv.number_of_episodes,
    status: tv.status,
  };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in the new files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tmdb.ts src/lib/tmdb-title.ts
git commit -m "feat(title): add TMDB title detail fetch functions"
```

---

### Task 2: Create tRPC title router

**Files:**
- Create: `src/integrations/trpc/routers/title.ts`
- Modify: `src/integrations/trpc/router.ts:24-28`

- [ ] **Step 1: Create title router**

Create `src/integrations/trpc/routers/title.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "#/integrations/trpc/init";
import { fetchTitleDetails } from "#/lib/tmdb-title";

export const titleRouter = {
  details: publicProcedure
    .input(
      z.object({
        mediaType: z.enum(["movie", "tv"]),
        tmdbId: z.number(),
      }),
    )
    .query(async ({ input }) => fetchTitleDetails(input.mediaType, input.tmdbId)),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register title router**

In `src/integrations/trpc/router.ts`, add the import and register the router:

```typescript
// Add import at top
import { titleRouter } from "./routers/title";

// Add to createTRPCRouter call
export const trpcRouter = createTRPCRouter({
  todos: todosRouter,
  tasteProfile: tasteProfileRouter,
  search: searchRouter,
  title: titleRouter,
});
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/title.ts src/integrations/trpc/router.ts
git commit -m "feat(title): add tRPC title router with details procedure"
```

---

### Task 3: Create SectionDivider and TitlePageSkeleton components

**Files:**
- Create: `src/components/title/section-divider.tsx`
- Create: `src/components/title/title-page-skeleton.tsx`

- [ ] **Step 1: Create SectionDivider**

Create `src/components/title/section-divider.tsx`:

```tsx
export function SectionDivider() {
  return (
    <hr className="border-none h-px bg-gradient-to-r from-neon-pink/30 via-neon-cyan/15 to-transparent" />
  );
}
```

- [ ] **Step 2: Create TitlePageSkeleton**

Create `src/components/title/title-page-skeleton.tsx`:

```tsx
export function TitlePageSkeleton() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="relative w-full h-[280px] md:h-[480px] animate-pulse bg-cream/5" />

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1400px] px-12 py-8 flex flex-col md:flex-row gap-9">
        {/* Poster skeleton */}
        <div className="flex flex-col items-center md:items-start gap-4 shrink-0">
          <div className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] animate-pulse rounded-lg bg-cream/5" />
          <div className="w-[160px] md:w-[220px] h-11 animate-pulse rounded-md bg-cream/5" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="space-y-2">
            <div className="h-10 w-2/3 animate-pulse rounded bg-cream/5" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-cream/5" />
          </div>
          <div className="flex gap-2">
            <div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
          </div>
          <div className="h-px bg-cream/5" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-cream/5" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-cream/5" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-cream/5" />
          </div>
          <div className="h-px bg-cream/5" />
          <div className="space-y-2">
            <div className="h-4 w-1/4 animate-pulse rounded bg-cream/5" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-cream/5" />
          </div>
          <div className="h-px bg-cream/5" />
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 min-w-[90px]">
                <div className="w-[68px] h-[68px] rounded-full animate-pulse bg-cream/5" />
                <div className="h-3 w-16 animate-pulse rounded bg-cream/5" />
                <div className="h-2.5 w-14 animate-pulse rounded bg-cream/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/title/section-divider.tsx src/components/title/title-page-skeleton.tsx
git commit -m "feat(title): add SectionDivider and TitlePageSkeleton components"
```

---

### Task 4: Create HeroTrailer component

**Files:**
- Create: `src/components/title/hero-trailer.tsx`

- [ ] **Step 1: Create HeroTrailer**

Create `src/components/title/hero-trailer.tsx`:

```tsx
import { useState } from "react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface HeroTrailerProps {
  backdropPath: string | null;
  trailerKey: string | null;
}

export function HeroTrailer({ backdropPath, trailerKey }: HeroTrailerProps) {
  const [playing, setPlaying] = useState(false);
  const backdropUrl = getTmdbImageUrl(backdropPath, "w1280");

  return (
    <div className="relative w-full h-[280px] md:h-[480px] overflow-hidden bg-drive-in-bg">
      {playing && trailerKey ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
          title="Trailer"
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="absolute inset-0 w-full h-full z-10"
        />
      ) : (
        <>
          {/* Backdrop image or gradient fallback */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={
              backdropUrl
                ? { backgroundImage: `url(${backdropUrl})` }
                : {
                    background:
                      "radial-gradient(ellipse at 30% 40%, #1a1040 0%, #0d0d1a 50%, #050510 100%)",
                  }
            }
          />

          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(5,5,8,0.7)_100%)] pointer-events-none" />

          {/* Bottom gradient */}
          <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-drive-in-bg to-transparent" />

          {/* Play button — only if trailer exists */}
          {trailerKey && (
            <button
              type="button"
              aria-label="Play trailer"
              onClick={() => setPlaying(true)}
              className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 z-20 group cursor-pointer"
            >
              <div className="w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-full bg-neon-pink flex items-center justify-center shadow-[0_0_40px_rgba(255,45,120,0.5),0_0_80px_rgba(255,45,120,0.2)] group-hover:scale-110 group-hover:shadow-[0_0_50px_rgba(255,45,120,0.6),0_0_100px_rgba(255,45,120,0.3)] transition-all duration-200">
                <div className="w-0 h-0 border-l-[18px] md:border-l-[24px] border-l-white border-t-[10px] md:border-t-[14px] border-t-transparent border-b-[10px] md:border-b-[14px] border-b-transparent ml-1" />
              </div>
              <span className="text-cream/70 text-[11px] tracking-[3px] uppercase font-mono-retro">
                Play Trailer
              </span>
            </button>
          )}
        </>
      )}

      {/* Film strip top */}
      <div className="absolute top-0 left-0 right-0 h-[18px] bg-[#111] flex items-center justify-center gap-3 z-30 border-b border-neon-pink/15">
        {Array.from({ length: 60 }, (_, i) => (
          <div
            key={i}
            className="w-2.5 h-[7px] rounded-[1px] bg-drive-in-bg shadow-[inset_0_0_2px_rgba(0,0,0,0.8)]"
          />
        ))}
      </div>

      {/* Film strip bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[18px] bg-[#111] flex items-center justify-center gap-3 z-30 border-t border-neon-pink/15">
        {Array.from({ length: 60 }, (_, i) => (
          <div
            key={i}
            className="w-2.5 h-[7px] rounded-[1px] bg-drive-in-bg shadow-[inset_0_0_2px_rgba(0,0,0,0.8)]"
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/hero-trailer.tsx
git commit -m "feat(title): add HeroTrailer component with YouTube embed"
```

---

### Task 5: Create TitleInfoBar, Synopsis, and TitleMetadata components

**Files:**
- Create: `src/components/title/title-info-bar.tsx`
- Create: `src/components/title/synopsis.tsx`
- Create: `src/components/title/title-metadata.tsx`

- [ ] **Step 1: Create TitleInfoBar**

Create `src/components/title/title-info-bar.tsx`:

```tsx
interface TitleInfoBarProps {
  contentRating: string;
  genres: string[];
}

export function TitleInfoBar({ contentRating, genres }: TitleInfoBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {contentRating && contentRating !== "NR" && (
        <span className="px-2 py-0.5 border border-neon-amber/40 rounded text-[11px] font-mono-retro font-semibold text-neon-amber [text-shadow:0_0_6px_rgba(255,184,0,0.3)]">
          {contentRating}
        </span>
      )}
      {genres.map((genre) => (
        <span
          key={genre}
          className="px-3.5 py-1 border border-neon-pink/25 rounded-full font-mono-retro text-[11px] text-cream/80 tracking-wider hover:border-neon-pink/60 hover:shadow-[0_0_10px_rgba(255,45,120,0.2)] transition-all"
        >
          {genre}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create Synopsis**

Create `src/components/title/synopsis.tsx`:

```tsx
import { useState } from "react";

interface SynopsisProps {
  overview: string;
}

const MAX_LENGTH = 300;

export function Synopsis({ overview }: SynopsisProps) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = overview.length > MAX_LENGTH;
  const displayText =
    needsTruncation && !expanded
      ? `${overview.slice(0, MAX_LENGTH)}...`
      : overview;

  return (
    <div>
      <div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
        Synopsis
      </div>
      <p className="text-[15px] leading-[1.7] text-cream/80">{displayText}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-neon-cyan text-[13px] mt-1.5 [text-shadow:0_0_8px_rgba(0,229,255,0.3)] cursor-pointer"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create TitleMetadata**

Create `src/components/title/title-metadata.tsx`:

```tsx
interface TitleMetadataProps {
  director: string | null;
  tagline: string | null;
  rating: number;
  seasons?: number;
  episodes?: number;
  status?: string;
}

export function TitleMetadata({
  director,
  tagline,
  rating,
  seasons,
  episodes,
  status,
}: TitleMetadataProps) {
  return (
    <div>
      <div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
        Details
      </div>

      {tagline && (
        <p className="italic text-cream/50 text-[15px] border-l-2 border-neon-pink pl-3.5 mb-3.5 [text-shadow:0_0_12px_rgba(255,45,120,0.1)]">
          &ldquo;{tagline}&rdquo;
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {director && (
          <div className="flex gap-2 text-sm">
            <span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
              Director
            </span>
            <span className="text-cream/80">{director}</span>
          </div>
        )}

        <div className="flex gap-2 text-sm">
          <span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
            Rating
          </span>
          <span className="text-cream/80">
            <span className="text-neon-amber [text-shadow:0_0_6px_rgba(255,184,0,0.4)]">
              ★
            </span>{" "}
            {rating.toFixed(1)} / 10
          </span>
        </div>

        {seasons != null && (
          <div className="flex gap-2 text-sm">
            <span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
              Seasons
            </span>
            <span className="text-cream/80">{seasons}</span>
          </div>
        )}

        {episodes != null && (
          <div className="flex gap-2 text-sm">
            <span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
              Episodes
            </span>
            <span className="text-cream/80">{episodes}</span>
          </div>
        )}

        {status && (
          <div className="flex gap-2 text-sm">
            <span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
              Status
            </span>
            <span className="text-cream/80">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/title/title-info-bar.tsx src/components/title/synopsis.tsx src/components/title/title-metadata.tsx
git commit -m "feat(title): add TitleInfoBar, Synopsis, and TitleMetadata components"
```

---

### Task 6: Create CastList component

**Files:**
- Create: `src/components/title/cast-list.tsx`

- [ ] **Step 1: Create CastList**

Create `src/components/title/cast-list.tsx`:

```tsx
import { getTmdbImageUrl } from "#/lib/tmdb";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

interface CastListProps {
  cast: CastMember[];
}

export function CastList({ cast }: CastListProps) {
  if (cast.length === 0) return null;

  return (
    <div>
      <div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
        Cast
      </div>
      <div className="relative">
        <div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {cast.map((member) => {
            const photoUrl = getTmdbImageUrl(member.profilePath, "w185");
            return (
              <div
                key={member.id}
                className="flex flex-col items-center gap-2 min-w-[90px] group"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={member.name}
                    className="w-[68px] h-[68px] rounded-full object-cover border-2 border-neon-pink/30 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-pink/70 group-hover:shadow-[0_0_12px_rgba(255,45,120,0.3)] transition-all"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-[#2a1a4e] to-[#1a3a5e] border-2 border-neon-pink/30 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-pink/70 group-hover:shadow-[0_0_12px_rgba(255,45,120,0.3)] transition-all" />
                )}
                <span className="text-[11px] text-cream font-semibold text-center">
                  {member.name}
                </span>
                <span className="text-[10px] text-cream/40 text-center -mt-1">
                  {member.character}
                </span>
              </div>
            );
          })}
        </div>
        {/* Right fade effect */}
        <div className="absolute top-0 right-0 bottom-2 w-[60px] bg-gradient-to-r from-transparent to-drive-in-bg pointer-events-none" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/title/cast-list.tsx
git commit -m "feat(title): add CastList component with horizontal scroll"
```

---

### Task 7: Create the title route page

**Files:**
- Create: `src/routes/app/title.$mediaType.$tmdbId.tsx`

Docs to check: @node_modules/@tanstack/router-core/skills/router-core/SKILL.md for route file patterns.

- [ ] **Step 1: Create the route file**

Create `src/routes/app/title.$mediaType.$tmdbId.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { getTmdbImageUrl } from "#/lib/tmdb";
import { HeroTrailer } from "#/components/title/hero-trailer";
import { TitleInfoBar } from "#/components/title/title-info-bar";
import { Synopsis } from "#/components/title/synopsis";
import { TitleMetadata } from "#/components/title/title-metadata";
import { CastList } from "#/components/title/cast-list";
import { SectionDivider } from "#/components/title/section-divider";
import { TitlePageSkeleton } from "#/components/title/title-page-skeleton";

const paramsSchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.coerce.number(),
});

export const Route = createFileRoute("/app/title/$mediaType/$tmdbId")({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: (params) => ({
      mediaType: params.mediaType,
      tmdbId: String(params.tmdbId),
    }),
  },
  loader: async ({ params, context }) => {
    // Prefetch title data so the page renders immediately
    const trpc = context.trpc;
    return trpc.title.details.query({
      mediaType: params.mediaType,
      tmdbId: params.tmdbId,
    });
  },
  component: TitlePage,
  pendingComponent: TitlePageSkeleton,
  errorComponent: TitleErrorPage,
});

function TitleErrorPage() {
  const { error } = Route.useRouteError?.() ?? {};
  const isNotFound = error?.data?.code === "NOT_FOUND";

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-cream/50 text-lg mb-2">
        {isNotFound ? "Title not found" : "Something went wrong"}
      </p>
      <p className="text-cream/30 text-sm mb-6">
        {isNotFound
          ? "We couldn\u2019t find the title you\u2019re looking for."
          : "Failed to load title details. Please try again."}
      </p>
      <div className="flex gap-3">
        {!isNotFound && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-neon-pink/30 bg-neon-pink/10 px-4 py-2 text-sm text-neon-pink hover:bg-neon-pink/20 transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
        <Link
          to="/app/search"
          className="rounded-lg border border-cream/20 bg-cream/5 px-4 py-2 text-sm text-cream/70 hover:bg-cream/10 transition-colors"
        >
          Back to Search
        </Link>
      </div>
    </div>
  );
}

function TitlePage() {
  const { mediaType, tmdbId } = Route.useParams();
  const trpc = useTRPC();

  const { data } = useQuery(
    trpc.title.details.queryOptions({ mediaType, tmdbId }),
  );

  // Data should always be available via the loader, but guard just in case
  if (!data) return <TitlePageSkeleton />;

  const posterUrl = getTmdbImageUrl(data.posterPath, "w342");

  return (
    <div>
      <HeroTrailer
        backdropPath={data.backdropPath}
        trailerKey={data.trailerKey}
      />

      <div className="mx-auto max-w-[1400px] px-5 md:px-12 py-8 flex flex-col md:flex-row gap-6 md:gap-9">
        {/* Poster sidebar */}
        <div className="flex flex-col items-center md:items-start gap-4 shrink-0">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={`${data.title} poster`}
              className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] rounded-lg object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_15px_rgba(255,45,120,0.1)] border border-neon-pink/10"
            />
          ) : (
            <div className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] rounded-lg bg-gradient-to-br from-[#2a1a4e] to-[#1a3a5e] shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-neon-pink/10 flex items-center justify-center text-cream/20 text-xs">
              No Poster
            </div>
          )}
          <button
            type="button"
            // TODO: implement watchlist functionality
            onClick={() => {}}
            className="w-[160px] md:w-[220px] py-3 rounded-md bg-neon-pink text-white font-semibold text-sm tracking-wider shadow-[0_0_20px_rgba(255,45,120,0.3)] hover:shadow-[0_0_30px_rgba(255,45,120,0.5)] hover:-translate-y-0.5 transition-all cursor-pointer"
          >
            + Add to Watchlist
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-7">
          {/* Title heading */}
          <div>
            <h1 className="font-display text-[28px] md:text-[38px] text-white tracking-wide [text-shadow:0_0_20px_rgba(255,45,120,0.4),0_0_40px_rgba(255,45,120,0.15)]">
              {data.title}
            </h1>
            <div className="flex items-center gap-2 text-sm text-cream/60 mt-1.5">
              <span>{data.year}</span>
              {data.runtime && (
                <>
                  <span>&bull;</span>
                  <span>{data.runtime}</span>
                </>
              )}
              <span>&bull;</span>
              <span className="text-neon-amber [text-shadow:0_0_8px_rgba(255,184,0,0.5)]">
                ★ {data.rating.toFixed(1)}
              </span>
            </div>
          </div>

          <TitleInfoBar
            contentRating={data.contentRating}
            genres={data.genres}
          />

          <SectionDivider />

          <Synopsis overview={data.overview} />

          <SectionDivider />

          <TitleMetadata
            director={data.director}
            tagline={data.tagline}
            rating={data.rating}
            seasons={data.seasons}
            episodes={data.episodes}
            status={data.status}
          />

          <SectionDivider />

          <CastList cast={data.cast} />
        </div>
      </div>
    </div>
  );
}
```

**Note on the loader:** The `context.trpc` access pattern depends on how TanStack Router's context is set up in this project. If tRPC is not available in the router context, fall back to importing and calling `fetchTitleDetails` directly as a server function, or use `useQuery` without a loader and rely on `TitlePageSkeleton` as the loading state. Check the existing route context setup in `src/routes/__root.tsx` before implementing.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors. Note: TanStack Router may auto-generate route types on build — if there are type errors about the route, run `bun run dev` briefly to trigger route generation.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat(title): add title page route with all components"
```

---

### Task 8: Link PosterCard to title page

**Files:**
- Modify: `src/components/search/poster-grid.tsx:1-16`

- [ ] **Step 1: Wrap PosterCard in Link**

In `src/components/search/poster-grid.tsx`, add a `<Link>` wrapper around each `PosterCard`:

```tsx
import { Link } from "@tanstack/react-router";
import type { FeedItem } from "#/lib/feed-assembler";
import { PosterCard } from "./poster-card";

interface PosterGridProps {
  items: FeedItem[];
}

export function PosterGrid({ items }: PosterGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <Link
          key={`${item.tmdbId}-${item.mediaType}`}
          to="/app/title/$mediaType/$tmdbId"
          params={{
            mediaType: item.mediaType,
            tmdbId: String(item.tmdbId),
          }}
          className="block"
        >
          <PosterCard item={item} />
        </Link>
      ))}
    </div>
  );
}
```

Keep the `PosterGridSkeleton` export unchanged below.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Run: `bun run dev`
1. Navigate to `/app/search`, search for a movie
2. Click on a poster card — should navigate to `/app/title/movie/{id}`
3. Verify: hero trailer loads with backdrop, poster appears in sidebar, cast scrolls horizontally
4. Test a TV show as well — search for a show, click it, verify TV-specific fields (seasons, episodes, status)
5. Test the play button — click it, verify YouTube embed loads
6. Test mobile layout — resize browser to < 768px, verify poster stacks centered above content

- [ ] **Step 4: Commit**

```bash
git add src/components/search/poster-grid.tsx
git commit -m "feat(title): link PosterCard to title page"
```
