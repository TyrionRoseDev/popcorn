# Achievements System Design

## Overview

A real, tracked achievements system for Popcorn. Achievements auto-trigger when conditions are met, show a celebratory full-screen popup to the earner, and notify friends. 30 achievements at launch across 9 categories.

## Design Decisions

- **Static definitions + inline checks** — achievement definitions live in a TypeScript config file, conditions are checked inline after relevant tRPC mutations
- **Single tier** — every achievement is one gold unlock, no bronze/silver progression
- **Drive-in neon sign badge style** — conic gradient border using site colors (pink `#FF2D78`, amber `#FFB800`, cyan `#00E5FF`), glowing icon, monospace label
- **Celebratory unlock popup** — full-screen modal with backdrop blur, projector sweep, floating particles in site colors, neon badge flip-in animation, amber accent
- **Friends are notified** — new notification type `achievement_earned`
- **Profile visibility** — non-friends see achievement count only, friends see full detail + comparison view
- **Comparison view** — "All" (default) and "Shared" filter; each badge shows who earned it with dates
- **watchedAt timestamp** — added to watchlist items so time-based achievements track actual watch time, not log time. Users can set date/time when marking watched or skip (defaults to now)
- **Review on watch** — prompted when marking watched; star rating (1-5), optional text, skippable
- **Recommend to friend** — from title page, pick friend(s) to recommend to

## Database Changes

### New Tables

#### `achievement`
Stores earned achievements per user.

| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | UUID |
| userId | text (FK → user) | |
| achievementId | text | matches config ID |
| earnedAt | timestamp | when unlocked |

Unique constraint on `(userId, achievementId)`.

#### `review`
User reviews/ratings for titles.

| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | UUID |
| userId | text (FK → user) | |
| tmdbId | integer | |
| mediaType | text | "movie" or "tv" |
| rating | integer | 1-5 stars |
| text | text | optional |
| createdAt | timestamp | |

Unique constraint on `(userId, tmdbId, mediaType)`.

#### `recommendation`
Title recommendations between friends.

| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | UUID |
| senderId | text (FK → user) | |
| recipientId | text (FK → user) | |
| tmdbId | integer | |
| mediaType | text | "movie" or "tv" |
| createdAt | timestamp | |

### Modified Tables

#### `watchlistItem`
Add column:

| Column | Type | Notes |
|--------|------|-------|
| watchedAt | timestamp | nullable, set when marking watched |

## Achievement Definitions

All 30 achievements defined in `src/lib/achievements.ts`.

### Config Shape

```ts
{
  id: "first-watch",
  name: "First Watch",
  description: "Log your first watch",
  icon: "🎬",
  category: "watching",
  condition: { type: "watchedCount", threshold: 1 }
}
```

### Categories & Condition Types

| Category | Condition Type | Description |
|----------|---------------|-------------|
| watching | `watchedCount` | Total items marked watched |
| watching | `genreCount` | Unique genres watched |
| time-based | `watchedAtTime` | Time-of-day check on watchedAt |
| time-based | `watchedWithinWindow` | Two watches within X hours |
| social | `friendCount` | Total accepted friends |
| social | `joinedCollabWatchlist` | Joined a collaborative watchlist |
| social | `sameTitleSameDay` | Watched same title as friend on same day |
| discovery | `totalSwipes` | Total shuffle swipes |
| discovery | `shuffleToWatchlist` | Added from shuffle to a watchlist |
| watchlists | `watchlistCount` | Total watchlists created |
| watchlists | `clearedWatchlist` | All items watched on a list (min 5 items) |
| watchlists | `rewatch` | Marked a previously-watched title as watched again (detected via existing `watchedAt` timestamp when re-marking) |
| recommendations | `sentRecommendation` | Sent a recommendation |
| recommendations | `recWatched` | Friend watched your recommendation |
| recommendations | `recRatedHighly` | Friend rated your recommendation 4+ stars |
| reviews | `firstReview` | Left first review |
| reviews | `reviewCount` | Total reviews written |
| profile | `onboardingCompleted` | Finished onboarding flow |
| meta | `achievementCount` | Number of earned achievements |

