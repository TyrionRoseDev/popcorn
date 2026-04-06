# Achievement Celebration Popup — Design Spec

## Problem

When a user earns an achievement (marks a movie watched, writes a review, etc.), the server evaluates and records it — but the client never shows a celebration. The `AchievementPopup` component exists with full animations (projector beam, floating particles, badge flip) but is never rendered.

## Solution

Wire up a global client-side interceptor that detects newly earned achievements from any mutation response and displays the existing `AchievementPopup`.

## Architecture

### 1. Server: Return `newAchievements` from all mutations

Five mutations currently call `evaluateAchievements()` but discard the result. Each needs a one-line fix to capture and return the array:

| Mutation | Router file | Current behavior |
|---|---|---|
| `recommendation.send` | `recommendation.ts:133` | `await evaluateAchievements(...)` — discards |
| `shuffle.swipe` | `shuffle.ts:315,346,389` | `await evaluateAchievements(...)` — discards (3 sites) |
| `watchlist.join` | `watchlist.ts:692` | `await evaluateAchievements(...)` — discards |
| `tasteProfile.saveTasteProfile` | `taste-profile.ts:407` | `await evaluateAchievements(...)` — discards |
| `tasteProfile.completeOnboarding` | `taste-profile.ts:433` | `await evaluateAchievements(...)` — discards |
| `friend.acceptRequest` | `friend.ts:424-425` | Evaluates for both users, uses for notifications, but doesn't return current user's result |

Four mutations already return `newAchievements` and need no changes:
- `watchlist.markWatched`
- `watchlist.create`
- `review.upsert`
- `achievement.sync`

### 2. Client: Global MutationCache interceptor

Add a `MutationCache` with an `onSuccess` callback to the existing `QueryClient` in `root-provider.tsx`. This callback inspects every mutation response for a `newAchievements` property. When found and non-empty, it pushes the achievement IDs into the celebration context.

No changes to any existing mutation call sites — the interceptor catches everything globally.

### 3. Client: AchievementCelebrationProvider

A React context provider that:

- Holds a queue of pending achievement IDs to celebrate
- Tracks `earnedTotal` (fetched from the `achievement.myAchievements` query)
- Renders the existing `AchievementPopup` component when the queue is non-empty
- On dismiss: clears the queue and invalidates the `myAchievements` query to refresh counts
- Exposes a `celebrate(ids: string[])` function via context (used by the MutationCache callback)

### 4. Client: App layout integration

Wrap the app with `AchievementCelebrationProvider` inside the existing provider tree in the root layout. The provider renders the popup as a portal/dialog overlay — no changes to individual pages or components.

## Files touched

| File | Change |
|---|---|
| `src/integrations/trpc/routers/recommendation.ts` | Capture + return `newAchievements` |
| `src/integrations/trpc/routers/shuffle.ts` | Capture + return `newAchievements` (3 sites, merge into single return) |
| `src/integrations/trpc/routers/watchlist.ts` | Capture + return `newAchievements` from `join` |
| `src/integrations/trpc/routers/taste-profile.ts` | Capture + return `newAchievements` from both onboarding mutations |
| `src/integrations/trpc/routers/friend.ts` | Return current user's `newAchievements` from `acceptRequest` |
| `src/integrations/tanstack-query/root-provider.tsx` | Add `MutationCache.onSuccess` to `QueryClient` |
| `src/components/achievements/achievement-celebration-provider.tsx` | New file — context + provider |
| `src/components/achievements/achievement-popup.tsx` | Rework from one-at-a-time to summary layout showing all earned badges in a grid |
| App root layout | Wrap with `AchievementCelebrationProvider` |

## Edge cases

- **Multiple achievements at once**: Show a single summary popup with all earned badges visible (e.g., "You earned 3 achievements!") and a grid of badges. The existing `AchievementPopup` component needs to be reworked from its current one-at-a-time flow to this summary layout.
- **Rapid successive mutations**: Queue accumulates; if the popup is already open, newly earned achievements are appended to the current display.
- **SSR/hydration**: `MutationCache` callback only fires on the client, so no SSR concerns.
- **Achievement sync on profile visit**: The existing `achievement.sync` mutation already returns `newAchievements` — the interceptor will catch these too, so visiting your profile may trigger celebrations for backfilled achievements.
