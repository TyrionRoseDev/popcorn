# Sketch B. A new model, as if it had been foundational

This is one candidate design for the server domain layer and the data migration. It assumes the decision records in `docs/redesign/decisions/README.md` had been true on day one, builds the tables that model would have, and migrates the old tables into them. Another runner sketches the in-place evolution of `watch_event`. This sketch commits fully to new tables, so the two can be compared on shape, not on detail.

Finding ids such as F30 refer to `docs/redesign/phase-1/04-logic-audit.md`. DR-n refers to the decision records.

## 1. The shape in one paragraph

Five tables carry everything a diary needs. `title` caches what TMDB says about a film or show, keyed by media type and TMDB id, so no other row copies a name, poster, runtime or genre list. `entry` holds one watch, with a scope that the database itself refuses to get wrong, a `watched_on` date column, a two-value visibility and no watch number, because the rewatch number is derived from date order (DR-8). `entry_tag` holds the friends tagged on an entry and their answer to the invitation (DR-9). `show_run` is one pass through a show, and `episode_progress` is its checklist, so a rewatch is a new run, not a counter on `user_title` (DR-2). Everything else is derived: watched status (DR-3), the rewatch number, show completion, the diary's daily progress lines, and achievements (DR-10). One server folder, `src/server/domain/`, owns every write to these tables and every visibility decision (DR-4). The tRPC routers parse input, call one domain function, and return its result.

## 2. Usage first

These call sites are the spec. The types in section 3 are derived from them.

```ts
// Title page, "Watched" on a film. The entry exists the moment the user taps.
// The rating sheet that opens next edits this entry. Closing it loses nothing (F03).
const { entry, earned } = await logEntry(viewer, {
  target: { title: movie(603), scope: { kind: "film" } },
  watchedOn: todayFor(viewer),
  requestId, // client UUID, makes a double tap harmless
});

// Tracker, "Show complete", optional show entry with a rating and note.
await logEntry(viewer, {
  target: { title: show(1396), scope: { kind: "show" } },
  watchedOn: todayFor(viewer),
  rating: rating(5),
  note: note("The last season earns it."),
  withFriends: [friendId],         // becomes an invitation, never a row in their diary
  requestId,
});

// Tracker, ticking episodes. Progress only, no entry (DR-2).
const { status } = await markEpisodes(viewer, show(1396), [{ season: 1, episode: 1 }]);
if (status.state === "finished") offerShowEntry(); // the UI decides when, after the task (DR-10)

// List card, title page and search results all ask the same question in one query.
const statuses = await watchedStatuses(viewer, [movie(603), show(1396)]);

// The Diary screen and the friends feed are the same query with a different author set.
const page = await diaryPage(viewer, { owner: viewer.userId, cursor });
const feed = await feedPage(viewer, { cursor });
```

## 3. Types

All of these live in `src/server/domain/types.ts`, except `Relationship`, which belongs to the audience module. Branded primitives are created only by parse functions at the boundary.

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, "UserId">;
export type EntryId = Brand<string, "EntryId">;
export type RunId = Brand<string, "RunId">;
export type TagId = Brand<string, "TagId">;
export type TmdbId = Brand<number, "TmdbId">;
export type SeasonNumber = Brand<number, "SeasonNumber">;   // integer >= 0, 0 means specials
export type EpisodeNumber = Brand<number, "EpisodeNumber">; // integer >= 1
export type TimeZone = Brand<string, "TimeZone">;           // a valid IANA zone
export type RequestId = Brand<string, "RequestId">;         // client UUID for idempotent logging

/** A calendar day, "2026-11-07". Never a Date, so no time zone can shift it (F30). */
export type CalendarDate = Brand<string, "CalendarDate">;
export type Rating = 1 | 2 | 3 | 4 | 5;
/** Trimmed, 1 to 2000 characters. An absent note is null, never "". */
export type Note = Brand<string, "Note">;

export type MovieKey = { readonly media: "movie"; readonly tmdbId: TmdbId };
export type ShowKey = { readonly media: "tv"; readonly tmdbId: TmdbId };
export type TitleKey = MovieKey | ShowKey;

/** What an entry covers. Season and episode numbers exist only where they mean something. */
export type ShowScope =
  | { readonly kind: "show" }
  | { readonly kind: "season"; readonly season: SeasonNumber }
  | { readonly kind: "episode"; readonly season: SeasonNumber; readonly episode: EpisodeNumber };
export type EntryScope = { readonly kind: "film" } | ShowScope;

/** A film can only have film scope, and a show can never have it. */
export type EntryTarget =
  | { readonly title: MovieKey; readonly scope: { readonly kind: "film" } }
  | { readonly title: ShowKey; readonly scope: ShowScope };

export type Visibility = "friends" | "only_me";

export type EntryOrigin =
  | { readonly kind: "logged" }
  | { readonly kind: "invitation"; readonly from: UserId; readonly sourceEntry: EntryId | null }
  | { readonly kind: "imported"; readonly source: "journal" | "review" | "list_flag" };

export type TagResponse =
  | { readonly kind: "pending" }
  | { readonly kind: "accepted"; readonly theirEntry: EntryId | null } // null once they delete it
  | { readonly kind: "declined" };

export type Tag = { readonly id: TagId; readonly user: UserId; readonly response: TagResponse };

export type Entry = {
  readonly id: EntryId;
  readonly owner: UserId;
  readonly target: EntryTarget;
  readonly watchedOn: CalendarDate;
  readonly rating: Rating | null;
  readonly note: Note | null;
  readonly visibility: Visibility;
  readonly tags: readonly Tag[];
  readonly withNames: readonly string[]; // people who are not on Popcorn, display only
  readonly origin: EntryOrigin;
  readonly writeReminderOn: CalendarDate | null; // "Remind me later"
};

/** An entry as a reader sees it. The rewatch number is computed, never stored (DR-8). */
export type DiaryEntry = Entry & { readonly watchOrdinal: number };

/** Who is asking. Built once per request from the session, never from input. */
export type Viewer = { readonly userId: UserId; readonly timeZone: TimeZone };

export type EpisodeRef = { readonly season: SeasonNumber; readonly episode: EpisodeNumber };

export type Progress = {
  readonly run: RunId;
  readonly show: ShowKey;
  readonly runOrdinal: number;           // 1 for the first watch-through, derived from start order
  readonly visibility: Visibility;
  readonly seen: ReadonlySet<`${number}x${number}`>;
  readonly state: "active" | "stopped" | "superseded";
};

export type ShowStatus =
  | { readonly state: "not_started" }
  | { readonly state: "watching"; readonly run: RunId; readonly seen: number; readonly aired: number; readonly next: EpisodeRef | null }
  | { readonly state: "finished"; readonly via: "progress" | "entry"; readonly on: CalendarDate };

export type WatchedStatus =
  | { readonly media: "movie"; readonly state: "unwatched" }
  | { readonly media: "movie"; readonly state: "watched"; readonly times: number; readonly lastOn: CalendarDate; readonly yourRating: Rating | null }
  | { readonly media: "tv"; readonly show: ShowStatus; readonly yourRating: Rating | null };
