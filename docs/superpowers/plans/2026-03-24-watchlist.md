# Watchlist Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-watchlist system where users create named watchlists, add movies/TV shows, collaborate with friends, and manage their viewing queue — with a drive-in themed UI featuring animated film reel carousels.

**Architecture:** Three new database tables (watchlist, watchlistItem, watchlistMember) with a tRPC router handling CRUD + collaboration. Two new routes: overview page with film reel carousels per watchlist, and detail page with poster grid + filters. The "Add to Watchlist" dropdown integrates into the existing search and title detail pages.

**Tech Stack:** TanStack Start, TanStack Router, tRPC, Drizzle ORM (PostgreSQL), Tailwind CSS, Lucide icons, Motion (animations), Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-watchlist-design.md`

**Branch dependency:** The `title-page` branch must be merged into `watchlist` before Task 8 (title page integration). Tasks 1–7 can proceed independently.

---

## File Structure

### New Files

```
src/db/schema.ts                                          — modify: add 3 new tables + relations
src/integrations/trpc/router.ts                           — modify: register watchlistRouter
src/integrations/trpc/routers/watchlist.ts                — create: all watchlist procedures
src/integrations/trpc/routers/taste-profile.ts            — modify: seed default watchlist on onboarding
src/integrations/trpc/__tests__/watchlist.test.ts         — create: tests for watchlist router
src/routes/app/route.tsx                                  — modify: add Watchlists nav link
src/routes/app/watchlists/index.tsx                       — create: overview page route
src/routes/app/watchlists/$watchlistId.tsx                — create: detail page route
src/components/watchlist/now-showing-header.tsx            — create: marquee header
src/components/watchlist/new-watchlist-button.tsx          — create: amber pill button with animations
src/components/watchlist/watchlist-reel.tsx                — create: film reel strip per watchlist
src/components/watchlist/watchlist-reel-header.tsx         — create: name, count, badges, settings
src/components/watchlist/film-strip.tsx                    — create: continuous scrolling poster strip
src/components/watchlist/watchlist-atmosphere.tsx           — create: starfield, grain, fog, glow
src/components/watchlist/watchlist-detail-header.tsx       — create: detail page header with actions
src/components/watchlist/watchlist-filters.tsx             — create: sort/filter controls
src/components/watchlist/watchlist-item-card.tsx           — create: poster card with actions
src/components/watchlist/add-to-watchlist-dropdown.tsx     — create: dropdown picker + inline create
src/components/watchlist/invite-member-modal.tsx           — create: user search + invite modal
src/components/watchlist/create-watchlist-dialog.tsx       — create: new watchlist dialog (from overview)
```

---

### Task 1: Database Schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the `watchlist` table**

Add after the existing `userTitle` table:

```typescript
export const watchlist = pgTable(
	"watchlist",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		isPublic: boolean("is_public").default(false).notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("watchlist_owner_id_idx").on(table.ownerId),
	],
);
```

- [ ] **Step 2: Add the `watchlistItem` table**

```typescript
export const watchlistItem = pgTable(
	"watchlist_item",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		watchlistId: text("watchlist_id")
			.notNull()
			.references(() => watchlist.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		addedBy: text("added_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		watched: boolean("watched").default(false).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("watchlist_item_unique").on(
			table.watchlistId,
			table.tmdbId,
			table.mediaType,
		),
		index("watchlist_item_watchlist_id_idx").on(table.watchlistId),
	],
);
```

- [ ] **Step 3: Add the `watchlistMember` table**

```typescript
export const watchlistMember = pgTable(
	"watchlist_member",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		watchlistId: text("watchlist_id")
			.notNull()
			.references(() => watchlist.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("member"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("watchlist_member_unique").on(table.watchlistId, table.userId),
		index("watchlist_member_watchlist_id_idx").on(table.watchlistId),
		index("watchlist_member_user_id_idx").on(table.userId),
	],
);
```

- [ ] **Step 4: Add relations**

```typescript
export const watchlistRelations = relations(watchlist, ({ one, many }) => ({
	owner: one(user, { fields: [watchlist.ownerId], references: [user.id] }),
	items: many(watchlistItem),
	members: many(watchlistMember),
}));

export const watchlistItemRelations = relations(watchlistItem, ({ one }) => ({
	watchlist: one(watchlist, {
		fields: [watchlistItem.watchlistId],
		references: [watchlist.id],
	}),
	addedByUser: one(user, {
		fields: [watchlistItem.addedBy],
		references: [user.id],
	}),
}));

export const watchlistMemberRelations = relations(watchlistMember, ({ one }) => ({
	watchlist: one(watchlist, {
		fields: [watchlistMember.watchlistId],
		references: [watchlist.id],
	}),
	user: one(user, {
		fields: [watchlistMember.userId],
		references: [user.id],
	}),
}));
```

- [ ] **Step 5: Generate and run migration**

Run: `bunx drizzle-kit generate`
Run: `bunx drizzle-kit migrate`

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add watchlist, watchlistItem, watchlistMember tables"
```

---

### Task 2: Watchlist tRPC Router — Queries

**Files:**
- Create: `src/integrations/trpc/routers/watchlist.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the watchlist router file with `list` query**

Create `src/integrations/trpc/routers/watchlist.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, eq, ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	user,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { TRPCError } from "@trpc/server";

export const watchlistRouter = {
	list: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db
			.select({ watchlistId: watchlistMember.watchlistId })
			.from(watchlistMember)
			.where(eq(watchlistMember.userId, ctx.userId));

		const watchlistIds = memberships.map((m) => m.watchlistId);
		if (watchlistIds.length === 0) return [];

		const watchlists = await db.query.watchlist.findMany({
			where: (wl, { inArray }) => inArray(wl.id, watchlistIds),
			with: {
				items: { columns: { tmdbId: true, mediaType: true }, limit: 20 },
				members: {
					with: { user: { columns: { id: true, username: true, avatarUrl: true } } },
				},
			},
			orderBy: (wl, { desc }) => [desc(wl.isDefault), desc(wl.updatedAt)],
		});

		return watchlists.map((wl) => ({
			...wl,
			itemCount: wl.items.length,
			memberCount: wl.members.length,
		}));
	}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Add `get` query**

Add to the router object:

```typescript
	get: protectedProcedure
		.input(z.object({ watchlistId: z.string() }))
		.query(async ({ input, ctx }) => {
			const membership = await db.query.watchlistMember.findFirst({
				where: and(
					eq(watchlistMember.watchlistId, input.watchlistId),
					eq(watchlistMember.userId, ctx.userId),
				),
			});

			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
				with: {
					items: {
						with: {
							addedByUser: {
								columns: { id: true, username: true, avatarUrl: true },
							},
						},
						orderBy: (item, { desc }) => [desc(item.createdAt)],
					},
					members: {
						with: {
							user: {
								columns: { id: true, username: true, avatarUrl: true },
							},
						},
					},
				},
			});

			if (!wl) throw new TRPCError({ code: "NOT_FOUND" });
			if (!wl.isPublic && !membership) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			const userRole = membership?.role ?? null;
			return { ...wl, userRole };
		}),
```

- [ ] **Step 3: Add `getForDropdown` and `searchUsers` queries**

```typescript
	getForDropdown: protectedProcedure.query(async ({ ctx }) => {
		const memberships = await db
			.select({ watchlistId: watchlistMember.watchlistId, role: watchlistMember.role })
			.from(watchlistMember)
			.where(eq(watchlistMember.userId, ctx.userId));

		const watchlistIds = memberships
			.filter((m) => m.role === "owner" || m.role === "member")
			.map((m) => m.watchlistId);

		if (watchlistIds.length === 0) return [];

		return db.query.watchlist.findMany({
			where: (wl, { inArray }) => inArray(wl.id, watchlistIds),
			columns: { id: true, name: true, isDefault: true },
			orderBy: (wl, { desc }) => [desc(wl.isDefault), desc(wl.updatedAt)],
		});
	}),

	searchUsers: protectedProcedure
		.input(z.object({ query: z.string().min(2) }))
		.query(async ({ input, ctx }) => {
			return db
				.select({
					id: user.id,
					username: user.username,
					avatarUrl: user.avatarUrl,
				})
				.from(user)
				.where(
					and(
						ilike(user.username, `%${input.query}%`),
						ne(user.id, ctx.userId),
					),
				)
				.limit(10);
		}),
```

- [ ] **Step 4: Register the router**

In `src/integrations/trpc/router.ts`, add:

```typescript
import { watchlistRouter } from "./routers/watchlist";
```

And add `watchlist: watchlistRouter` to the `createTRPCRouter` call.

- [ ] **Step 5: Verify the app compiles**

Run: `bun run build`

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts src/integrations/trpc/router.ts
git commit -m "feat: add watchlist tRPC router with list, get, getForDropdown, searchUsers queries"
```

---

### Task 3: Watchlist tRPC Router — Mutations

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts`

- [ ] **Step 1: Add auth helper function**

Add above the router export in `watchlist.ts`:

```typescript
async function assertOwner(watchlistId: string, userId: string) {
	const membership = await db.query.watchlistMember.findFirst({
		where: and(
			eq(watchlistMember.watchlistId, watchlistId),
			eq(watchlistMember.userId, userId),
			eq(watchlistMember.role, "owner"),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}

async function assertMember(watchlistId: string, userId: string) {
	const membership = await db.query.watchlistMember.findFirst({
		where: and(
			eq(watchlistMember.watchlistId, watchlistId),
			eq(watchlistMember.userId, userId),
		),
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
}
```

- [ ] **Step 2: Add `create` mutation**

```typescript
	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				isPublic: z.boolean().optional().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return db.transaction(async (tx) => {
				const [wl] = await tx
					.insert(watchlist)
					.values({
						name: input.name,
						ownerId: ctx.userId,
						isPublic: input.isPublic,
					})
					.returning();

				await tx.insert(watchlistMember).values({
					watchlistId: wl.id,
					userId: ctx.userId,
					role: "owner",
				});

				return wl;
			});
		}),
```

- [ ] **Step 3: Add `update` and `delete` mutations**

```typescript
	update: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				name: z.string().min(1).max(100).optional(),
				isPublic: z.boolean().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			const { watchlistId, ...updates } = input;
			if (Object.keys(updates).length === 0) return;
			await db
				.update(watchlist)
				.set(updates)
				.where(eq(watchlist.id, watchlistId));
		}),

	delete: protectedProcedure
		.input(z.object({ watchlistId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			const wl = await db.query.watchlist.findFirst({
				where: eq(watchlist.id, input.watchlistId),
			});
			if (wl?.isDefault) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot delete the default watchlist",
				});
			}
			await db.delete(watchlist).where(eq(watchlist.id, input.watchlistId));
		}),
```

- [ ] **Step 4: Add item mutations (`addItem`, `removeItem`, `markWatched`)**

```typescript
	addItem: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);
			await db
				.insert(watchlistItem)
				.values({
					watchlistId: input.watchlistId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					addedBy: ctx.userId,
				})
				.onConflictDoNothing();
		}),

	removeItem: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			await db
				.delete(watchlistItem)
				.where(
					and(
						eq(watchlistItem.watchlistId, input.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);
		}),

	markWatched: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				watched: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertMember(input.watchlistId, ctx.userId);
			await db
				.update(watchlistItem)
				.set({ watched: input.watched })
				.where(
					and(
						eq(watchlistItem.watchlistId, input.watchlistId),
						eq(watchlistItem.tmdbId, input.tmdbId),
						eq(watchlistItem.mediaType, input.mediaType),
					),
				);
		}),
```

- [ ] **Step 5: Add member mutations (`addMember`, `removeMember`)**

```typescript
	addMember: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			await db
				.insert(watchlistMember)
				.values({
					watchlistId: input.watchlistId,
					userId: input.userId,
					role: "member",
				})
				.onConflictDoNothing();
		}),

	removeMember: protectedProcedure
		.input(
			z.object({
				watchlistId: z.string(),
				userId: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await assertOwner(input.watchlistId, ctx.userId);
			if (input.userId === ctx.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot remove yourself as owner",
				});
			}
			await db
				.delete(watchlistMember)
				.where(
					and(
						eq(watchlistMember.watchlistId, input.watchlistId),
						eq(watchlistMember.userId, input.userId),
					),
				);
		}),
```

- [ ] **Step 6: Verify compilation**

Run: `bun run build`

- [ ] **Step 7: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "feat: add watchlist mutations — create, update, delete, items, members"
```

---

### Task 4: Watchlist Router Tests

**Files:**
- Create: `src/integrations/trpc/__tests__/watchlist.test.ts`

- [ ] **Step 1: Write tests for the watchlist router**

Follow the existing test patterns in `search.test.ts` and `taste-profile.test.ts`. Mock the database module and test:

- `create` — creates a watchlist and adds owner as member
- `create` — validates name (min 1 char)
- `list` — returns watchlists the user is a member of
- `list` — returns empty array when user has no watchlists
- `get` — returns watchlist with items and members
- `get` — throws FORBIDDEN for non-members on private watchlist
- `delete` — throws BAD_REQUEST for default watchlist
- `delete` — throws FORBIDDEN for non-owners
- `addItem` — adds an item, idempotent on conflict
- `removeItem` — throws FORBIDDEN for non-owners
- `markWatched` — toggles watched status
- `addMember` — adds a member, idempotent on conflict
- `addMember` — throws FORBIDDEN for non-owners
- `removeMember` — throws BAD_REQUEST when removing self as owner

- [ ] **Step 2: Run tests**

Run: `bun run test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/__tests__/watchlist.test.ts
git commit -m "test: add watchlist router tests"
```

---

### Task 5: Onboarding Integration

**Files:**
- Modify: `src/integrations/trpc/routers/taste-profile.ts`

- [ ] **Step 1: Import watchlist tables**

Add to imports:
```typescript
import { watchlist, watchlistItem, watchlistMember } from "#/db/schema";
```

- [ ] **Step 2: Extend `saveTasteProfile` mutation**

Inside the existing `db.transaction` block, after the `userTitle` insert and before the `user.update`, add:

```typescript
				// Create default watchlist seeded with onboarding picks
				const [defaultWatchlist] = await tx
					.insert(watchlist)
					.values({
						name: "My Picks",
						ownerId: userId,
						isDefault: true,
					})
					.returning();

				await tx.insert(watchlistMember).values({
					watchlistId: defaultWatchlist.id,
					userId,
					role: "owner",
				});

				await tx.insert(watchlistItem).values(
					input.titles.map((t) => ({
						watchlistId: defaultWatchlist.id,
						tmdbId: t.tmdbId,
						mediaType: t.mediaType,
						addedBy: userId,
					})),
				);
```

- [ ] **Step 3: Verify compilation**

Run: `bun run build`

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/taste-profile.ts
git commit -m "feat: seed default watchlist with onboarding picks"
```

---

### Task 6: Watchlist Overview Page — Atmosphere & Header

**Files:**
- Create: `src/components/watchlist/watchlist-atmosphere.tsx`
- Create: `src/components/watchlist/now-showing-header.tsx`
- Create: `src/components/watchlist/new-watchlist-button.tsx`
- Create: `src/routes/app/watchlists/index.tsx`
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Create `watchlist-atmosphere.tsx`**

Starfield (90 stars with twinkle), film grain overlay, pink ground glow, low-lying fog layers. Match the title page's `TitlePageAtmosphere` component approach — individually positioned star elements with CSS custom properties for animation timing. Add fog layers with slow horizontal drift animation.

@skills/router-core/SKILL.md for route patterns.

- [ ] **Step 2: Create `now-showing-header.tsx`**

Amber-bordered marquee with chasing amber bulbs (top and bottom rows, alternating even/odd animation delay), "NOW SHOWING" in Space Mono uppercase, "My Watchlists" in Righteous font. Match the `NowShowingMarquee` component from the `title-page` branch but simplified — just takes a `title` string prop, no year/runtime/contentRating.

- [ ] **Step 3: Create `new-watchlist-button.tsx`**

Amber pill button (#FFB800) with Manrope 13px bold. Two-phase animation:
1. On mount: typewriter effect — text types out letter by letter with a blinking cursor (use `useEffect` + `useState` to reveal characters, then remove cursor)
2. After typewriter completes: transition to shimmer sweep loop (CSS `::before` pseudo-element with `linear-gradient` sweeping left to right)

Button opens the `CreateWatchlistDialog` (built in Task 9).

- [ ] **Step 4: Create the overview route at `src/routes/app/watchlists/index.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/watchlists/")({
	component: WatchlistOverviewPage,
});
```

Use `useTRPC` + `useQuery` with `trpc.watchlist.list.queryOptions()` to fetch watchlists. Render atmosphere, header, button, and a placeholder for reels (built next task).

- [ ] **Step 5: Add Watchlists nav link**

In `src/routes/app/route.tsx`, add a `<Link>` to `/app/watchlists` in the nav alongside the Search link. Use the Lucide `Bookmark` icon. Active state: `[&.active]:text-neon-pink [&.active]:bg-neon-pink/8`.

- [ ] **Step 6: Verify the page renders**

Run: `bun run dev`, navigate to `/app/watchlists`. Should show atmosphere, marquee header, and button.

- [ ] **Step 7: Commit**

```bash
git add src/components/watchlist/ src/routes/app/watchlists/ src/routes/app/route.tsx
git commit -m "feat: watchlist overview page — atmosphere, marquee header, nav link"
```

---

### Task 7: Film Reel Carousel

**Files:**
- Create: `src/components/watchlist/watchlist-reel.tsx`
- Create: `src/components/watchlist/watchlist-reel-header.tsx`
- Create: `src/components/watchlist/film-strip.tsx`
- Modify: `src/routes/app/watchlists/index.tsx`

- [ ] **Step 1: Create `film-strip.tsx`**

The core visual component. Takes an array of poster items (tmdbId, mediaType, posterPath). Renders:
- A continuous horizontal strip with `overflow: hidden` and `mask-image` fade edges
- Inside: a `reel-track` div containing sprocket row (top), strip line, poster row, strip line, sprocket row (bottom) — all in a flex-column layout
- Poster row: each poster in a `poster-slot` div with thin dividers between
- Sprocket rows: evenly spaced `sprocket-hole` divs
- Repeats posters to fill at least 12 slots so there are no gaps
- Duplicates the full set for seamless CSS `translateX(-50%)` loop animation at 45s
- `animation-play-state: paused` on hover
- Use actual TMDB poster images via `getTmdbImageUrl(posterPath, "w185")`

- [ ] **Step 2: Create `watchlist-reel-header.tsx`**

Takes: watchlist name, item count, isDefault, isShared (members.length > 1), members array. Renders:
- Watchlist name (Manrope 13px bold)
- Title count (cream/30)
- "Default" badge (neon-pink/10 bg, neon-pink/70 text) if isDefault
- "Shared" badge (neon-cyan/10 bg, neon-cyan/70 text) if shared
- Stacked member avatars (first letter, circular, overlapping)
- Settings gear icon button (Lucide `Settings`, opens settings — wired in Task 9)

- [ ] **Step 3: Create `watchlist-reel.tsx`**

Composes `WatchlistReelHeader` and `FilmStrip`. The whole reel is a `<Link>` to `/app/watchlists/$watchlistId` so clicking navigates to the detail page. Add a subtle pink glow line below each reel.

- [ ] **Step 4: Wire into the overview page**

In `src/routes/app/watchlists/index.tsx`, map over the watchlist list query results and render a `<WatchlistReel>` for each. Handle loading state with skeleton reels. Handle empty state ("No watchlists yet — create your first one!").

- [ ] **Step 5: Verify the film reels render and scroll**

Run: `bun run dev`, navigate to `/app/watchlists`. Should show animated film reel strips for each watchlist.

- [ ] **Step 6: Commit**

```bash
git add src/components/watchlist/ src/routes/app/watchlists/index.tsx
git commit -m "feat: film reel carousel with sprocket holes, scrolling posters"
```

---

### Task 8: Watchlist Detail Page

**Files:**
- Create: `src/routes/app/watchlists/$watchlistId.tsx`
- Create: `src/components/watchlist/watchlist-detail-header.tsx`
- Create: `src/components/watchlist/watchlist-filters.tsx`
- Create: `src/components/watchlist/watchlist-item-card.tsx`

**Prerequisite:** If the `title-page` branch has TMDB poster/title fetching utilities, merge it first. Otherwise, fetch TMDB data for each watchlist item via the existing `search` or `title` router.

- [ ] **Step 1: Create `watchlist-item-card.tsx`**

Similar to `PosterCard` from search but with watchlist-specific overlays:
- Poster image, title, year, rating, genre tags (same as PosterCard)
- "Watched" toggle button (Lucide `Eye` / `EyeOff`) — calls `watchlist.markWatched` mutation
- "Remove" button (Lucide `Trash2`) — only shown if `userRole === "owner"`, calls `watchlist.removeItem`
- If `watched === true`, show a subtle overlay with a checkmark
- Show "Added by @username" text if the watchlist is shared

- [ ] **Step 2: Create `watchlist-filters.tsx`**

Adapt the search page filter pattern. URL search params:
- `sort`: "date-added" | "title" | "year" | "rating" (default: "date-added")
- `type`: "all" | "movie" | "tv" (default: "all")

Client-side filtering and sorting since the data is already loaded from `watchlist.get`.

- [ ] **Step 3: Create `watchlist-detail-header.tsx`**

Shows the watchlist name, member count, and action buttons (owner only):
- "Invite" button — opens InviteMemberModal (Task 9)
- "Rename" — inline edit or modal
- "Public/Private" toggle
- "Delete" — with confirmation dialog

Use the arcade button style for "Invite" (cyan color). Use smaller icon buttons for rename/visibility/delete.

- [ ] **Step 4: Create the detail route at `src/routes/app/watchlists/$watchlistId.tsx`**

```typescript
export const Route = createFileRoute("/app/watchlists/$watchlistId")({
	component: WatchlistDetailPage,
});
```

Use `Route.useParams()` to get `watchlistId`. Fetch with `trpc.watchlist.get.queryOptions({ watchlistId })`. Render the detail header, filters, and a grid of `WatchlistItemCard` components. Apply client-side filtering/sorting based on URL search params. Reuse the `WatchlistAtmosphere` component.

@skills/router-core/SKILL.md for route params pattern.

- [ ] **Step 5: Verify the detail page renders**

Run: `bun run dev`, click a watchlist reel on the overview page. Should navigate to detail page showing poster grid with actions.

- [ ] **Step 6: Commit**

```bash
git add src/routes/app/watchlists/\$watchlistId.tsx src/components/watchlist/
git commit -m "feat: watchlist detail page with poster grid, filters, actions"
```

---

### Task 9: Add to Watchlist Dropdown & Dialogs

**Files:**
- Create: `src/components/watchlist/add-to-watchlist-dropdown.tsx`
- Create: `src/components/watchlist/create-watchlist-dialog.tsx`
- Create: `src/components/watchlist/invite-member-modal.tsx`

- [ ] **Step 1: Create `add-to-watchlist-dropdown.tsx`**

A reusable dropdown component. Props: `tmdbId: number`, `mediaType: "movie" | "tv"`. Renders:
- A trigger button (Lucide `Bookmark` or `Plus` icon)
- Dropdown content (use Radix `Popover` from UI components):
  - Fetches watchlists via `trpc.watchlist.getForDropdown.queryOptions()`
  - Lists each watchlist as a clickable row (default watchlist first)
  - Clicking a row calls `trpc.watchlist.addItem.mutate()` then shows a toast via Sonner
  - Divider
  - "Create New Watchlist" row at bottom — clicking opens an inline text input
  - Inline input: type a name, press Enter → calls `trpc.watchlist.create.mutate()` then `trpc.watchlist.addItem.mutate()`, shows toast
- Invalidate `watchlist.list` and `watchlist.getForDropdown` queries after mutations

- [ ] **Step 2: Create `create-watchlist-dialog.tsx`**

Used by the "New Watchlist" button on the overview page. A simple dialog/modal with:
- Name input (required, max 100 chars)
- Public/Private toggle (default private)
- Create button
- Calls `trpc.watchlist.create.mutate()`, invalidates `watchlist.list`, shows toast

- [ ] **Step 3: Create `invite-member-modal.tsx`**

Used by the detail page header. A sheet/modal with:
- Debounced username search input (min 2 chars)
- Fetches via `trpc.watchlist.searchUsers.queryOptions({ query })`
- Results list: avatar + username, clickable
- Clicking shows confirmation: "Invite @username to [watchlist name]?"
- Confirm calls `trpc.watchlist.addMember.mutate()`, invalidates `watchlist.get`, shows toast

- [ ] **Step 4: Wire the new-watchlist-button to the create dialog**

In `src/components/watchlist/new-watchlist-button.tsx`, add state to control the `CreateWatchlistDialog` open/close.

- [ ] **Step 5: Verify all dialogs work**

Run: `bun run dev`. Test:
1. Click "New Watchlist" button on overview → dialog opens, create works
2. Click a poster's add-to-watchlist button on search → dropdown shows, adding works
3. Click "Invite" on detail page → modal shows, search works, invite works

- [ ] **Step 6: Commit**

```bash
git add src/components/watchlist/
git commit -m "feat: add-to-watchlist dropdown, create dialog, invite modal"
```

---

### Task 10: Search & Title Page Integration

**Files:**
- Modify: `src/components/search/poster-card.tsx`

- [ ] **Step 1: Add the `AddToWatchlistDropdown` to `PosterCard`**

Import `AddToWatchlistDropdown` and render it in the poster card. Position it as a small icon in the top-left corner of the poster image (opposite the media type badge in the top-right). Show on hover with a fade transition.

```typescript
<div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
	<AddToWatchlistDropdown tmdbId={item.tmdbId} mediaType={item.mediaType} />
</div>
```

This automatically covers: search results, search landing (trending/top-rated/new releases) since they all use `PosterCard`.

- [ ] **Step 2: Wire up the title page arcade button (if title-page branch is merged)**

In the title detail page (`src/routes/app/title.$mediaType.$tmdbId.tsx`), update the "Watchlist" arcade button's `onClick` to open the `AddToWatchlistDropdown`. This may require converting the arcade button to wrap the dropdown or using a controlled popover state.

- [ ] **Step 3: Verify integration**

Run: `bun run dev`. Test:
1. Hover a poster on search → bookmark icon appears, click → dropdown shows
2. On title detail page → "Watchlist" button opens dropdown

- [ ] **Step 4: Commit**

```bash
git add src/components/search/poster-card.tsx
git commit -m "feat: add-to-watchlist button on poster cards and title page"
```

---

### Task 11: Final Polish & Verification

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `bun run build`
Expected: No type errors

- [ ] **Step 3: Manual end-to-end walkthrough**

1. Complete onboarding → default "My Picks" watchlist created with selected titles
2. Navigate to `/app/watchlists` → see the overview with film reel carousel
3. Click "New Watchlist" → create "Horror Movies"
4. Go to search → hover a poster → click add-to-watchlist → add to "Horror Movies"
5. Go back to watchlists overview → see both watchlists with reels scrolling
6. Click into "Horror Movies" → see detail page with poster grid
7. Mark a title as watched → eye icon toggles
8. Invite a friend (if you have a second test account)
9. Delete the "Horror Movies" watchlist → confirms, gone from overview
10. Try deleting "My Picks" → should show error (default watchlist)

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: final polish and adjustments"
```