### Full Achievement List

#### Watching (8)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 1 | first-watch | First Watch | Log your first watch | watchedCount ≥ 1 |
| 2 | ten-spot | Ten Spot | Log 10 watches | watchedCount ≥ 10 |
| 3 | century-club | Century Club | Log 100 watches | watchedCount ≥ 100 |
| 4 | film-buff | Film Buff | Log 250 watches | watchedCount ≥ 250 |
| 5 | projectionist | Projectionist | Log 500 watches | watchedCount ≥ 500 |
| 6 | curtain-call | Curtain Call | Log 1000 watches | watchedCount ≥ 1000 |
| 7 | genre-hopper | Genre Hopper | Watch across 5 different genres | genreCount ≥ 5 |
| 8 | well-rounded | Well Rounded | Watch across every genre | genreCount = total genres |

#### Time-Based (3)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 9 | night-owl | Night Owl | Watch something after midnight | watchedAtTime between 00:00–04:59 |
| 10 | early-bird | Early Bird | Watch something before 11:59am | watchedAtTime before 11:59 |
| 11 | back-to-back | Back to Back | Watch 2 titles within 3 hours | watchedWithinWindow ≤ 3hrs |

#### Social (5)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 12 | plus-one | Plus One | Add your first friend | friendCount ≥ 1 |
| 13 | inner-circle | Inner Circle | Have 5 friends | friendCount ≥ 5 |
| 14 | sold-out-crowd | Sold Out Crowd | Have 25 friends | friendCount ≥ 25 |
| 15 | shared-popcorn | Shared Popcorn | Join a collaborative watchlist | joinedCollabWatchlist ≥ 1 |
| 16 | in-sync | In Sync | Watch the same title as a friend on the same day | sameTitleSameDay = true |

#### Discovery (2)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 17 | channel-surfer | Channel Surfer | Swipe through 50 titles in shuffle | totalSwipes ≥ 50 |
| 18 | showtime-shuffle | Showtime Shuffle | Add a title from shuffle to a watchlist | shuffleToWatchlist ≥ 1 |

#### Watchlists (3)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 19 | coming-attractions | Coming Attractions | Create your first watchlist | watchlistCount ≥ 1 |
| 20 | completionist | Completionist | Clear an entire watchlist (min 5 items) | clearedWatchlist = true (min 5 items) |
| 21 | encore | Encore | Rewatch a title | rewatch = true |

#### Recommendations (3)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 22 | word-of-mouth | Word of Mouth | Recommend a title to a friend | sentRecommendation ≥ 1 |
| 23 | trusted-critic | Trusted Critic | A friend watches something you recommended | recWatched ≥ 1 |
| 24 | good-taste | Good Taste | Recommend something and a friend rates it 4+ stars | recRatedHighly ≥ 1 |

#### Reviews (2)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 25 | opening-review | Opening Review | Leave your first review | firstReview = true |
| 26 | five-star-critic | Five Star Critic | Leave 10 reviews | reviewCount ≥ 10 |

#### Profile (1)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 27 | ticket-holder | Ticket Holder | Complete onboarding | onboardingCompleted = true |

#### Meta (3)
| # | ID | Name | Description | Condition |
|---|-----|------|-------------|-----------|
| 28 | trophy-case | Trophy Case | Earn 10 achievements | achievementCount ≥ 10 |
| 29 | award-season | Award Season | Earn 25 achievements | achievementCount ≥ 25 |
| 30 | hall-of-fame | Hall of Fame | Earn every achievement | achievementCount = 29 (all others) |

## Unlock Flow

1. **Mutation completes** (e.g. mark as watched) → calls `evaluateAchievements(userId, context)` where context is the action type so only relevant achievements are checked
2. **Check against earned** — query the `achievement` table for what the user already has, skip those
3. **Evaluate conditions** — run relevant condition checks against the database
4. **If newly earned** — insert into `achievement` table with `earnedAt` timestamp
5. **Return unlocked achievements** — mutation response includes any newly earned achievement IDs
6. **Frontend shows popup** — full-screen celebratory modal (Design A: projector sweep, particles, neon badge, amber accent). User dismisses with "Continue"
7. **Notify friends** — create a notification for each friend (type `achievement_earned`, uses existing notification system)