```

`Relationship` is exported by the audience module:

```ts
export type Relationship =
  | { readonly kind: "self" }
  | { readonly kind: "friends" }
  | { readonly kind: "request_sent" }
  | { readonly kind: "request_received" }
  | { readonly kind: "blocked"; readonly by: "viewer" | "them" } // hides everything both ways
  | { readonly kind: "none" };
```

Choices worth naming:

- `EntryTarget` pairs media with scope, so "a film with episode scope" and "a show with film scope" cannot be built. The database repeats the rule as a check constraint, because SQL migrations write rows without going through TypeScript.
- `watchOrdinal` is not on `Entry`. Writers cannot set it, and no stored number can drift from date order. This replaces `watch_event.watch_number`, `journal_entry.watch_number` and `user_title.current_watch_number` for entries (F36, F85).
- `writeReminderOn` replaces the forced public log of Remind me later (F20). The reminder is cleared by the same update that adds a rating or note (F19).
- Show status `finished` has two sources, and both are derived. One rule in one pure function replaces the six in F33.

## 4. Tables

Sketched as Drizzle. Enums are `pgEnum`s whose values come from the TypeScript unions above through `as const` arrays, so the type and the column cannot disagree.

```ts
export const mediaType = pgEnum("media_type", ["movie", "tv"]);
export const entryScope = pgEnum("entry_scope", ["film", "show", "season", "episode"]);
export const visibility = pgEnum("visibility", ["friends", "only_me"]);
export const entryOrigin = pgEnum("entry_origin", ["logged", "invitation", "journal", "review", "list_flag"]);
export const tagResponse = pgEnum("tag_response", ["pending", "accepted", "declined"]);
export const runClosed = pgEnum("run_closed", ["stopped", "superseded"]);

/** One row per film or show anyone has touched. Owned by the title module only. */
export const title = pgTable("title", {
  mediaType: mediaType("media_type").notNull(),
  tmdbId: integer("tmdb_id").notNull(),
  name: text("name").notNull(),
  posterPath: text("poster_path"),
  runtimeMinutes: integer("runtime_minutes"),                 // films only
  genreIds: integer("genre_ids").array().notNull().default(sql`'{}'`),
  seasons: jsonb("seasons").$type<{ season: number; episodes: number; aired: number }[]>(), // tv only
  fetchedAt: timestamp("fetched_at", { withTimezone: true }), // null: seeded from legacy rows, refresh due
}, (t) => [primaryKey({ columns: [t.mediaType, t.tmdbId] })]);

