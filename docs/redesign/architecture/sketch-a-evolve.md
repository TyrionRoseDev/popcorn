# Sketch A. Evolve the existing tables in place

This is one of two candidate designs for the Popcorn domain layer and data migration. This one keeps the tables Popcorn already has and changes them step by step. `watch_event` becomes the entry table, `episode_watch` stays as progress, and every column change goes through expand, backfill, then contract. The other candidate builds new tables. This document commits fully to the in-place shape.

Inputs: `docs/redesign/decisions/README.md` (glossary, DR-1 to DR-12), `docs/redesign/phase-1/03-concept-map.md`, `04-logic-audit.md`, `02-row-delta-matrix.md`, `src/db/schema.ts`, and the routers under `src/integrations/trpc/routers/`. Finding ids such as F30 refer to the logic audit.

## 1. The shape in one paragraph

One server folder, `src/server/domain/`, owns every rule about entries, progress, who may see what, and achievements. Routers become thin adapters that parse input, build a `Viewer`, and call one domain function. Only the domain folder may import the entry, progress, companion and friendship tables, and a lint rule enforces that. The database keeps its row ids, so every `watchEventId` in `notification.data` still resolves after migration. That is the main advantage of evolving in place. The main cost is that the table carries legacy columns through several releases, and every release must run against both the old and new column states during its deploy window.

## 2. Usage first

These call sites are the spec. The types in section 3 are derived from them.

```ts
// Title page "Watched", list card eye, and the review sheet all call this one function.
const { entry, created } = await logEntry(viewer, {
  id: input.id,                       // client generated, so a double tap is a no-op (F79)
  subject: { mediaType: "movie", tmdbId, scope: { kind: "film" } },
  watchedOn: input.watchedOn,         // "2026-11-07" in the viewer's own day (F30)
});

// Remind me later keeps the scope and uses the normal default visibility (F20).
await logEntry(viewer, {
  id, subject: { mediaType: "tv", tmdbId, scope: { kind: "episode", season: 2, episode: 5 } },
  watchedOn, remindMe: true,
});

// Tracker. Ticking a season is one call. The server expands it from the catalogue.
const { status, justFinished } = await markProgress(viewer, tmdbId, { kind: "season", season: 3 }, watchedOn);
if (justFinished) ui.offerShowEntry(); // DR-2: the show entry is optional

// The feed is the diary query over the viewer's friends, filtered by one visibility rule.
const page = await listFeed(viewer, { cursor, limit: 20 });

// Lists show a watched mark derived from the viewer's own entries and progress (DR-3).
const statuses = await watchedStatuses(viewer, items.map((i) => i.title));
```

A router after migration holds no rules: `log: protectedProcedure.input(logEntryInput).mutation(({ ctx, input }) => logEntry(viewerFrom(ctx), parseLogEntry(input)))`.

## 3. Types

`src/server/domain/types.ts`. Every illegal state named in the decision records is unrepresentable here, and storage rows are parsed into these types at the module edge.

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, "UserId">;
export type EntryId = Brand<string, "EntryId">;
export type InvitationId = Brand<string, "InvitationId">; // a watch_event_companion row id
export type TmdbId = Brand<number, "TmdbId">;
export type SeasonNumber = Brand<number, "SeasonNumber">;   // >= 0, season 0 is specials
export type EpisodeNumber = Brand<number, "EpisodeNumber">; // >= 1
export type WatchCycle = Brand<number, "WatchCycle">;       // >= 1, a pass through a show's progress
/** A calendar date in the owner's own day, "YYYY-MM-DD". Never a timestamp, so it never drifts (F29, F30). */
export type LocalDate = Brand<string, "LocalDate">;
/** IANA zone name, validated with Intl at the boundary. */
export type TimeZone = Brand<string, "TimeZone">;
export type Rating = 1 | 2 | 3 | 4 | 5;
/** Trimmed, 1 to 2000 characters. An empty note is null, never "". */
export type NoteText = Brand<string, "NoteText">;

export type TitleRef =
  | { readonly mediaType: "movie"; readonly tmdbId: TmdbId }
  | { readonly mediaType: "tv"; readonly tmdbId: TmdbId };
export type TitleKey = Brand<string, "TitleKey">; // "movie:603", built only by titleKey()

/** What an entry covers. A film can only have film scope, and an episode always has both numbers. */
export type TvScope =
  | { readonly kind: "show" }
  | { readonly kind: "season"; readonly season: SeasonNumber }
  | { readonly kind: "episode"; readonly season: SeasonNumber; readonly episode: EpisodeNumber };
export type EntryScope = { readonly kind: "film" } | TvScope;
export type EntrySubject =
  | { readonly mediaType: "movie"; readonly tmdbId: TmdbId; readonly scope: { readonly kind: "film" } }
  | { readonly mediaType: "tv"; readonly tmdbId: TmdbId; readonly scope: TvScope };

/** DR-4. Two levels. Tagged people see the entry whatever this says. */
export type Visibility = "friends" | "private";

/** Where a row came from. Only the migration origins are written by migrations. */
export type EntryOrigin =
  | "logged"
  | "invitation"
  | "migrated_list_flag"
  | "migrated_journal"
  | "migrated_review";

export type InvitationState =
  | { readonly status: "pending" }
  | { readonly status: "accepted"; readonly theirEntryId: EntryId | null }
  | { readonly status: "declined" };

export type Companion =
  | { readonly kind: "named"; readonly name: string } // free text, never a user, never notified
  | { readonly kind: "tagged"; readonly userId: UserId; readonly invitationId: InvitationId; readonly invitation: InvitationState };

export interface TitleSnapshot {
  readonly name: string;              // never empty, filled from the catalogue (F72)
  readonly posterPath: string | null;
}

export interface Entry {
  readonly id: EntryId;
  readonly ownerId: UserId;
  readonly subject: EntrySubject;
  readonly title: TitleSnapshot;
  readonly watchedOn: LocalDate;
  readonly rating: Rating | null;
  readonly note: NoteText | null;
  readonly visibility: Visibility;
  readonly companions: readonly Companion[];
  readonly remindAt: Date | null;     // cleared whenever a rating or note is set (F19)
  readonly origin: EntryOrigin;
  readonly runtimeMinutes: number | null; // films only, snapshot at log time (DR-6)
  readonly createdAt: Date;
}