**Multiple unlocks at once:** If a single action triggers multiple achievements, they queue and show one at a time — dismiss one, the next appears.

## Unlock Popup Design

Full-screen modal overlay:
- **Backdrop:** blur + dark overlay (85% opacity)
- **Projector sweep:** rotating amber light beam
- **Particles:** 40 floating dots in pink, amber, cyan rising from bottom
- **Badge:** neon sign style — conic gradient border (pink → amber → cyan → pink), glowing icon with amber text-shadow, monospace label. Flips in with rotateY animation
- **"Achievement Unlocked"** label in Space Mono uppercase, amber, letter-spacing 4px
- **Achievement name** in Righteous font, gradient text (pink → amber → cyan)
- **Description** in body text, muted
- **Progress** count (e.g. "3 / 30 Achievements") in Space Mono, muted amber
- **"Continue" button** to dismiss

## Profile Achievement Display

### Own Profile / Friend's Profile
- Trophy ring progress indicator (existing design) showing earned/total count
- Click to open full achievement list
- Achievement grid showing all 30 badges — earned ones are lit with neon glow, unearned are greyed/locked with 🔒 overlay
- Each earned badge shows the `earnedAt` date (e.g. "Feb 28, 2026")

### Friend Comparison View
- Default view: **All** — every achievement, showing who earned what
- Filter: **Shared** — only achievements both friends have
- Each badge shows small avatar indicators for who earned it
- If both earned it, both dates shown (e.g. "You: Feb 28, 2026 · Them: Mar 15, 2026")

### Non-Friend View
- Achievement count only (e.g. "18 / 30"), no detail
- Matches existing gated profile pattern (blurred content with lock)

## Review on Watch

When marking a title as watched:
- **Star rating** (1-5, required to submit but entire review is skippable)
- **Optional text review**
- **Optional watchedAt date/time** (defaults to now)
- User can skip the entire prompt and just mark as watched (watchedAt defaults to now)
- Reviews visible on friend profiles in the existing Reviews tab (replacing demo data)

## Recommend to Friend

- "Recommend" button on title pages
- Pick one or more friends from a list
- Creates a notification for each recipient (new type `recommendation`)
- Stored in `recommendation` table for achievement tracking
- When recipient watches the title, `Trusted Critic` is evaluated for the sender
- When recipient rates the title 4+ stars, `Good Taste` is evaluated for the sender

## Friend Notifications

When a friend earns an achievement:
- Notification type: `achievement_earned`
- Shows in the existing notification dropdown
- Format: "[Friend name] earned [Achievement name]"
- Tapping navigates to the friend's profile

## Files to Create/Modify

### New Files
- `src/lib/achievements.ts` — achievement definitions config
- `src/lib/evaluate-achievements.ts` — evaluation logic
- `src/integrations/trpc/routers/achievement.ts` — achievement tRPC router (queries for earned achievements, comparison data)
- `src/integrations/trpc/routers/review.ts` — review tRPC router
- `src/integrations/trpc/routers/recommendation.ts` — recommendation tRPC router
- `src/components/achievements/` — achievement popup, badge, comparison components

### Modified Files
- `src/db/schema.ts` — new tables + watchedAt column
- `src/integrations/trpc/router.ts` — register new routers
- `src/integrations/trpc/routers/watchlist.ts` — add watchedAt handling, call evaluateAchievements after marking watched
- `src/integrations/trpc/routers/friend.ts` — call evaluateAchievements after accepting friend
- `src/integrations/trpc/routers/notification.ts` — new notification types
- `src/components/notifications/notification-item.tsx` — render achievement/recommendation notifications
- `src/routes/app/profile.$userId.tsx` — replace demo data with real achievement display + comparison
- `src/routes/app/title.$mediaType.$tmdbId.tsx` — add recommend button
- `src/components/watchlist/watchlist-item-card.tsx` — add review prompt + watchedAt picker when marking watched