export const entry = pgTable("entry", {
  id: text("id").primaryKey(),                                // legacy watch_event ids are kept
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  mediaType: mediaType("media_type").notNull(),
  tmdbId: integer("tmdb_id").notNull(),
  scope: entryScope("scope").notNull(),
  seasonNumber: integer("season_number"),
  episodeNumber: integer("episode_number"),
  watchedOn: date("watched_on", { mode: "string" }).notNull(),
  rating: smallint("rating"),
  note: text("note"),
  visibility: visibility("visibility").notNull(),
  origin: entryOrigin("origin").notNull().default("logged"),
  sourceEntryId: text("source_entry_id").references((): AnyPgColumn => entry.id, { onDelete: "set null" }),
  withNames: text("with_names").array().notNull().default(sql`'{}'`),
  writeReminderOn: date("write_reminder_on", { mode: "string" }),
  legacyMinutes: integer("legacy_minutes"),                   // DR-6 runtime for list-flag backfills only
  requestId: uuid("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  foreignKey({ columns: [t.mediaType, t.tmdbId], foreignColumns: [title.mediaType, title.tmdbId] }),
  check("entry_scope_media", sql`(${t.scope} = 'film') = (${t.mediaType} = 'movie')`),
  check("entry_scope_numbers", sql`
    (${t.scope} IN ('film','show') AND ${t.seasonNumber} IS NULL AND ${t.episodeNumber} IS NULL)
    OR (${t.scope} = 'season' AND ${t.seasonNumber} >= 0 AND ${t.episodeNumber} IS NULL)
    OR (${t.scope} = 'episode' AND ${t.seasonNumber} >= 0 AND ${t.episodeNumber} >= 1)`),
  check("entry_rating_range", sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
  check("entry_note_not_blank", sql`${t.note} IS NULL OR length(btrim(${t.note})) > 0`),
  check("entry_source_only_for_invitation", sql`${t.sourceEntryId} IS NULL OR ${t.origin} = 'invitation'`),
  check("entry_legacy_minutes_only_backfill", sql`${t.legacyMinutes} IS NULL OR ${t.origin} = 'list_flag'`),
  index("entry_diary_idx").on(t.userId, t.watchedOn.desc(), t.createdAt.desc(), t.id.desc()),
  index("entry_title_idx").on(t.userId, t.mediaType, t.tmdbId),
  uniqueIndex("entry_request_idx").on(t.userId, t.requestId).where(sql`${t.requestId} IS NOT NULL`),
  index("entry_reminder_idx").on(t.writeReminderOn).where(sql`${t.writeReminderOn} IS NOT NULL`),
]);

export const entryTag = pgTable("entry_tag", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entryId: text("entry_id").notNull().references(() => entry.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  response: tagResponse("response").notNull().default("pending"),
  responseEntryId: text("response_entry_id").references(() => entry.id, { onDelete: "set null" }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("entry_tag_unique").on(t.entryId, t.userId),
  index("entry_tag_user_idx").on(t.userId),
  check("entry_tag_response_entry", sql`${t.response} = 'accepted' OR ${t.responseEntryId} IS NULL`),
]);

export const showRun = pgTable("show_run", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  mediaType: mediaType("media_type").notNull().default("tv"),
  tmdbId: integer("tmdb_id").notNull(),
  visibility: visibility("visibility").notNull().default("friends"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedReason: runClosed("closed_reason"),
}, (t) => [
  foreignKey({ columns: [t.mediaType, t.tmdbId], foreignColumns: [title.mediaType, title.tmdbId] }),
  check("show_run_tv", sql`${t.mediaType} = 'tv'`),
  check("show_run_closed_pair", sql`(${t.closedAt} IS NULL) = (${t.closedReason} IS NULL)`),
  unique("show_run_id_user").on(t.id, t.userId),
  uniqueIndex("show_run_one_active").on(t.userId, t.tmdbId).where(sql`${t.closedAt} IS NULL`),
]);

export const episodeProgress = pgTable("episode_progress", {
  runId: text("run_id").notNull(),
  userId: text("user_id").notNull(),
  seasonNumber: integer("season_number").notNull(),
  episodeNumber: integer("episode_number").notNull(),
  watchedOn: date("watched_on", { mode: "string" }).notNull(),
  runtimeMinutes: integer("runtime_minutes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.runId, t.seasonNumber, t.episodeNumber] }),
  // The composite key makes user_id agree with the run's owner without any sync code.
  foreignKey({ columns: [t.runId, t.userId], foreignColumns: [showRun.id, showRun.userId] }).onDelete("cascade"),
  check("episode_progress_numbers", sql`${t.seasonNumber} >= 0 AND ${t.episodeNumber} >= 1 AND ${t.runtimeMinutes} >= 0`),
  index("episode_progress_day_idx").on(t.userId, t.watchedOn.desc()),
]);

/** Onboarding favourites. They are taste, not progress, so they never appear in Watching (F35, F99). */
export const tastePick = pgTable("taste_pick", { /* user_id, media_type, tmdb_id, created_at, pk on all three keys */ });

/** Audit trail for the migration. Dropped with the legacy schema. */
export const migrationEntrySource = pgTable("migration_entry_source", {
  entryId: text("entry_id").notNull(),
  sourceTable: text("source_table").notNull(), // 'watch_event' | 'journal_entry' | 'review' | 'watchlist_item'
  sourceId: text("source_id").notNull(),
  action: text("action").notNull(),            // 'copied' | 'merged_note' | 'created'
}, (t) => [primaryKey({ columns: [t.sourceTable, t.sourceId] })]);
```

Also `user.time_zone text NOT NULL DEFAULT 'Europe/London'`, written by the client from `Intl.DateTimeFormat().resolvedOptions().timeZone` on sign-in. The default matches the owner's circle and is flagged in the risks.

Why a `title` table belongs in this model. Today `title_name`, `poster_path`, `runtime` and `genre_ids` are copied onto `watch_event`, `watchlist_item`, `journal_entry` and `recommendation`, and the copies disagree. Some `title_name` values are empty, `backfillGenres` exists only to repair the copies, film runtime lives only on list items (F26), and tracked shows can have no episode counts for good (F35). With one cache row per title, watch time is `sum(title.runtime_minutes)` over film entries plus progress runtimes, genre stats join `title.genre_ids`, completion reads `title.seasons`, and no write path takes a name or poster from the client. The cost is that a write needs the title row to exist first. `ensureTitles` inserts it, fetching TMDB when it is missing, and falls back to a stub with `fetched_at` null when TMDB fails, so logging never fails on TMDB.

Access patterns traced through the structure:

| Pattern | Path |
| --- | --- |
| My diary, newest first | `entry_diary_idx` merged with `episode_progress_day_idx`, keyset on `(watched_on, sort_at, id)` |
| Friends feed | Same two indexes, author set from the friendship pair index |
| Have I watched these 40 titles | One query over `entry_title_idx` and the active-run partial index, joined to `title.seasons` |
| Watching list | `show_run_one_active` for the user, progress counts per run, `title.seasons` |
| Rewatch number | `row_number()` over the entry partition, served by `entry_title_idx` |
| Watch time, genre stats | Entries join `title`, plus a sum over progress |
| Invitations for me | `entry_tag_user_idx` where response is pending |

## 5. Module layout

`src/server/domain/` is new. `src/lib/` mixes browser and server code (`auth-client.ts` next to `evaluate-achievements.ts`), so it cannot carry a "server only" rule. A `server/` folder can. Biome's `noRestrictedImports` forbids `#/server/**` under `src/components` and `src/routes`, and forbids importing `entry`, `entryTag`, `showRun`, `episodeProgress` and `title` from `#/db/schema` anywhere outside `src/server/domain`. A vitest architecture test, `src/server/domain/__tests__/boundaries.test.ts`, parses imports and fails when any file outside a module's folder imports anything but that module's `index.ts`. Biome cannot express "only from inside its own folder", so the test closes that gap.

```
src/server/domain/
  types.ts                 branded types and parse functions (parseCalendarDate, parseNote, ...)
  title/index.ts           the title cache, its only writer
  audience/index.ts        relationships and visibility, the one place that decides who sees what
  diary/index.ts           entries, invitations, diary and feed pages, watched status, summaries
  diary/internal/*.ts      row mapping, ordinal SQL, tag diffing, legacy mirror (temporary)
  progress/index.ts        show runs and episode checkmarks, show status
  achievements/index.ts    diary stats, pure rules, awarding
  notify/index.ts          typed notification payloads, create and read
```

Each `index.ts` is the module's whole public surface. The routers in `src/integrations/trpc/routers/` keep their zod schemas, build a `Viewer`, call one function, and map domain errors to `TRPCError`. Tracing any write takes three files: the router, the module's `index.ts`, and one internal file.

### title

```ts
/** Guarantees a title row for every key, fetching from TMDB when missing or stale. Idempotent. */
export async function ensureTitles(tx: Tx, keys: readonly TitleKey[]): Promise<void> {
  throw new Error("not implemented");
}
export type TitleSummary = { key: TitleKey; name: string; posterPath: string | null; year: number | null };
export async function titleSummaries(keys: readonly TitleKey[]): Promise<Map<string, TitleSummary>> {
  throw new Error("not implemented");
}
/** Aired episodes per season, specials excluded. Read by progress, never copied. */
export async function airedEpisodes(tx: Tx, show: ShowKey): Promise<readonly { season: SeasonNumber; aired: number }[]> {
  throw new Error("not implemented");
}
/** Background refresh for rows with fetched_at null or older than 14 days. Called by the cron route. */
export async function refreshStaleTitles(limit: number): Promise<number> {
  throw new Error("not implemented");
}
```

### audience

```ts
export async function relationshipBetween(viewer: Viewer, other: UserId): Promise<Relationship> {
  throw new Error("not implemented");
}
/** Throws NotFriends or Blocked. Used before tagging, recommending, sharing a list (F57). */
export async function requireFriends(tx: Tx, viewer: Viewer, others: readonly UserId[]): Promise<void> {
  throw new Error("not implemented");
}
/** SQL for "the viewer's accepted friends with no block either way", as a subquery of user ids. */
export function friendIdsSql(viewer: Viewer): SQL {
  throw new Error("not implemented");
}
/** SQL for "neither person blocks the other". */
export function notBlockedSql(viewer: Viewer, otherUserId: AnyPgColumn): SQL {
  throw new Error("not implemented");
}

/**
 * The visibility rule as a WHERE fragment over an entry alias.
 *   owner is viewer
 *   OR (no block either way AND (viewer is tagged OR (visibility = 'friends' AND they are friends)))
 * Every read of another person's entries uses it: diary, feed, profile, stats, heatmap,
 * notifications, title page (F52, F53, F54, F55).
 */
export function canSeeEntrySql(viewer: Viewer, e: typeof entry = entry): SQL {
  throw new Error("not implemented");
}
/** The same rule for a show run's progress, without the tag clause. */
export function canSeeRunSql(viewer: Viewer, r: typeof showRun = showRun): SQL {
  throw new Error("not implemented");
}
/** The same rule for rows already in memory. A parity test runs both against one fixture DB. */
export function canSeeEntry(
  viewer: Viewer,
  row: { owner: UserId; visibility: Visibility; taggedUsers: readonly UserId[] },
  relationship: Relationship,
): boolean {
  throw new Error("not implemented");
}
/** Whether a profile page may show anything at all. Blocked and strangers get the shell only. */
export function canSeeProfile(relationship: Relationship): boolean {
  throw new Error("not implemented");
}
```

### diary

```ts
export type LogEntryInput = {
  target: EntryTarget;
  watchedOn: CalendarDate;
  rating?: Rating;
  note?: Note;
  visibility?: Visibility;            // default: the user's setting, not "public" (F20)
  withFriends?: readonly UserId[];    // each becomes a pending invitation (DR-9)
  withNames?: readonly string[];
  writeReminderOn?: CalendarDate;
  requestId: RequestId;
};
export type LogResult = { entry: DiaryEntry; earned: readonly AchievementId[] };

/**
 * The one way to say "I watched this" (DR-1). In one transaction: ensure the title, insert the
 * entry, validate and insert tags, queue invitation notifications. Achievements are awarded after
 * commit. A repeated requestId returns the first entry instead of a second one.
 * Never touches lists (DR-3, F69, F70) and never touches progress (DR-2).
 */
export async function logEntry(viewer: Viewer, input: LogEntryInput): Promise<LogResult> {
  throw new Error("not implemented");
}

export type EntryPatch = Partial<{
  target: EntryTarget;                // same title only, a scope change
  watchedOn: CalendarDate;
  rating: Rating | null;
  note: Note | null;
  visibility: Visibility;
  withFriends: readonly UserId[];     // diffed: new ids invited, removed ids untagged
  withNames: readonly string[];
  writeReminderOn: CalendarDate | null;
}>;
/**
 * Owner only. Removing a tag deletes the tag row and nothing in the friend's diary (F14).
 * Setting a rating or note clears writeReminderOn (F19).
 */
export async function updateEntry(viewer: Viewer, id: EntryId, patch: EntryPatch): Promise<LogResult> {
  throw new Error("not implemented");
}
/** Owner only. Tags cascade. Entries friends created by accepting keep existing, unlinked. */
export async function deleteEntry(viewer: Viewer, id: EntryId): Promise<void> {
  throw new Error("not implemented");
}
/**
 * Accept creates the friend's own entry with the same target and date, their default visibility,
 * no rating or note, origin invitation, and a tag back to the inviter marked accepted.
 * Idempotent: a second accept returns the same entry.
 */
export async function respondToInvitation(
  viewer: Viewer, tag: TagId, answer: "accept" | "decline",
): Promise<{ entry: DiaryEntry | null }> {
  throw new Error("not implemented");
}

export type DiaryItem =
  | { kind: "entry"; entry: DiaryEntry; author: UserSummary; title: TitleSummary }
  | { kind: "progress_day"; author: UserSummary; title: TitleSummary; run: RunId; runOrdinal: number;
      watchedOn: CalendarDate; episodes: readonly EpisodeRef[]; minutes: number }
  | { kind: "list_created"; author: UserSummary; list: ListSummary; on: CalendarDate };
export type DiaryCursor = Brand<string, "DiaryCursor">; // opaque (watchedOn, sortAt, id)
export type Page<T> = { items: readonly T[]; next: DiaryCursor | null };

/**
 * One owner's diary as the viewer may see it: entries plus one line per run per day of progress,
 * ordered by watched_on, then the time it was written, then id. Keyset paginated, so a page never
 * skips or repeats rows that share a date (the feed today pages on created_at, F25).
 * Optional filters cover the title page history and the tracker's notes section.
 */
export async function diaryPage(
  viewer: Viewer,
  q: { owner: UserId; cursor?: DiaryCursor; limit?: number; title?: TitleKey },
): Promise<Page<DiaryItem>> {
  throw new Error("not implemented");
}
/** diaryPage over the viewer and their friends, plus list creations. Same SQL builder, other author set. */
export async function feedPage(viewer: Viewer, q: { cursor?: DiaryCursor; limit?: number }): Promise<Page<DiaryItem>> {
  throw new Error("not implemented");
}
/** One query for any number of titles. The only answer to "have I watched this" (F01, F09). */
export async function watchedStatuses(viewer: Viewer, keys: readonly TitleKey[]): Promise<Map<string, WatchedStatus>> {
  throw new Error("not implemented");
}
/** Profile numbers, heatmap and rating spread, computed over entries the viewer can see (F53). */
export async function diarySummary(viewer: Viewer, owner: UserId): Promise<DiarySummary> {
  throw new Error("not implemented");
}
/** Entries due a write reminder today in their owner's zone. Read by the cron route. */
export async function dueWriteReminders(now: Date): Promise<readonly { owner: UserId; entry: EntryId }[]> {
  throw new Error("not implemented");
}
```

The diary SQL, in outline:

```sql
WITH authors AS (SELECT :owner AS id),          -- feedPage: the viewer UNION friendIdsSql(viewer)
items AS (
  SELECT 'entry' AS kind, e.watched_on, e.created_at AS sort_at, e.id AS key, e.user_id
  FROM entry e JOIN authors a ON a.id = e.user_id
  WHERE canSeeEntrySql(viewer, e)
  UNION ALL
  SELECT 'progress_day', p.watched_on, max(p.created_at), p.run_id || ':' || p.watched_on, p.user_id
  FROM episode_progress p JOIN show_run r ON r.id = p.run_id JOIN authors a ON a.id = p.user_id
  WHERE canSeeRunSql(viewer, r)
  GROUP BY p.run_id, p.user_id, p.watched_on
)
SELECT * FROM items
WHERE (watched_on, sort_at, key) < (:cursor_on, :cursor_at, :cursor_key)
ORDER BY watched_on DESC, sort_at DESC, key DESC
LIMIT :limit + 1;
-- Then one query hydrates the page's entries (with ordinal and tags), one its progress days,
-- and one title summaries. Four round trips per page regardless of page size.
```

The ordinal is `row_number() OVER (PARTITION BY user_id, media_type, tmdb_id, scope, season_number, episode_number ORDER BY watched_on, created_at, id)`, computed over the owner's full partition in the hydration query, not over the page, so a page boundary cannot renumber anything.

### progress

```ts
/** Creates the active run if none exists. Idempotent. Replaces addShow and user_title for TV. */
export async function startWatching(viewer: Viewer, show: ShowKey): Promise<Progress> {
  throw new Error("not implemented");
}
export type MarkResult = { progress: Progress; status: ShowStatus; becameFinished: boolean; earned: readonly AchievementId[] };
/**
 * Ticks episodes on the active run, creating it if needed. ON CONFLICT DO NOTHING, so repeats are
 * harmless. Runtime and the aired list come from the server, never from the client.
 * Season and show marks are the same call with the episode list resolved here.
 */
export async function markEpisodes(
  viewer: Viewer, show: ShowKey,
  which: { episodes: readonly EpisodeRef[] } | { season: SeasonNumber } | { wholeShow: true },
  watchedOn?: CalendarDate,
): Promise<MarkResult> {
  throw new Error("not implemented");
}
export async function unmarkEpisodes(viewer: Viewer, show: ShowKey, episodes: readonly EpisodeRef[]): Promise<MarkResult> {
  throw new Error("not implemented");
}
/** Closes the active run as superseded and opens a new one. */
export async function startRewatch(viewer: Viewer, show: ShowKey): Promise<Progress> {
  throw new Error("not implemented");
}
/** Closes the active run as stopped. Progress stays, so diary lines stay. Entries are never touched (F77). */
export async function stopWatching(viewer: Viewer, show: ShowKey): Promise<void> {
  throw new Error("not implemented");
}
export async function watchingList(viewer: Viewer): Promise<readonly { show: TitleSummary; progress: Progress; status: ShowStatus }[]> {
  throw new Error("not implemented");
}
/**
 * The one completion rule (F33, F34). Specials and unaired episodes do not count.
 * A show entry finishes a show even with no progress.
 */
export function showStatus(
  seen: ReadonlySet<string>, aired: readonly { season: SeasonNumber; aired: number }[],
  showEntryOn: CalendarDate | null, lastProgressOn: CalendarDate | null, run: RunId | null,
): ShowStatus {
  throw new Error("not implemented");
}
```

`showStatus` is pure and shared with the SQL in `watchedStatuses` through one internal helper that returns the counts it needs, so the rule exists once.

### achievements

```ts
/** Everything any rule needs, from one query over entries, progress, titles, friends and swipes. */
export type DiaryStats = {
  entries: number; distinctTitles: number; films: number; rated: number; noted: number;
  fiveStars: number; rewatches: number; genres: ReadonlySet<number>; finishedShows: number;
  episodes: number; maxEntriesOneDay: number; sharedWatchWithFriend: boolean;
  friends: number; lists: number; swipes: number; recommendationsSent: number;
  recommendationsWatched: number; recommendationsRatedHighly: number; onboardingDone: boolean;
};
export async function diaryStats(tx: Tx, user: UserId): Promise<DiaryStats> {
  throw new Error("not implemented");
}
/**
 * Pure. Evaluators are a Record keyed by condition type, so adding a condition without an evaluator
 * fails the build, and ACTION_CONTEXT_MAP is deleted: every call checks every unearned rule.
 */
export function metAchievements(stats: DiaryStats, earned: ReadonlySet<AchievementId>): AchievementId[] {
  throw new Error("not implemented");
}
/** Inserts with ON CONFLICT DO NOTHING RETURNING, and queues a notification only for rows it inserted. */
export async function awardAchievements(user: UserId): Promise<readonly AchievementId[]> {
  throw new Error("not implemented");
}
```

Earned rows are never revoked (`04-logic-audit.md`, Migration constraints). Time-of-day rules (`watchedAtTime`, `watchedWithinWindow`) cannot read a date column. They read `entry.created_at` in the owner's zone, renamed "logged at", or are removed per DR-10. That is an owner call.

### notify

```ts
export type NotificationData =
  | { type: "entry_invitation"; tag: TagId; entry: EntryId }
  | { type: "invitation_accepted"; entry: EntryId }
  | { type: "write_reminder"; entry: EntryId }
  | { type: "recommendation_received"; recommendation: string }
  | { type: "friend_request"; } | { type: "friend_request_accepted" }
  | { type: "achievement_earned"; achievement: AchievementId }
  | { type: "shuffle_match"; list: string; title: TitleKey };
export async function notify(tx: Tx, to: UserId, actor: UserId | null, data: NotificationData): Promise<void> {
  throw new Error("not implemented");
}
/** Parses each row's data. Rows that point at entries the reader can no longer see are hidden. */
export async function notificationsFor(viewer: Viewer): Promise<readonly ParsedNotification[]> {
  throw new Error("not implemented");
}
```

## 6. Entry points

| Entry point today | New call | What changes for the user |
| --- | --- | --- |
| Title page Watched, film | `logEntry` with film scope, then the sheet calls `updateEntry` | Skip keeps the entry (F03). Rated films can be logged again (F04). No list changes (F69, F70) |
| Title page Watched, show | `startWatching`, or "Log the whole show" as `logEntry` with show scope | The button lights from `watchedStatuses` for TV too (F09) |
| List card eye | `logEntry`, same as the title page. Unwatching opens the entry list for that title, where the user deletes one | The list row is never written. The mark is derived (F01, F06) |
| Tracker episode tick | `markEpisodes({ episodes })` | The diary shows "Watched 3 episodes of X" for that day (F07) |
| Tracker season tick | `markEpisodes({ season })` | Episode list and runtimes come from the title cache, not the client |
| Tracker Mark All | `markEpisodes({ wholeShow: true })`, then `becameFinished` drives the optional show entry offer, queued after the task (DR-10) | Watch time and diary agree |
| Tracker Remove | `stopWatching` | Entries and notes stay (F77) |
| Tracker Rewatch | `startRewatch` | Run 2 is a new checklist. Entries number themselves |
| Write About (episode, season, show note) | `logEntry` with that scope and a note. If an entry for that exact scope exists, the UI offers to edit it, else it logs | Notes and ratings live together and the title page shows them (F23, F24, F84) |
| Remind me later | `logEntry` with `writeReminderOn`, default visibility, scope kept | No forced public log (F20) |
| Recommendation accept | Lists module adds to Want to watch with `from`, and sets `recommendation.status` (F49). No entry | Unchanged meaning, now recorded |
| Shuffle match | Lists module adds the title to the group list. No entry | Unchanged |
| Companion tagging | `withFriends` on `logEntry` or `updateEntry`, then `respondToInvitation` from the bell | Nothing appears in a friend's diary until they accept (DR-9, F13, F57) |
| Mark in tracker from a notification | `respondToInvitation(accept)` creates the entry. A separate "Tick in Watching" button calls `markEpisodes` | Scope show no longer fails (F11) |

The legacy procedures `watched.*`, `review.*`, `journalEntry.*`, `watchlist.markWatched`, `watchlist.quickMarkWatched`, `watchlist.isWatched`, `watchlist.keepInWatchlist`, `episodeTracker.addShow` and `watchEvent.backfillGenres` are deleted in the PR that moves their last caller.

## 7. Migration plan

Data migrations are `drizzle-kit generate --custom` files filled by hand. Each runs in one transaction. Every copy step is idempotent (`ON CONFLICT DO NOTHING` keyed by id, or anti-joined on `migration_entry_source`), so re-running after a partial failure is safe. Old tables are not modified until the contract steps. All steps rehearse first on the scrubbed production copy with `docs/redesign/program/prod-counts.sql` run before and after.

### 0005 expand

Creates the enums, `title`, `entry`, `entry_tag`, `show_run`, `episode_progress`, `taste_pick`, `migration_entry_source`, and adds `user.time_zone`. No data. Reversible by dropping them.

### 0006 seed the title cache from legacy rows

```sql
INSERT INTO title (media_type, tmdb_id, name, poster_path, runtime_minutes, genre_ids, seasons, fetched_at)
SELECT k.media_type::media_type, k.tmdb_id,
       coalesce(max(nullif(k.name, '')), ''), max(k.poster_path), max(k.runtime),
       coalesce((array_agg(k.genre_ids) FILTER (WHERE k.genre_ids IS NOT NULL))[1], '{}'),
       NULL, NULL
FROM (
  SELECT media_type, tmdb_id, title_name AS name, poster_path, NULL::int AS runtime,
         ARRAY(SELECT jsonb_array_elements_text(genre_ids)::int) AS genre_ids FROM watch_event
  UNION ALL SELECT media_type, tmdb_id, coalesce(title_name, title), poster_path,
         CASE WHEN media_type = 'movie' THEN runtime END, NULL FROM watchlist_item
  UNION ALL SELECT 'tv', tmdb_id, title_name, NULL, NULL, NULL FROM journal_entry
  UNION ALL SELECT media_type, tmdb_id, '', NULL, NULL, NULL FROM user_title
  UNION ALL SELECT 'tv', tmdb_id, '', NULL, NULL, NULL FROM episode_watch
  UNION ALL SELECT media_type, tmdb_id, '', NULL, NULL, NULL FROM review
) k GROUP BY k.media_type, k.tmdb_id
ON CONFLICT DO NOTHING;
UPDATE title t SET seasons = s.seasons FROM (          -- from user_title.season_episode_counts
  SELECT DISTINCT ON (tmdb_id) tmdb_id, (SELECT jsonb_agg(jsonb_build_object(
    'season', key::int, 'episodes', value::int, 'aired', value::int)) FROM jsonb_each_text(season_episode_counts)) AS seasons
  FROM user_title WHERE media_type = 'tv' AND season_episode_counts IS NOT NULL) s
WHERE t.media_type = 'tv' AND t.tmdb_id = s.tmdb_id AND t.seasons IS NULL;
```

Then `refreshStaleTitles` runs as a script until no row has `fetched_at` null. The migration does not depend on TMDB, the refresh does.

Invariants:

```sql
-- every legacy key has a title row (expect 0)
SELECT count(*) FROM (SELECT media_type, tmdb_id FROM watch_event UNION SELECT media_type, tmdb_id FROM watchlist_item
  UNION SELECT 'tv', tmdb_id FROM journal_entry UNION SELECT 'tv', tmdb_id FROM episode_watch) k
WHERE NOT EXISTS (SELECT 1 FROM title t WHERE t.media_type::text = k.media_type AND t.tmdb_id = k.tmdb_id);
-- after refresh: no empty names, every show has seasons (expect 0, 0)
SELECT count(*) FROM title WHERE name = '';
SELECT count(*) FROM title WHERE media_type = 'tv' AND seasons IS NULL;
```

Reversible: `TRUNCATE title` while nothing references it.

### 0007 watch_event becomes entry

Ids are kept, so notification deep links and the review reminder cron keep resolving. Mapping:

- `scope`: films get `film`. TV with null scope gets `show` (F21). TV episode or season rows missing their numbers are logged to a report table and copied as `show`.
- `watched_on = (coalesce(watched_at, created_at) AT TIME ZONE u.time_zone)::date`. This is the F30 fix: from here on the column is a date, so no save can shift it. Rows already shifted by past saves cannot be recovered, but a shift of a few hours moves the date by at most one day and only for rows saved near midnight.
- `visibility`: `public` becomes `friends`, `private` and `companion` become `only_me` (DR-4). Tagged people keep access through `entry_tag`.
- `note`: `coalesce(note, review_text)`. When both exist, `note || E'\n\n' || review_text` (DR-7).
- `write_reminder_on = (review_reminder_at AT TIME ZONE u.time_zone)::date`.

Reciprocal rows (`origin_event_id IS NOT NULL`) follow DR-9. A reciprocal the friend touched (rating or note set, visibility changed, or `updated_at > created_at + interval '5 seconds'`) is theirs now, so it is copied with `origin = 'invitation'`, `source_entry_id = origin_event_id`, and its two tags are `accepted` and linked both ways. An untouched reciprocal is not copied. Instead the origin entry gets a `pending` tag for that friend, and the friend sees an invitation. Their diary loses rows they never confirmed, and one tap restores each. If rehearsal counts show many untouched reciprocals, the fallback is to copy them all as accepted, which keeps every diary as it is today. That choice belongs to the owner and is the main judgment in this step.

Companion rows on non-reciprocal events: a `friend_id` with a matching reciprocal gives a tag as above. A `friend_id` with no reciprocal and no matching entry of the friend's gives `declined`, because the friend deleted it. A `friend_id` who is no longer a friend, or is blocked either way, becomes a name in `with_names` (F57 rows). A null `friend_id` becomes a name in `with_names`.

Invariants (each expects 0 unless stated):

```sql
-- every non-reciprocal and every touched reciprocal event became an entry with the same id
SELECT count(*) FROM watch_event w WHERE NOT EXISTS (SELECT 1 FROM entry e WHERE e.id = w.id)
  AND (w.origin_event_id IS NULL OR w.id IN (SELECT source_id FROM migration_entry_source WHERE action = 'copied'));
-- rating and owner preserved exactly
SELECT count(*) FROM watch_event w JOIN entry e ON e.id = w.id WHERE e.user_id <> w.user_id OR e.rating IS DISTINCT FROM w.rating;
-- no text lost: every non-empty note and review_text appears in the entry note
SELECT count(*) FROM watch_event w JOIN entry e ON e.id = w.id
WHERE (nullif(w.note, '') IS NOT NULL AND position(w.note IN e.note) = 0)
   OR (nullif(w.review_text, '') IS NOT NULL AND position(w.review_text IN e.note) = 0);
-- no widening: no entry is visible to friends that was not public before
SELECT count(*) FROM watch_event w JOIN entry e ON e.id = w.id WHERE e.visibility = 'friends' AND w.visibility <> 'public';
-- every untouched reciprocal is now a pending tag on its origin
SELECT count(*) FROM watch_event w WHERE w.origin_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entry e WHERE e.id = w.id)
  AND NOT EXISTS (SELECT 1 FROM entry_tag t WHERE t.entry_id = w.origin_event_id AND t.user_id = w.user_id);
-- watched_on never later than created_at's date in the owner's zone, and never in the future
SELECT count(*) FROM entry e JOIN "user" u ON u.id = e.user_id WHERE e.watched_on > (now() AT TIME ZONE u.time_zone)::date;
-- report, not a gate: legacy watch_number versus derived ordinal
SELECT count(*) FROM (SELECT e.id, row_number() OVER (PARTITION BY e.user_id, e.media_type, e.tmdb_id, e.scope,
  e.season_number, e.episode_number ORDER BY e.watched_on, e.created_at, e.id) AS ord FROM entry e) d
JOIN watch_event w ON w.id = d.id WHERE w.media_type = 'tv' AND w.watch_number <> d.ord;
```

Reversible: `DELETE FROM entry WHERE id IN (SELECT entry_id FROM migration_entry_source WHERE source_table = 'watch_event')`, tags cascade.

### 0008 journal_entry and review become entries (DR-5, DR-7)

For each `journal_entry`, find a copied `watch_event` with the same user, `tmdb_id`, scope (null read as `show`), season, episode and `watch_number` whose note is empty. If one exists, the journal text becomes its note, and the entry's visibility becomes the stricter of the two, so a private journal note never becomes visible through a public entry. Otherwise insert a new entry: media `tv`, the same scope, `watched_on` from `created_at` in the owner's zone, `visibility` from `is_public`, `origin = 'journal'`. Every row writes `migration_entry_source` with `merged_note` or `created`.

Each `review` row (expected 0, F16) becomes a film or show entry with `visibility = 'only_me'`, because `review` had no visibility column, unless an entry for that title already has the same rating and no note, in which case its text merges as above.

```sql
-- every journal row has a source record, and its text is in that entry (expect 0, 0)
SELECT count(*) FROM journal_entry j WHERE NOT EXISTS (SELECT 1 FROM migration_entry_source m WHERE m.source_table = 'journal_entry' AND m.source_id = j.id);
SELECT count(*) FROM journal_entry j JOIN migration_entry_source m ON m.source_table = 'journal_entry' AND m.source_id = j.id
  JOIN entry e ON e.id = m.entry_id WHERE position(j.note IN e.note) = 0;
-- no journal note became more visible (expect 0)
SELECT count(*) FROM journal_entry j JOIN migration_entry_source m ON m.source_id = j.id AND m.source_table = 'journal_entry'
  JOIN entry e ON e.id = m.entry_id WHERE NOT j.is_public AND e.visibility = 'friends';
-- journal is TV only (expect 0, checked before the copy runs)
SELECT count(*) FROM journal_entry j WHERE NOT EXISTS (SELECT 1 FROM title t WHERE t.media_type = 'tv' AND t.tmdb_id = j.tmdb_id);
SELECT count(*) FROM review r WHERE NOT EXISTS (SELECT 1 FROM migration_entry_source m WHERE m.source_table = 'review' AND m.source_id = r.id);
```

Reversible: delete `created` entries by source, and for `merged_note` rows restore the note to null and the visibility from the copied `watch_event`.

### 0009 list flags become entries (DR-6)

For single-member lists, the owner is the watcher. For each `(owner, title)` with a `watched` row and no entry, insert one entry: film scope for films, show scope for TV without `watched_seasons`, one season entry per listed season otherwise. `watched_on` comes from `watched_at` or `created_at`, `origin = 'list_flag'`, `visibility = 'only_me'` (a flag was never shown to friends as a diary item), and `legacy_minutes` takes the list runtime for TV, because film runtime now comes from `title`. On lists with more than one member the watcher is unknown (F06). Those rows go to a report, not into anyone's diary, and the owner decides after seeing the count.

```sql
-- every single-member watched flag now has an entry for the owner (expect 0)
SELECT count(*) FROM watchlist_item wi JOIN watchlist w ON w.id = wi.watchlist_id
WHERE wi.watched AND (SELECT count(*) FROM watchlist_member m WHERE m.watchlist_id = w.id) <= 1
  AND NOT EXISTS (SELECT 1 FROM entry e WHERE e.user_id = w.owner_id AND e.tmdb_id = wi.tmdb_id AND e.media_type::text = wi.media_type);
-- no duplicate backfills for one person and title (expect 0)
SELECT count(*) FROM (SELECT user_id, media_type, tmdb_id, scope, season_number FROM entry WHERE origin = 'list_flag'
  GROUP BY 1,2,3,4,5 HAVING count(*) > 1) d;
```

Reversible: `DELETE FROM entry WHERE origin = 'list_flag'`.

### 0010 progress and taste picks

Each `(user, tmdb_id)` in `user_title` (TV) or `episode_watch` gets one run per distinct `watch_number`, ordered by watch number, with `started_at` from the first episode or `user_title.created_at`. All runs below `current_watch_number` close as `superseded`. `episode_watch` rows copy into their run with `watched_on` from `watched_at` in the owner's zone (F32 stays true for old rows: their date is the click date). Run visibility is `friends`, unless every entry the user has for that show is `only_me`, in which case the run is `only_me`, so progress never reveals a show the user kept private. Film rows in `user_title` become `taste_pick`.

```sql
-- every episode row copied exactly once (expect equal counts)
SELECT (SELECT count(*) FROM episode_watch), (SELECT count(*) FROM episode_progress);
-- at most one active run per user and show is enforced by the index; check each user_title has one
SELECT count(*) FROM user_title ut WHERE ut.media_type = 'tv'
  AND NOT EXISTS (SELECT 1 FROM show_run r WHERE r.user_id = ut.user_id AND r.tmdb_id = ut.tmdb_id AND r.closed_at IS NULL);
-- TV watch time is unchanged per user (expect 0 rows)
SELECT o.user_id FROM (SELECT user_id, sum(runtime) AS m FROM episode_watch GROUP BY user_id) o
FULL JOIN (SELECT user_id, sum(runtime_minutes) AS m FROM episode_progress GROUP BY user_id) n USING (user_id)
WHERE o.m IS DISTINCT FROM n.m;
```

Reversible: truncate `episode_progress`, `show_run`, `taste_pick`.

### 0011 notification links

```sql
CREATE TABLE migration_notification_data AS SELECT id, type, data FROM notification;   -- for reversal
UPDATE notification SET data = (data - 'watchEventId') || jsonb_build_object('entryId', data->'watchEventId')
WHERE data ? 'watchEventId';
UPDATE notification n SET type = 'entry_invitation',
  data = jsonb_build_object('tag', t.id, 'entry', t.entry_id)
FROM entry_tag t WHERE n.type IN ('watched_with', 'companion_reviewed')
  AND t.entry_id = n.data->>'entryId' AND t.user_id = n.recipient_id AND t.response = 'pending';
```

Links that pointed at a `watch_event` id resolve unchanged because ids were kept. Links to entries the reader may no longer see, such as an old `companion` row the friend was not tagged on, are hidden by `notificationsFor`, which joins through `canSeeEntrySql`. Links to deleted rows render as "This entry was deleted". The types never emitted (F46) are dropped from the union and their rows deleted. Reversible by restoring `data` and `type` from `migration_notification_data`.

```sql
-- every entryId in a notification exists, or the row is a known deletion (report)
SELECT count(*) FROM notification n WHERE n.data ? 'entryId' AND NOT EXISTS (SELECT 1 FROM entry e WHERE e.id = n.data->>'entryId');
```

### 0012 switch-over catch-up

Writers switch to the domain in the same release as each copy (section 8), but while a deploy runs migrations the old container may still serve. 0012 re-runs the idempotent copies of 0007 to 0010 for rows created in that window, and deletes entries whose `watch_event` source vanished in it. It is the first migration of the release after each switch, and its invariants are the union of the earlier ones.

### 0013 contract, reversible

After every reader has moved and the mirror (section 8) has been off for one release:

```sql
CREATE SCHEMA legacy;
ALTER TABLE watch_event SET SCHEMA legacy;  -- also watch_event_companion, journal_entry, review,
ALTER TABLE episode_watch SET SCHEMA legacy; -- user_title
ALTER TABLE watchlist_item DROP COLUMN watched, DROP COLUMN watched_at, DROP COLUMN kept_in_watchlist,
  DROP COLUMN watched_seasons, DROP COLUMN runtime, DROP COLUMN title, DROP COLUMN title_name, DROP COLUMN poster_path;
ALTER TABLE watchlist_item ADD FOREIGN KEY (media_type, tmdb_id) REFERENCES title (media_type, tmdb_id);
ALTER TABLE recommendation DROP COLUMN title_name; -- plus the same title FK
```

Moving tables to `legacy` is reversible with `SET SCHEMA public`. The dropped `watchlist_item` columns are first copied to `legacy.watchlist_item_flags`, so they are reversible too. Before this step, a `pg_dump` of the database is taken and kept.

### 0014 drop legacy, irreversible

Thirty days after 0013 with no reversal: `DROP SCHEMA legacy CASCADE`, drop `migration_entry_source` and `migration_notification_data`. Only the backup reverses it.

## 8. Order of PRs

Each PR leaves the app working and lands on `next`. A slice that switches writers also switches the readers that would otherwise show stale state.

1. **Time zone capture.** Add `user.time_zone`, write it from the client on each session. Must run in production for some days before 0007, so copied dates use real zones.
2. **Audience module over today's tables.** `relationshipBetween`, `requireFriends`, `friendIdsSql`, `notBlockedSql`, used by every existing read and the companion write. Fixes F55 and F57 before any data moves. `canSeeEntrySql` lands later with `entry`.
3. **Title cache.** 0005 (title part only) and 0006, `ensureTitles`, `refreshStaleTitles`, and the cron hook. Writers start calling `ensureTitles`. Nothing reads it yet.
4. **Expand and copy diary data.** The rest of 0005, then 0007, 0008, 0009 and 0011. The diary module with `logEntry`, `updateEntry`, `deleteEntry` and an internal legacy mirror that writes the same id into `watch_event` (and `journal_entry` for journal-origin entries) so every old reader stays correct. The procedures `watchEvent.create`, `update`, `delete` and `journalEntry.*` become thin adapters onto the domain in this PR, so no writer reaches the old tables directly. `watchedStatuses` replaces `watchlist.isWatched`, and list cards read it, in the same PR, because the flag stops being written. Rehearsal on the production copy gates the merge.
5. **Title page and list card.** The UI calls the domain shapes directly: tap creates the entry, the sheet edits it, request ids, Remind me later. Deletes `watchlist.markWatched`, `quickMarkWatched`, `keepInWatchlist`, `watched.*`, `review.*`. 0012 ships first in this release.
6. **Invitations.** `entry_tag` UI, `respondToInvitation`, the `entry_invitation` notification and bell actions. Deletes the reciprocal code in the mirror.
7. **Progress.** 0010, the progress module, the tracker on `show_run` and `episode_progress`, completion from `showStatus`. Deletes `episodeTracker.addShow`, `markFromNotification`, `removeShow` and the `user_title` readers. Onboarding writes `taste_pick`.
8. **Diary and feed.** `diaryPage`, `feedPage`, `diarySummary`, and profile, heatmap and stats on them. Deletes `watchEvent.getFeed`, `getUserEvents`, `friend.watchActivity`, `genreStats`, `ratingsByStars`, `journalEntry.getAll`. Wave 4 builds the Diary screen on `diaryPage`.
9. **Achievements.** `diaryStats`, `metAchievements`, `awardAchievements`. Deletes `ACTION_CONTEXT_MAP` and the list-row counts (F39).
10. **Stop the mirror.** Remove the legacy mirror and the adapters' last callers. One release of soak with invariants run daily.
11. **Contract.** 0013, then 0014 thirty days later.

## 9. Risks

- **The copy-and-switch release (PR 4).** Two stores are live at once. The mirror keeps old readers right, but any old writer the PR misses writes only to `watch_event` and its rows never reach `entry`. Mitigation: the biome rule on schema imports goes in first, so a missed writer fails the build, and 0012 catches deploy-window rows.
- **Untouched reciprocals turn into invitations.** Friends' diaries shrink by rows they never confirmed. The fallback keeps every row. Needs the owner's call with the rehearsal count.
- **Dates.** Converting timestamps to dates uses the user's zone, which only exists for people who signed in after PR 1. Others get the default zone. A wrong zone moves an entry by at most one day.
- **Derived rewatch numbers can differ from legacy watch numbers** for TV entries whose old numbers did not follow date order, and for journal notes dated by creation. The 0007 report counts them. The derived number is the DR-8 definition, so a difference is a correction, but users may notice.
- **Shared-list flags are not backfilled** because the watcher is unknown (F06). The count decides whether this needs a rule.
- **TMDB dependence moves into writes.** `ensureTitles` hides it with a stub row, but a stub has no runtime or seasons until the refresh, so watch time and completion lag for brand-new titles while TMDB is down.
- **Progress visibility is new.** DR-4 talks about entries. This sketch gives a run its own visibility so progress lines in the feed respect privacy. It needs a one-line amendment to DR-4.
- **Query cost.** The diary page is a union with a window function. It is indexed for both halves and hydrates per page, but needs `EXPLAIN ANALYZE` on the production copy for the heaviest user.

## 10. Red-flag screen of this design

| Flag | Result |
| --- | --- |
| Shallow module | Pass. `diary` hides titles, tags, invitations, notifications, ordinals, achievements and the mirror behind nine functions. `audience` is the thinnest, but each function is policy, not forwarding |
| Information leakage | One known case. The visibility rule exists as SQL and as a pure function. Mitigated by a parity test that runs both over one fixture of owners, viewers, tags, friendships and blocks, and by keeping both in one file. Wire types do not leak: routers parse zod into branded types and domain returns domain types |
| Temporal decomposition | Pass for the code, which is grouped by what it owns. The migration is temporal by nature and lives only in `drizzle/` |
| Pass-through method | The tRPC routers forward to domain functions, but they add parsing and error mapping, which is their job as the boundary. The temporary `watchEvent.*` adapters are pass-through and are deleted in PR 5 |
| Split ownership | Pass after PR 4. Each table has one writing module, enforced by the schema-import rule. During PRs 4 to 9 the mirror writes `watch_event`, but it lives inside `diary`, the only writer, so ownership is still single |
| Two ways to do one task | Pass. One `logEntry`, one `markEpisodes`, one `showStatus`, one `watchedStatuses`. Writing About and logging are the same call. Legacy procedures are deleted with their last caller |
| Importable internals | Pass. `internal/` folders are guarded by the boundary test, and the domain tables by the biome rule |
| Hand-synced list | Pass. Postgres enums derive from TypeScript `as const` arrays, achievement evaluators are a `Record` over condition types, notification types are one union, and `ACTION_CONTEXT_MAP` is deleted rather than kept in sync |

## 11. Synthesis notes for the comparison

What this sketch offers that an in-place evolution would struggle to: a database that rejects wrong scopes and wrong media pairs, one title row instead of four copies, a rewatch number that cannot drift because it is never stored, a run model where rewatching a show is a new checklist rather than a counter, and old tables kept untouched and complete until the contract, which makes every step before 0013 reversible by deleting new rows. What it costs: more migrations, a temporary mirror, a one-time decision about untouched reciprocals, and a write path that depends on the title cache. If the synthesis prefers the in-place shape, the parts most worth grafting are the `title` cache, `CalendarDate` with a `date` column, derived ordinals, `show_run`, the composite foreign key on progress, and `canSeeEntrySql` with its parity test.