/** An entry as a viewer receives it. The rewatch number is derived from date order (DR-8), never stored. */
export interface EntryView extends Entry {
  readonly owner: PersonSummary;
  readonly rewatchNumber: number; // 1 is the first watch of this title and scope
}

export interface PersonSummary {
  readonly id: UserId;
  readonly username: string | null;
  readonly avatarUrl: string | null;
}

/** Progress is a checklist for one show and one pass through it (DR-2). */
export interface Progress {
  readonly ownerId: UserId;
  readonly tmdbId: TmdbId;
  readonly cycle: WatchCycle;
  readonly seen: ReadonlySet<EpisodeKey>;
  /** Regular seasons only, season 0 excluded. Null means the catalogue has not been read yet (F35). */
  readonly totals: ReadonlyMap<SeasonNumber, number> | null;
  readonly visibility: Visibility;     // who sees this show's progress lines in diary and feed
}
export type EpisodeKey = Brand<string, "EpisodeKey">; // "s3e7"
export type EpisodeRef = { readonly season: SeasonNumber; readonly episode: EpisodeNumber };
export type EpisodeSelection =
  | { readonly kind: "episodes"; readonly episodes: readonly EpisodeRef[] }
  | { readonly kind: "season"; readonly season: SeasonNumber }
  | { readonly kind: "show" }; // every regular episode, specials excluded (F34)

export type ShowStatus =
  | { readonly kind: "not_started" }
  | { readonly kind: "watching"; readonly cycle: WatchCycle; readonly seen: number; readonly total: number | null }
  | { readonly kind: "finished"; readonly cycle: WatchCycle; readonly via: "progress" | "show_entry" };

/** DR-3. Derived from entries and progress, never stored. */
export type WatchedStatus =
  | { readonly mediaType: "movie"; readonly kind: "unwatched" }
  | { readonly mediaType: "movie"; readonly kind: "watched"; readonly times: number; readonly lastWatchedOn: LocalDate; readonly yourRating: Rating | null }
  | { readonly mediaType: "tv"; readonly show: ShowStatus; readonly yourRating: Rating | null };

/** The signed-in person asking. Built only by viewerFrom(ctx), so a raw user id cannot stand in for it. */
export interface Viewer {
  readonly userId: UserId;
  readonly timeZone: TimeZone;
}

/** How another person stands to the viewer. Blocking wins over everything and hides both sides. */
export type Relationship =
  | { readonly kind: "self" }
  | { readonly kind: "friend" }
  | { readonly kind: "request_sent" }
  | { readonly kind: "request_received" }
  | { readonly kind: "none" }
  | { readonly kind: "blocked"; readonly byViewer: boolean };

export interface Page<T, C> {
  readonly items: readonly T[];
  readonly nextCursor: C | null;
}
export type DiaryCursor = Brand<string, "DiaryCursor">; // opaque, encodes (watchedOn, createdAt, kind, id)
export type PageSize = Brand<number, "PageSize">;       // 1 to 50
```

Things the types refuse:

- A film with an episode scope, or an episode without a season number.
- A visibility of "public" or "companion". Those words exist only in the migration.
- A rewatch number someone can set. It is computed in the read query.
- A companion with a user id but no invitation state, or a free-text name that receives a notification.
- An empty note string. Clearing a note sets null, which is how "Delete note" stops deleting the watch (F22).

## 4. Module layout

```
src/server/domain/
  types.ts            public types above
  index.ts            the only import path routers use
  audience.ts         relationships, the visibility rule (SQL and pure), block enforcement
  entries.ts          logEntry, updateEntry, deleteEntry, invitations
  progress.ts         markProgress, unmarkProgress, startRewatch, stopWatching, showStatus
  status.ts           watchedStatuses for many titles in one query
  diary.ts            listDiary and listFeed over one private union query
  achievements.ts     facts from entries and progress, a pure rule check, award once
  internal/
    rows.ts           parse storage rows into domain types, the only place that knows column values
    catalog.ts        title name, poster, runtime, genres and episode lists from the TMDB cache
    notify.ts         pure notification drafts plus one insert helper
    tx.ts             transaction type and the after-commit hook list
```

Why this place. `src/lib` today mixes browser and server code (`auth-client.ts`, `utils.ts`). A `src/server/` root makes the server-only rule a path rule, and the TanStack Start bundler already keeps server-only modules out of the client when they are imported only from server functions and routers.

Why these cuts. Each module owns one body of knowledge, not one execution step. `audience.ts` is the only file that knows friendship and block rules. `entries.ts` is the only writer of entry and companion rows. `progress.ts` is the only writer of `episode_watch` and `user_title` progress fields. `diary.ts` only reads. A change that looks right from one of these files is right for the whole repo, because no other file holds a copy of its rule.

Enforcement. Biome `noRestrictedImports` forbids `#/server/domain/internal/*` outside `src/server/domain/`, and forbids importing `watchEvent`, `watchEventCompanion`, `episodeWatch`, `journalEntry`, `friendship` and `block` from `#/db/schema` outside `src/server/domain/` and `drizzle/`. If the Biome version cannot express named-import bans, a vitest that scans imports fails the build instead.

### 4.1 audience.ts

```ts
/** One relationship, for profile headers and guards. */
export async function relationshipBetween(viewer: Viewer, other: UserId): Promise<Relationship> {
  throw new Error("not implemented");
}

/** Many at once, for pickers and list member rows. */
export async function relationshipsWith(viewer: Viewer, others: readonly UserId[]): Promise<ReadonlyMap<UserId, Relationship>> {
  throw new Error("not implemented");
}

/** Throws FORBIDDEN unless every id is an accepted, unblocked friend. Used before tagging (F57). */
export async function assertTaggable(viewer: Viewer, ids: readonly UserId[], tx: Tx): Promise<void> {
  throw new Error("not implemented");
}

/** Throws NOT_FOUND when a block exists in either direction, so a blocked person learns nothing (F55). */
export async function assertNotBlocked(viewer: Viewer, other: UserId): Promise<void> {
  throw new Error("not implemented");
}

/** SQL that is true when the viewer may see the entry row aliased as `e`. Every entry read uses it. */
export function entryVisibleTo(viewer: Viewer, e: EntryTable = entryTable): SQL {
  throw new Error("not implemented");
}

/** SQL that is true when the viewer may see progress lines for user_title row `t`. */
export function progressVisibleTo(viewer: Viewer, t: UserTitleTable = userTitleTable): SQL {
  throw new Error("not implemented");
}

/** SQL that is true when the viewer may see list `l` (DR-4 applies to lists too). */
export function listVisibleTo(viewer: Viewer, l: WatchlistTable = watchlistTable): SQL {
  throw new Error("not implemented");
}

/** The same rule as entryVisibleTo, for rows already in memory. */
export function canSeeEntry(viewer: Viewer, facts: EntryAudienceFacts): boolean {
  throw new Error("not implemented");
}

export interface EntryAudienceFacts {
  readonly ownerId: UserId;
  readonly visibility: Visibility;
  readonly taggedUserIds: readonly UserId[];
  readonly relationship: Relationship; // viewer to owner
}
```

The rule is written once, as data, with both halves side by side, so adding a grant cannot update one half and miss the other.

```ts
// visible = owner OR (no block either way AND any grant holds)
const GRANTS = [
  {
    name: "friends",
    sql: (v: Viewer, e: EntryTable) => sql`${e.visibility} = 'friends' AND ${e.userId} IN (${friendIdsOf(v)})`,
    holds: (_v: Viewer, f: EntryAudienceFacts) => f.visibility === "friends" && f.relationship.kind === "friend",
  },
  {
    name: "tagged",
    sql: (v: Viewer, e: EntryTable) =>
      sql`EXISTS (SELECT 1 FROM watch_event_companion c WHERE c.watch_event_id = ${e.id} AND c.friend_id = ${v.userId})`,
    holds: (v: Viewer, f: EntryAudienceFacts) => f.taggedUserIds.includes(v.userId),
  },
] as const;
// TODO: a parity test inserts every combination of owner, relationship, visibility and tag state,
// runs entryVisibleTo against Postgres and canSeeEntry in memory, and asserts they agree.
```

`friendIdsOf(viewer)` and `blockedWith(viewer)` are private SQL subqueries. The accepted-friend check that is copied on 16 lines today (F74) lives only here.

### 4.2 entries.ts

```ts
export type CompanionInput =
  | { readonly kind: "tagged"; readonly userId: UserId }
  | { readonly kind: "named"; readonly name: string };

export interface LogEntryInput {
  readonly id: EntryId;                 // idempotency key from the client
  readonly subject: EntrySubject;
  readonly watchedOn: LocalDate;        // not after today in viewer.timeZone
  readonly rating?: Rating | null;
  readonly note?: NoteText | null;
  readonly visibility?: Visibility;     // defaults to DEFAULT_VISIBILITY, one constant
  readonly companions?: readonly CompanionInput[];
  readonly remindMe?: boolean;
}

export interface LogEntryResult {
  readonly entry: EntryView;
  readonly created: boolean;            // false when the id already existed
  readonly progress: ShowStatus | null; // set when an episode or season entry ticked progress
  readonly newAchievements: readonly AchievementId[];
}

/**
 * The one way to say "I watched this" (DR-1). In one transaction:
 * fetch the title snapshot from the catalogue, insert the entry ON CONFLICT (id) DO NOTHING,
 * tick progress for episode and season scope, validate and insert invitations,
 * and queue notifications. After commit: evaluate achievements.
 * It never touches watchlist rows (DR-3).
 */
export async function logEntry(viewer: Viewer, input: LogEntryInput): Promise<LogEntryResult> {
  throw new Error("not implemented");
}

export interface EntryPatch {
  readonly watchedOn?: LocalDate;
  readonly rating?: Rating | null;
  readonly note?: NoteText | null;
  readonly visibility?: Visibility;
  readonly companions?: readonly CompanionInput[];
}

/**
 * Subject is fixed after creation. Setting a rating or note clears the reminder (F19).
 * Removing a tagged person withdraws a pending invitation and never touches an accepted
 * friend's own entry (F14). Achievements are evaluated after commit, as for logEntry (F18, F42).
 */
export async function updateEntry(viewer: Viewer, id: EntryId, patch: EntryPatch): Promise<EntryView> {
  throw new Error("not implemented");
}

/** Deletes the entry and its pending invitations. Progress and other people's entries stay (F05, F13). */
export async function deleteEntry(viewer: Viewer, id: EntryId): Promise<void> {
  throw new Error("not implemented");
}

/** DR-9. Accept creates an entry in the viewer's own diary through the same insert as logEntry. */
export async function respondToInvitation(
  viewer: Viewer,
  id: InvitationId,
  answer: "accept" | "decline",
): Promise<{ readonly entry: EntryView | null }> {
  throw new Error("not implemented");
}

export async function pendingInvitations(viewer: Viewer): Promise<readonly PendingInvitation[]> {
  throw new Error("not implemented");
}
```

Notification rules move into a pure function so they can be tested without a database.

```ts
// internal/notify.ts
export function draftsForNewEntry(entry: Entry, audience: EntryAudience): readonly NotificationDraft[] {
  // TODO: invitations go to tagged friends. List members hear about the title only when
  // entry.visibility is "friends" and the member can see the entry (F45). One draft per
  // recipient, so the card flow cannot send two (F44). A recommender hears "watched"
  // when the entry is visible to them.
  throw new Error("not implemented");
}
```

### 4.3 progress.ts

```ts
/** The only writer of episode_watch. Ensures the user_title row and episode totals exist first (F35). */
export async function markProgress(
  viewer: Viewer,
  tmdbId: TmdbId,
  selection: EpisodeSelection,
  watchedOn: LocalDate,
): Promise<{ readonly status: ShowStatus; readonly justFinished: boolean; readonly newAchievements: readonly AchievementId[] }> {
  throw new Error("not implemented");
}

export async function unmarkProgress(viewer: Viewer, tmdbId: TmdbId, selection: EpisodeSelection): Promise<{ readonly status: ShowStatus }> {
  throw new Error("not implemented");
}

export async function startRewatch(viewer: Viewer, tmdbId: TmdbId): Promise<{ readonly cycle: WatchCycle }> {
  throw new Error("not implemented");
}

/** "Stop watching". Deletes progress and the user_title row. Entries stay in the diary (F77). */
export async function stopWatching(viewer: Viewer, tmdbId: TmdbId): Promise<void> {
  throw new Error("not implemented");
}

export async function setProgressVisibility(viewer: Viewer, tmdbId: TmdbId, visibility: Visibility): Promise<void> {
  throw new Error("not implemented");
}

export async function getProgress(viewer: Viewer, owner: UserId, tmdbId: TmdbId): Promise<Progress | null> {
  throw new Error("not implemented");
}

/** The single completion rule (F33). Specials never count toward the total (F34). */
export function showStatus(progress: Progress | null, hasShowEntry: boolean): ShowStatus {
  throw new Error("not implemented");
}
```

The tracker list, show card, title page, Write About and achievements all call `showStatus`. The six copies listed in F33 are deleted as their screens move.

### 4.4 status.ts

```ts
/**
 * DR-3. One round trip for any number of titles, so a list of 200 cards costs one query.
 * TODO: SELECT from (VALUES ...) AS t(media_type, tmdb_id)
 *   LEFT JOIN LATERAL (film entries: count, max(watched_on), latest rating) ON media_type = 'movie'
 *   LEFT JOIN LATERAL (show entry exists, latest rating) ON media_type = 'tv'
 *   LEFT JOIN user_title ut ON (owner, tmdb_id, 'tv')
 *   LEFT JOIN LATERAL (count of episode_watch at ut.current_watch_number, season > 0)
 * then showStatus() per row in memory.
 */
export async function watchedStatuses(
  viewer: Viewer,
  titles: readonly TitleRef[],
): Promise<ReadonlyMap<TitleKey, WatchedStatus>> {
  throw new Error("not implemented");
}
```

It answers for the viewer only. Other people's watching is visible through their diary, under the audience rule.

### 4.5 diary.ts

```ts
export type DiaryItem =
  | { readonly kind: "entry"; readonly entry: EntryView }
  | {
      readonly kind: "progress";
      readonly owner: PersonSummary;
      readonly tmdbId: TmdbId;
      readonly title: TitleSnapshot;
      readonly watchedOn: LocalDate;
      readonly episodes: readonly EpisodeRef[]; // "Watched 5 episodes of Breaking Bad"
    };

export type FeedItem =
  | DiaryItem
  | { readonly kind: "list_created"; readonly list: ListSummary; readonly createdOn: LocalDate };

export interface DiaryQuery {
  readonly owner: UserId;
  readonly title?: TitleRef;        // the title page history uses the same query (F25)
  readonly cursor: DiaryCursor | null;
  readonly limit: PageSize;
}

/** One person's diary, newest watch first, as the viewer is allowed to see it. */
export async function listDiary(viewer: Viewer, query: DiaryQuery): Promise<Page<DiaryItem, DiaryCursor>> {
  throw new Error("not implemented");
}

/** The viewer's and friends' diaries plus visible lists, newest watch first (F31). */
export async function listFeed(
  viewer: Viewer,
  query: { readonly cursor: DiaryCursor | null; readonly limit: PageSize },
): Promise<Page<FeedItem, DiaryCursor>> {
  throw new Error("not implemented");
}
```

Both run one private builder. Pseudocode:

```sql
-- arm 1: entries
SELECT 'entry' AS kind, e.id, e.user_id, e.watched_on, e.created_at AS sort_ts
FROM watch_event e
WHERE e.user_id = ANY(:owners) AND <entryVisibleTo(viewer)> [AND title filter]
UNION ALL
-- arm 2: one row per owner, show and day of progress
SELECT 'progress', min(w.id), w.user_id, w.watched_on, max(w.created_at)
FROM episode_watch w JOIN user_title t ON (t.user_id, t.tmdb_id, t.media_type) = (w.user_id, w.tmdb_id, 'tv')
WHERE w.user_id = ANY(:owners) AND <progressVisibleTo(viewer, t)>
GROUP BY w.user_id, w.tmdb_id, w.watched_on
UNION ALL
-- arm 3, feed only: lists created, dated in the owner's zone
...
ORDER BY watched_on DESC, sort_ts DESC, kind, id DESC
-- keyset: WHERE (watched_on, sort_ts, kind, id) < (:cursor tuple)
LIMIT :limit + 1
```

A second query hydrates the page by id: companions, owner summaries, title snapshots, and episode lists for progress rows. Rewatch numbers are computed in that hydration step over all of the owner's entries for the same title and scope, ordered by `(watched_on, created_at, id)`, so the number is the same whoever is looking. Indexes: `watch_event (user_id, watched_on DESC, created_at DESC, id DESC)` and `episode_watch (user_id, watched_on, tmdb_id)`.

`owners` is `[viewer]` plus `friendIdsOf(viewer)` for the feed, and `[query.owner]` for a diary after `assertNotBlocked`. Earned achievements leave the feed. The glossary defines the feed as entries and lists, and DR-10 says badges do not interrupt.

### 4.6 achievements.ts

```ts
export type AchievementTrigger = "entry" | "progress" | "friend" | "list" | "swipe" | "recommendation" | "profile";

/**
 * Loads AchievementFacts in one query, runs the pure rule check over every un-earned
 * achievement, inserts with ON CONFLICT DO NOTHING RETURNING, and reports only the rows
 * this call inserted (F43). Never revokes (Migration constraints).
 */
export async function evaluateAchievements(userId: UserId, trigger: AchievementTrigger): Promise<readonly AchievementId[]> {
  throw new Error("not implemented");
}

export interface AchievementFacts {
  readonly entryCount: number;              // the watch ladder counts entries, rewatches included (F39)
  readonly ratedEntryCount: number;         // replaces the review table (F16)
  readonly notedEntryCount: number;         // replaces journal counts
  readonly noteScopesUsed: ReadonlySet<EntryScope["kind"]>;
  readonly distinctGenreCount: number;      // real genres from entry.genre_ids (F40)
  readonly hasRewatch: boolean;             // one definition for films and shows (F36)
  readonly entriesByDay: ReadonlyMap<LocalDate, number>;
  readonly loggedHoursLocal: readonly number[]; // hour of created_at in user.time_zone, same-day logs only
  readonly finishedShowCount: number;       // via showStatus
  readonly episodeCount: number;
  // ...friend, list, swipe and recommendation facts, read from their own tables
}

/** Pure. Facts in, ids out. */
export function earnedFrom(facts: AchievementFacts, earned: ReadonlySet<AchievementId>): readonly AchievementId[] {
  throw new Error("not implemented");
}
```

The trigger only skips the facts query when nothing relevant changed. `ACTION_CONTEXT_MAP`, which today has to be kept in sync with `ACHIEVEMENTS` by hand, is deleted. Achievements that still cannot be earned after the rewrite are removed from `src/lib/achievements.ts` (DR-10). Announcing a badge to friends moves into `evaluateAchievements` so every path behaves the same (F42).

## 5. Entry points

| Entry point today | Today | After |
| --- | --- | --- |
| Title page Watched, film | `watchlist.quickMarkWatched` toggles a default-list flag, then maybe `watchEvent.create` (F02, F03, F69) | `entry.log` with film scope and no rating or note. The review sheet that follows calls `entry.update`. Pressing it again on a watched film offers "Log again" (DR-8) |
| Title page Watched, show | Navigates to the tracker or toggles a flag the tracker never reads (F09) | `entry.log` with show scope. The button state comes from `watchedStatuses` |
| List card eye | `watchEvent.create` plus `watchlist.markWatched`, in an order each card chooses (F02, F44) | `entry.log`, film or show scope. The list row is untouched. The "remove from this list?" prompt is a separate, optional list call (F70, F95) |
| Tracker episode tick | `episodeTracker.markEpisodes` with client runtimes | `progress.mark` with `{ kind: "episodes" }`. Runtimes come from the catalogue |
| Tracker season and Mark All | Client loops and calls `markEpisodes` | `progress.mark` with `{ kind: "season" }` or `{ kind: "show" }`. When `justFinished` is true the UI queues the optional show entry offer (DR-2, DR-10) |
| Tracker untick | `episodeTracker.unmarkEpisode` | `progress.unmark` |
| Remove from tracker | `episodeTracker.removeShow` deletes the diary too (F77) | `progress.stopWatching`. Entries stay |
| Write About, new note | `journalEntry.create` | `entry.log` with show, season or episode scope and a note. Episode and season scope tick progress |
| Write About, edit or delete note | `journalEntry.update` and `journalEntry.delete` | `entry.update` with a new note or `note: null` |
| Completion review | `ReviewModal` with no scope (F21) | `entry.log` with show scope |
| Remind me later | `watchEvent.create` forced public, scope dropped (F20) | `entry.log` with `remindMe: true`, the chosen scope and the default visibility |
| Recommendation accept | `recommendation.accept` trusts a client sender id, no replay guard (F51) | `recommendation.accept(recommendationId)` reads the sender from the row, sets `status` (F49), and adds to Want to watch marked "from" them. No entry |
| Shuffle match | `shuffle.recordSwipe` inserts a list row with an empty title name (F47) | Unchanged in shape, a list row of intent. The title name comes from the catalogue. No entry |
| Companion tagging | `watchEvent.create` writes a reciprocal row into the friend's diary with no consent and no friendship check (F13, F57) | `entry.log` or `entry.update` with `companions`. Each tagged friend gets a pending invitation. `invitation.respond` accepts or declines. `episodeTracker.markFromNotification` is deleted (F11) |

New routers: `entry` (log, update, delete), `invitation` (pending, respond), `diary` (list, feed), `progress` (mark, unmark, startRewatch, stopWatching, setVisibility, get, watching) and `title.status`. Deleted, each in the PR that moves its last caller: `watched`, `review`, `journalEntry`, `watchEvent`, `watchlist.markWatched`, `quickMarkWatched`, `isWatched`, `keepInWatchlist`, `recommendTitle`, and the dead `episodeTracker` procedures listed in the audit inventory.

## 6. Storage after the contract steps

The physical table keeps its name until the last migration, and Drizzle exposes it as `entry` from the first PR, so code never says "watch event" again.

```ts
export const entry = pgTable("watch_event", {
  id: text("id").primaryKey(),                   // client may supply it
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").$type<"movie" | "tv">().notNull(),
  scope: text("scope").$type<"film" | "show" | "season" | "episode">().notNull(),
  scopeSeasonNumber: integer("scope_season_number"),
  scopeEpisodeNumber: integer("scope_episode_number"),
  titleName: text("title_name").notNull(),
  posterPath: text("poster_path"),
  watchedOn: date("watched_on", { mode: "string" }).notNull(),
  rating: integer("rating"),
  note: text("note"),
  visibility: text("visibility").$type<"friends" | "private">().notNull(),
  origin: text("origin").$type<EntryOrigin>().notNull(),
  runtimeMinutes: integer("runtime_minutes"),
  genreIds: jsonb("genre_ids").$type<number[]>(),
  reviewReminderAt: timestamp("review_reminder_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  check("entry_scope_shape", sql`
    (scope = 'film'    AND media_type = 'movie' AND scope_season_number IS NULL     AND scope_episode_number IS NULL) OR
    (scope = 'show'    AND media_type = 'tv'    AND scope_season_number IS NULL     AND scope_episode_number IS NULL) OR
    (scope = 'season'  AND media_type = 'tv'    AND scope_season_number IS NOT NULL AND scope_episode_number IS NULL) OR
    (scope = 'episode' AND media_type = 'tv'    AND scope_season_number IS NOT NULL AND scope_episode_number IS NOT NULL)`),
  check("entry_visibility", sql`visibility IN ('friends', 'private')`),
  check("entry_origin", sql`origin IN ('logged','invitation','migrated_list_flag','migrated_journal','migrated_review')`),
  check("entry_note_not_blank", sql`note IS NULL OR length(btrim(note)) > 0`),
  check("watch_event_rating_range", sql`rating IS NULL OR rating BETWEEN 1 AND 5`),
]);
```

Gone from `watch_event`: `watched_at`, `review_text`, `title`, `origin_event_id`, `watch_number`. Gone from `watchlist_item`: `watched`, `watched_at`, `kept_in_watchlist`, `watched_seasons`, `runtime`. Gone from `episode_watch`: `watch_event_id` (always null, F07) and `watched_at`, replaced by `watched_on date`. Added to `watch_event_companion`: `status`, `accepted_entry_id`, `responded_at`, with a check that `friend_id IS NULL` exactly when `status IS NULL`. Added to `user_title`: `visibility`. Added to `user`: `time_zone`. Tables dropped: `journal_entry`, `review`.

`episode_watch.watch_number` and `user_title.current_watch_number` stay. They describe a pass through a show's checklist, which is progress state and only `progress.ts` writes them. An entry no longer stores a number.

`user.time_zone` is set from the `x-time-zone` request header whenever `logEntry` or `markProgress` runs and the value differs. It is used for three things only: validating that `watchedOn` is not in the future, dating list creations in the feed, and the time-of-day achievements.

## 7. Migrations

Every step follows one deploy rule. Migrations run at container start (`Dockerfile` runs `db:migrate` then `start`), so for a short window the previous release's code runs against the new schema. A migration may therefore only add nullable columns, add values old code ignores, or drop what the previous release no longer reads. Every backfill is idempotent so it can run again to catch rows the old code wrote during the window.

Each data step writes a map table in a `migration_audit` schema. The map is how invariants are checked and how a step is reversed. The schema is dropped in the last migration, at least 30 days after the contract.

### 0005_entry_expand (expand, reversible by dropping the added columns)

```sql
ALTER TABLE "user" ADD COLUMN time_zone text;
ALTER TABLE watch_event ADD COLUMN watched_on date, ADD COLUMN origin text, ADD COLUMN runtime_minutes integer;
ALTER TABLE episode_watch ADD COLUMN watched_on date;
ALTER TABLE user_title ADD COLUMN visibility text;
ALTER TABLE watch_event_companion
  ADD COLUMN status text, ADD COLUMN responded_at timestamp,
  ADD COLUMN accepted_entry_id text REFERENCES watch_event(id) ON DELETE SET NULL;
CREATE SCHEMA IF NOT EXISTS migration_audit;
CREATE INDEX CONCURRENTLY watch_event_diary_idx ON watch_event (user_id, watched_on DESC, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY episode_watch_day_idx ON episode_watch (user_id, watched_on, tmdb_id);
```

Drizzle runs each migration file in a transaction, so the two `CONCURRENTLY` indexes go in their own custom migration file, `0005b`, marked as non-transactional, or are built without `CONCURRENTLY` if production counts are small.

### 0006_entry_backfill (backfill, reversible, the old columns are untouched)

```sql
-- F30 and F29. The date in the person's own zone. London is the fallback, the owner's zone.
UPDATE watch_event e SET watched_on = (coalesce(e.watched_at, e.created_at) AT TIME ZONE 'UTC'
  AT TIME ZONE coalesce(u.time_zone, 'Europe/London'))::date
FROM "user" u WHERE u.id = e.user_id AND e.watched_on IS NULL;
UPDATE episode_watch w SET watched_on = ... same expression over w.watched_at ... WHERE w.watched_on IS NULL;
-- Scope. A null scope meant a film or a whole show.
UPDATE watch_event SET scope = CASE WHEN media_type = 'movie' THEN 'film' ELSE 'show' END WHERE scope IS NULL;
-- DR-4. Companion becomes Only me, and tagged people keep access through the tagging rule.
UPDATE watch_event SET visibility = CASE visibility WHEN 'public' THEN 'friends' ELSE 'private' END
  WHERE visibility IN ('public', 'companion');
UPDATE watch_event SET title_name = coalesce(nullif(title_name, ''), nullif(title, ''), title_name);
UPDATE watch_event SET origin = 'logged' WHERE origin IS NULL;
-- Progress was never shown to friends, so existing shows start private. New shows default to friends.
UPDATE user_title SET visibility = 'private' WHERE visibility IS NULL;
-- Free-text companions have no invitation.
UPDATE watch_event_companion SET status = NULL WHERE friend_id IS NULL;
```

Invariants after 0006:

```sql
SELECT count(*) = 0 FROM watch_event WHERE watched_on IS NULL OR scope IS NULL OR origin IS NULL;
SELECT count(*) = 0 FROM watch_event WHERE visibility NOT IN ('friends', 'private');
SELECT count(*) = 0 FROM episode_watch WHERE watched_on IS NULL;
-- Dates move by at most one day from the UTC date.
SELECT count(*) = 0 FROM watch_event WHERE abs(watched_on - coalesce(watched_at, created_at)::date) > 1;
-- Row counts unchanged. Compare with the pre-migration count recorded by the runbook.
SELECT count(*) FROM watch_event;
```

Reverse: the visibility mapping is lossy only for 'companion', so 0006 first copies `(id, visibility)` of every 'companion' row into `migration_audit.visibility_0006`. Reversing restores those and maps 'friends' back to 'public'. The date and origin columns are new, so reversing is setting them null.

Known limit. Edits before this migration already moved `watched_at` by whole hours (F30). The migration cannot recover the true time. Rows near midnight may land a day off, and the date check above bounds that.

### 0007_companions_to_invitations (DR-9, reversible through the archive)

```sql
-- 1. Rows on an origin entry that point at a friend with a reciprocal row they touched: accepted.
-- "Touched" means the friend set a rating or note, or edited the row more than a minute after creation.
-- 2. Rows whose reciprocal is untouched: pending. The reciprocal is copied whole into
--    migration_audit.reciprocal_0007 and deleted, so the friend can accept it back in one tap.
-- 3. Rows whose friend had their own matching entry before (the old dedup path): accepted, linked to it.
-- 4. Rows on a reciprocal pointing back at the origin owner: accepted, linked to the origin.
-- 5. Pairs blocked now: declined, and no pending invitation is created.
-- Every reciprocal kept gets origin = 'invitation'.
-- Each companion row id lands in migration_audit.companion_0007(companion_id, case_no, reciprocal_id).
```

Invariants after 0007:

```sql
SELECT count(*) = 0 FROM watch_event_companion WHERE (friend_id IS NULL) <> (status IS NULL);
-- Every reciprocal is either still present as an accepted invitation or archived.
SELECT (SELECT count(*) FROM watch_event WHERE origin_event_id IS NOT NULL AND origin = 'invitation')
     + (SELECT count(*) FROM migration_audit.reciprocal_0007)
     = :reciprocal_count_before;
-- Nothing with a rating or note was archived.
SELECT count(*) = 0 FROM migration_audit.reciprocal_0007 WHERE rating IS NOT NULL OR coalesce(note, '') <> '';
-- Every companion row is mapped once.
SELECT count(*) = (SELECT count(*) FROM watch_event_companion WHERE friend_id IS NOT NULL) FROM migration_audit.companion_0007;
```

Reverse: re-insert archived reciprocals by id, set their companion rows back to the pre-step state from the map. `origin_event_id` still exists, so links come back intact.

### 0008_list_flags_into_entries (DR-6, reversible through the map)

```sql
-- Candidates: watchlist_item rows with watched = true.
-- Watcher: the list owner when the list has exactly one member. A multi-member list cannot name
-- the watcher (F06), so those rows are recorded with reason 'unattributed' and get no entry.
-- One entry per (watcher, title) with no entry of any scope: origin 'migrated_list_flag',
-- visibility private, no rating or note, watched_on = min(coalesce(watched_at, created_at)) in the
-- watcher's zone, runtime_minutes from the movie row. TV rows with watched_seasons get one season
-- entry per listed season, otherwise one show entry.
-- Record migration_audit.list_flag_0008(item_id PRIMARY KEY, entry_id NULL, reason).
```

Backfilled entries are private because the flag was never shown to friends, so the migration publishes nothing new. The first achievement evaluation after this step may award watch-ladder badges. Those awards are recorded silently, with no friend notification and no celebration, because nobody did anything.

Invariants after 0008:

```sql
SELECT (SELECT count(*) FROM watchlist_item WHERE watched) = (SELECT count(*) FROM migration_audit.list_flag_0008);
-- Every attributed flag now has an entry for that person and title.
SELECT count(*) = 0 FROM watchlist_item wi JOIN watchlist w ON w.id = wi.watchlist_id
  JOIN migration_audit.list_flag_0008 m ON m.item_id = wi.id AND m.reason <> 'unattributed'
  WHERE NOT EXISTS (SELECT 1 FROM watch_event e WHERE e.user_id = w.owner_id AND e.tmdb_id = wi.tmdb_id AND e.media_type = wi.media_type);
-- Film watch time did not drop for any single-member owner.
-- (sum of runtime_minutes on film entries) >= (sum of distinct-title runtime on their flagged movie rows)
```

The rehearsal reports the count of 'unattributed' rows. If it is not small, the owner decides before production whether to attribute them to `added_by`.

Reverse: delete entries whose id is in the map. The flags are still there.

### 0009_journal_into_entries (DR-5, reversible through the map)

```sql
-- For each journal row, in created_at order:
-- MERGE when an entry exists with the same user, tmdb id, scope, season and episode, the same
-- old watch_number, an empty note, and it is not more visible than the journal row
-- (journal public, or entry private). The entry takes the note. It takes at most one journal row.
-- INSERT otherwise: media_type 'tv', origin 'migrated_journal', watched_on from created_at
-- in the user's zone, visibility friends when is_public else private, note, title_name.
-- Record migration_audit.journal_0009(journal_id PRIMARY KEY, entry_id, action).
```

The privacy clause refines DR-5. A private journal note never becomes the note on an entry friends can see. In that case the journal row becomes its own private entry.

Invariants after 0009:

```sql
SELECT (SELECT count(*) FROM journal_entry) = (SELECT count(*) FROM migration_audit.journal_0009);
SELECT count(*) = 0 FROM journal_entry j JOIN migration_audit.journal_0009 m ON m.journal_id = j.id
  JOIN watch_event e ON e.id = m.entry_id
  WHERE e.note IS DISTINCT FROM j.note OR e.user_id <> j.user_id OR e.tmdb_id <> j.tmdb_id;
SELECT count(*) = 0 FROM journal_entry j JOIN migration_audit.journal_0009 m ON m.journal_id = j.id
  JOIN watch_event e ON e.id = m.entry_id WHERE NOT j.is_public AND e.visibility <> 'private';
SELECT count(DISTINCT entry_id) = count(*) FROM migration_audit.journal_0009;
```

Reverse: delete entries with `action = 'inserted'` and null the note on entries with `action = 'merged'`. The journal table is still there until the contract.

### 0010_review_into_entries (DR-7, reversible through the map)

```sql
-- review_text: where note is empty, note = review_text. Where both exist, note = note || E'\n\n' || review_text.
-- review rows: when the person has an entry for the title with no rating, the latest one takes the
-- rating and, if its note is empty, the text. Otherwise insert an entry, origin 'migrated_review',
-- visibility private (review has no visibility), watched_on from created_at.
-- Record migration_audit.review_0010(source, source_id, entry_id, action, old_note).
```

Invariants: every review row and every non-empty `review_text` appears once in the map, and every mapped entry contains the source text. Production likely holds zero review rows (`02-row-delta-matrix.md`), and `prod-counts.sql` confirms it before the step runs.

### 0011_entry_constraints (contract, reversible by dropping constraints)

Runs after the release that writes only new values. It re-runs the 0006 updates first, to catch rows the old code wrote during deploy windows, then sets `NOT NULL` on `watch_event.watched_on`, `scope`, `origin`, `episode_watch.watched_on`, `user_title.visibility`, and adds every check in section 6. Invariant: the `ALTER` succeeds. A failure means a writer was missed, and the release stops there.

### 0012_drop_legacy_columns (contract, not reversible in place)

Before it runs, the runbook re-runs 0007 to 0010 and asserts that each inserts zero rows. Then `pg_dump` copies `journal_entry`, `review`, and the dropped columns with their ids into `migration_audit.legacy_0012`.

```sql
ALTER TABLE watch_event DROP COLUMN watched_at, DROP COLUMN review_text, DROP COLUMN title,
  DROP COLUMN origin_event_id, DROP COLUMN watch_number;
ALTER TABLE watchlist_item DROP COLUMN watched, DROP COLUMN watched_at, DROP COLUMN kept_in_watchlist,
  DROP COLUMN watched_seasons, DROP COLUMN runtime;
ALTER TABLE episode_watch DROP COLUMN watch_event_id, DROP COLUMN watched_at;
DROP TABLE journal_entry; DROP TABLE review;
```

Reverse: restore from `migration_audit.legacy_0012` and the off-site dump. This step only runs after the rehearsal on a scrubbed production copy passes every invariant above (DR-5).

### 0013_rename (contract, reversible by renaming back)

`ALTER TABLE watch_event RENAME TO entry` and `watch_event_companion` to `entry_companion`, with their indexes. The Drizzle table names change on one line each. No code outside `src/server/domain/` names the tables.

### 0014_drop_audit (at least 30 days after 0012)

`DROP SCHEMA migration_audit CASCADE`. After this, 0012 is reversible only from the off-site dump.

## 8. PR order

Each PR leaves the app working, moves every caller of the procedures it replaces, and deletes those procedures in the same PR. Each PR records the current behaviour with a verify-popcorn journey first and proves the new behaviour with the same journey.

1. **Audience.** `src/server/domain/` skeleton, `types.ts`, `audience.ts` with the parity test, the lint rule, 0005 and 0006. Every read of another person's entries, journal, achievements, stats, heatmap and lists goes through `entryVisibleTo`, `listVisibleTo` or `assertNotBlocked` (F52, F53, F54, F55, F75). The existing writers map 'public' input to 'friends' at the router edge and also write `watched_on`, `scope` and `origin`, so the new columns stay filled from here on. Fixes the two criticals on `next` if Wave 0 has not already.
2. **Dates.** Readers order by `watched_on`, and the date input becomes date only (F30). No migration.
3. **Invitations.** Inside today's `watchEvent.create` and `update`, tagging writes pending invitations after `assertTaggable` (F57) instead of reciprocal rows. Starts `entries.ts` with `respondToInvitation` and `pendingInvitations`, plus the notification type and its UI. Runs 0007. Deletes reciprocal writes and `episodeTracker.markFromNotification` (F11).
4. **One log.** `entries.ts` with `logEntry`, `updateEntry`, `deleteEntry`, and `status.ts`. Moves the title page, list card eye, review modal, remind-later and completion review. Runs 0008. Deletes `watched`, the UI's `review` readers, `watchlist.markWatched`, `quickMarkWatched`, `isWatched`, `keepInWatchlist`, `recommendTitle`, and `watchEvent.create` and `update`. The watch ladder switches to entries here, because it would otherwise stop counting.
5. **Notes.** Write About writes entries. Runs 0009. Tracker notes read entries for the title. Deletes the `journalEntry` router, and the journal achievements read entries.
6. **Diary and feed.** `diary.ts`, the progress visibility setting, and the Diary screen. Deletes `watchEvent.getFeed`, `getUserEvents`, `getForTitle` and `getLatestRating`. Export Data gains entries and progress (F58).
7. **Progress.** `progress.ts` with the single completion rule and the selection API. Deletes the client copies of the rule (F33), and Remove from tracker keeps entries (F77).
8. **Achievements.** `achievements.ts` from facts, 0010, and removal of unearnable badges. Deletes `ACTION_CONTEXT_MAP` and every remaining read of `review` and `watchlist_item.watched`.
9. **Contract.** 0011 in its own deploy. Then the rehearsal on the scrubbed copy, then 0012 and 0013 together. 0014 a month later.

PR 5 must land before PR 6, so the diary is complete when it first ships. Migration numbers follow PR order, because Drizzle applies files in number order.

## 9. Risks

- **Riskiest step: 0007, companions to invitations.** It is the only step before the contract that removes rows from someone's diary. A friend who quietly kept a reciprocal row loses it from their history, counts and heatmap until they accept the invitation. The "touched" heuristic decides which rows go, and `updated_at` is unreliable on rows edited by old code paths. Mitigation: archive every removed row whole, never archive a row with a rating or note, report counts in the rehearsal, and present pending invitations in the Diary as a quiet list, not as a burst of notifications. If the rehearsal shows many untouched reciprocals on active accounts, keep them all as accepted instead. That is a one-line change in the step's case 2.
- **Deploy-window writes.** Old code writes old values while a migration runs. Every backfill is idempotent and re-run before each constraint or drop step, and 0011 fails loudly if anything was missed.
- **Wrong watcher on shared lists.** 0008 refuses to guess and reports instead.
- **Date shifts already baked in.** F30 damage cannot be undone. The bound check in 0006 limits it to one day.
- **Badge bursts.** Backfilled entries can cross ladder thresholds. Awards from migrated rows are silent.
- **Legacy columns linger.** Old and new columns coexist from PR 1 to PR 9. The lint rule keeps domain code from reading legacy columns. `internal/rows.ts` is the only reader of the old visibility values, and only until 0011.
- **Physical names lag the vocabulary.** The table is called `watch_event` until 0013. Code uses `entry` from PR 1, so the gap shows only in SQL.
- **Feed query cost.** The union with a grouped progress arm runs per page. The two indexes in 0005 cover both arms. Build it against a production-sized copy before PR 6 merges.
- **Progress privacy default differs by age.** Existing shows start private and new ones default to friends. The Watching screen shows the setting per show so the difference is visible.

## 10. Red-flag screen of this design

| Red flag | Result |
| --- | --- |
| Shallow module | Pass. `logEntry` hides the catalogue, progress, invitations, notification audience and achievements behind one call with one input type. `markProgress` hides episode expansion, totals and the completion rule. |
| Information leakage | Pass with one watch item. Storage values such as 'friends' and 'film' are known only to `internal/rows.ts` and the check constraints. The watch item is `EntryAudienceFacts`, which repeats the rule's inputs in a second shape. The parity test covers it. |
| Temporal decomposition | Pass. Modules follow knowledge: audience, entries, progress, diary, achievements. Migrations are ordered by time by nature, and each one maps to one decision record. |
| Pass-through method | Watch item. Routers forward to one domain call. They stay because they adapt: zod input, building `Viewer`, mapping errors to tRPC codes. `listFeed` is not a pass-through to `listDiary`, since it adds owners and the list arm. |
| Split ownership | Pass. `entries.ts` alone writes entries and companions, and `progress.ts` alone writes `episode_watch` and the progress fields of `user_title`. `respondToInvitation` sits in `entries.ts` so the invitee's entry goes through the same insert. During migration, migration SQL is a second writer for one deploy at a time, which the idempotent re-runs cover. |
| Two ways to do one task | Pass after PR 3. Until then the old procedures exist, but each PR deletes the ones it replaces. Free-text and tagged companions are two shapes of one field, not two paths. |
| Importable internals | Pass. `internal/` is unreachable outside the domain folder, and the entry, progress, companion, friendship and block tables cannot be imported by routers. Enforced by lint, or by a test if Biome cannot express it. |
| Hand-synced list | Watch items. The SQL and pure visibility rule share one grant table and a parity test. The `EntryScope` union and the `entry_scope_shape` check are two lists, so a test inserts every scope shape and one illegal shape of each kind. `EntryOrigin` and its check constraint are tied by a test that reads the constraint text. `ACTION_CONTEXT_MAP` is deleted. |

What this design gives up compared with a new-table design: legacy columns stay visible in the schema for the length of the program, and the 0012 drop is a large one-time step. What it keeps: every entry id, every notification deep link, the companion table and its foreign keys, and a schema that matches production at every release.
