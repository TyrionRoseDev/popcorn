# Watched & Review Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log watch events (journal-style, multiple per film), leave optional reviews with star ratings, recommend titles to friends, and receive 7-day review reminders.

**Architecture:** New `watchEvent` and `recommendation` tables in Drizzle schema. New `watched` and `recommendation` tRPC routers. Review modal built with Radix Dialog matching the app's section-board/marquee design language. Cron API endpoint for delayed review reminders.

**Tech Stack:** TanStack Start, tRPC, Drizzle ORM (PostgreSQL), Radix UI Dialog, Tailwind CSS v4, Zod

**Spec:** `docs/superpowers/specs/2026-03-31-watched-review-design.md`

---

## File Structure

**New files:**
- `src/db/schema.ts` — modify: add `watchEvent`, `recommendation` tables + relations
- `src/integrations/trpc/routers/watched.ts` — create: watch event CRUD + review procedures
- `src/integrations/trpc/routers/recommendation.ts` — create: send/accept/decline recommendation procedures
- `src/integrations/trpc/router.ts` — modify: register new routers
- `src/components/watched/review-modal.tsx` — create: main review modal with stars, review, date/time
- `src/components/watched/star-rating.tsx` — create: 5-star rating component with amber glow
- `src/components/watched/recommend-modal.tsx` — create: friend recommendation sub-modal
- `src/components/notifications/notification-item.tsx` — modify: render new notification types
- `src/routes/app/title.$mediaType.$tmdbId.tsx` — modify: wire Watched arcade button
- `src/components/watchlist/watchlist-item-card.tsx` — modify: open review modal on mark watched
- `src/routes/api/cron/review-reminders.ts` — create: cron endpoint for 7-day reminders

---

### Task 1: Database Schema — watchEvent and recommendation tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the `watchEvent` table to schema**

Add after the existing `notification` table definition in `src/db/schema.ts`:

```typescript
export const watchEvent = pgTable(
	"watch_event",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		titleName: text("title_name").notNull(),
		rating: integer("rating"),
		reviewText: text("review_text"),
		reviewPublic: boolean("review_public").default(true).notNull(),
		watchedAt: timestamp("watched_at").notNull(),
		reviewReminderAt: timestamp("review_reminder_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("watch_event_userId_idx").on(table.userId),
		index("watch_event_tmdbId_idx").on(table.userId, table.tmdbId, table.mediaType),
		index("watch_event_reminder_idx").on(table.reviewReminderAt),
	],
);
```

- [ ] **Step 2: Add the `recommendation` table to schema**

Add after the `watchEvent` table:

```typescript
export const recommendation = pgTable(
	"recommendation",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		titleName: text("title_name").notNull(),
		message: text("message"),
		status: text("status").notNull().default("pending"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("recommendation_recipientId_idx").on(table.recipientId),
		index("recommendation_senderId_idx").on(table.senderId),
	],
);
```

- [ ] **Step 3: Add relations for the new tables**

Add after existing relation definitions:

```typescript
export const watchEventRelations = relations(watchEvent, ({ one }) => ({
	user: one(user, {
		fields: [watchEvent.userId],
		references: [user.id],
	}),
}));

export const recommendationRelations = relations(recommendation, ({ one }) => ({
	sender: one(user, {
		fields: [recommendation.senderId],
		references: [user.id],
		relationName: "sentRecommendations",
	}),
	recipient: one(user, {
		fields: [recommendation.recipientId],
		references: [user.id],
		relationName: "receivedRecommendations",
	}),
}));
```

- [ ] **Step 4: Push the schema to the database**

Run: `bun run db:push`

Expected: Schema changes applied successfully, new tables `watch_event` and `recommendation` created.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add watchEvent and recommendation tables"
```

---

### Task 2: Watch Event tRPC Router

**Files:**
- Create: `src/integrations/trpc/routers/watched.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the watched router**

Create `src/integrations/trpc/routers/watched.ts`:

```typescript
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { watchEvent } from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

export const watchedRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string(),
				watchedAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [event] = await db
				.insert(watchEvent)
				.values({
					userId: ctx.userId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					titleName: input.titleName,
					watchedAt: input.watchedAt ? new Date(input.watchedAt) : new Date(),
				})
				.returning({ id: watchEvent.id });

			return event;
		}),

	updateReview: protectedProcedure
		.input(
			z.object({
				watchEventId: z.string(),
				rating: z.number().min(1).max(5).nullable(),
				reviewText: z.string().nullable(),
				watchedAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			await db
				.update(watchEvent)
				.set({
					rating: input.rating,
					reviewText: input.reviewText,
					...(input.watchedAt && { watchedAt: new Date(input.watchedAt) }),
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);
		}),

	setReminder: protectedProcedure
		.input(z.object({ watchEventId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const reminderDate = new Date();
			reminderDate.setDate(reminderDate.getDate() + 7);

			await db
				.update(watchEvent)
				.set({ reviewReminderAt: reminderDate, updatedAt: new Date() })
				.where(
					and(
						eq(watchEvent.id, input.watchEventId),
						eq(watchEvent.userId, ctx.userId),
					),
				);
		}),

	getForTitle: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			return db.query.watchEvent.findMany({
				where: and(
					eq(watchEvent.userId, ctx.userId),
					eq(watchEvent.tmdbId, input.tmdbId),
					eq(watchEvent.mediaType, input.mediaType),
				),
				orderBy: [desc(watchEvent.watchedAt)],
			});
		}),

	getCount: protectedProcedure
		.input(
			z.object({
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
			}),
		)
		.query(async ({ input, ctx }) => {
			const result = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(watchEvent)
				.where(
					and(
						eq(watchEvent.userId, ctx.userId),
						eq(watchEvent.tmdbId, input.tmdbId),
						eq(watchEvent.mediaType, input.mediaType),
					),
				);
			return result[0]?.count ?? 0;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input, ctx }) => {
			return db.query.watchEvent.findFirst({
				where: and(
					eq(watchEvent.id, input.id),
					eq(watchEvent.userId, ctx.userId),
				),
			});
		}),
});
```

- [ ] **Step 2: Register the watched router**

In `src/integrations/trpc/router.ts`, add the import and register:

```typescript
import { watchedRouter } from "./routers/watched";
```

Add to the `createTRPCRouter` call:

```typescript
watched: watchedRouter,
```

- [ ] **Step 3: Verify the server starts**

Run: `bun run dev`

Expected: No errors. The dev server starts and the new router is available.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/watched.ts src/integrations/trpc/router.ts
git commit -m "feat: add watched event tRPC router"
```

---

### Task 3: Star Rating Component

**Files:**
- Create: `src/components/watched/star-rating.tsx`

- [ ] **Step 1: Create the star rating component**

Create `src/components/watched/star-rating.tsx`:

```typescript
import { useState } from "react";

const ratingLabels: Record<number, string> = {
	1: "Bad",
	2: "Meh",
	3: "Decent",
	4: "Great Film",
	5: "Masterpiece",
};

interface StarRatingProps {
	value: number | null;
	onChange: (value: number | null) => void;
}

export function StarRating({ value, onChange }: StarRatingProps) {
	const [hovered, setHovered] = useState<number | null>(null);
	const displayValue = hovered ?? value ?? 0;

	return (
		<div className="text-center">
			<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3">
				How was it?
			</div>
			<div className="flex justify-center gap-1.5 mb-2.5">
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						key={star}
						type="button"
						className="relative w-12 h-12 flex items-center justify-center cursor-pointer"
						onMouseEnter={() => setHovered(star)}
						onMouseLeave={() => setHovered(null)}
						onClick={() => onChange(value === star ? null : star)}
					>
						{star <= displayValue && (
							<div className="absolute inset-0.5 rounded-full bg-neon-amber/15 shadow-[0_0_16px_rgba(255,184,0,0.4)]" />
						)}
						<span
							className={`text-[2rem] leading-none relative z-10 transition-transform duration-100 ${
								star <= displayValue
									? "text-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.7)] scale-115"
									: "text-cream/10"
							}`}
						>
							★
						</span>
					</button>
				))}
			</div>
			<div className="font-display text-sm text-neon-amber/60 tracking-wider">
				{displayValue > 0
					? ratingLabels[displayValue]
					: ""}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/watched/star-rating.tsx
git commit -m "feat: add star rating component"
```

---

### Task 4: Review Modal Component

**Files:**
- Create: `src/components/watched/review-modal.tsx`

- [ ] **Step 1: Create the review modal**

Create `src/components/watched/review-modal.tsx`:

```typescript
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogPortal,
} from "#/components/ui/dialog";
import { StarRating } from "./star-rating";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";

interface ReviewModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	watchEventId: string | null;
	titleName: string;
	year?: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	defaultWatchedAt?: Date;
	isReminder?: boolean;
	onRecommendClick?: () => void;
}

export function ReviewModal({
	open,
	onOpenChange,
	watchEventId,
	titleName,
	year,
	tmdbId,
	mediaType,
	defaultWatchedAt,
	isReminder = false,
	onRecommendClick,
}: ReviewModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [rating, setRating] = useState<number | null>(null);
	const [reviewText, setReviewText] = useState("");
	const [watchedAt, setWatchedAt] = useState(
		defaultWatchedAt ?? new Date(),
	);

	const updateReview = useMutation(
		trpc.watched.updateReview.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watched.getForTitle.queryFilter({ tmdbId, mediaType }),
				);
				queryClient.invalidateQueries(
					trpc.watched.getCount.queryFilter({ tmdbId, mediaType }),
				);
				handleClose();
			},
		}),
	);

	const setReminder = useMutation(
		trpc.watched.setReminder.mutationOptions({
			onSuccess: () => handleClose(),
		}),
	);

	function handleClose() {
		setRating(null);
		setReviewText("");
		onOpenChange(false);
	}

	function handleSave() {
		if (!watchEventId) return;
		updateReview.mutate({
			watchEventId,
			rating,
			reviewText: reviewText.trim() || null,
			watchedAt: watchedAt.toISOString(),
		});
	}

	function handleSkip() {
		handleClose();
	}

	function handleRemindLater() {
		if (!watchEventId) return;
		setReminder.mutate({ watchEventId });
	}

	const dateStr = watchedAt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const timeStr = watchedAt.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay />
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="w-full max-w-[360px] flex flex-col items-center">
						{/* Marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-amber/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,184,0,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={i}
										className="w-1.5 h-1.5 rounded-full bg-neon-amber shadow-[0_0_4px_1px_rgba(255,184,0,0.6)] animate-[chase_1.2s_infinite]"
										style={{ animationDelay: `${i * 0.15}s` }}
									/>
								))}
							</div>
							<div className="font-display text-2xl text-cream tracking-wide">
								Watched
							</div>
							<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-amber/55 mt-0.5">
								{titleName} {year ? `· ${year}` : ""}
							</div>
						</div>

						{/* Modal card */}
						<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
							{/* Top edge glow */}
							<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />
							{/* Inner light wash */}
							<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

							<div className="p-5 flex flex-col gap-5 relative">
								{/* Stars */}
								<StarRating value={rating} onChange={setRating} />

								<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

								{/* Review text */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Your Review
									</div>
									<textarea
										value={reviewText}
										onChange={(e) => setReviewText(e.target.value)}
										placeholder="Share your thoughts…"
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-3 min-h-16 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-cyan/20 resize-none transition-colors duration-200"
									/>
								</div>

								{/* Date & Time */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Watched On
									</div>
									<div className="flex items-center gap-4 bg-black/25 border border-cream/[0.06] rounded-md px-3.5 py-2.5 cursor-pointer hover:border-neon-cyan/20 transition-colors duration-200">
										<span className="text-base opacity-40">📅</span>
										<div className="flex-1 flex flex-col gap-px">
											<div className="font-mono-retro text-[9px] tracking-[2px] uppercase text-cream/25">
												Date & Time
											</div>
											<div className="font-mono-retro text-sm text-cream tracking-wide">
												{dateStr} · {timeStr}
											</div>
										</div>
										<input
											type="datetime-local"
											value={watchedAt.toISOString().slice(0, 16)}
											onChange={(e) =>
												setWatchedAt(new Date(e.target.value))
											}
											className="absolute opacity-0 inset-0 cursor-pointer"
											style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
										/>
										<span className="font-mono-retro text-[9px] tracking-[1px] text-neon-cyan/45">
											change
										</span>
									</div>
								</div>

								<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

								{/* Recommend to friend */}
								{!isReminder && (
									<button
										type="button"
										onClick={onRecommendClick}
										className="flex items-center gap-3 px-3.5 py-2.5 bg-neon-pink/[0.04] border border-neon-pink/15 rounded-md cursor-pointer hover:border-neon-pink/30 hover:shadow-[0_0_16px_rgba(255,45,120,0.08)] transition-all duration-200"
									>
										<div className="w-7 h-7 rounded-full bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center text-sm shrink-0">
											📽️
										</div>
										<span className="flex-1 text-left text-sm font-semibold text-neon-pink/75">
											Recommend to a friend
										</span>
										<span className="text-base text-neon-pink/30">›</span>
									</button>
								)}

								{/* Save button */}
								<button
									type="button"
									onClick={handleSave}
									disabled={updateReview.isPending}
									className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50"
								>
									Save & Done
								</button>

								{/* Secondary actions */}
								<div className="flex justify-center items-center gap-6">
									<button
										type="button"
										onClick={handleSkip}
										className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/25 hover:text-cream/50 transition-colors duration-200 py-1.5"
									>
										skip
									</button>
									{!isReminder && (
										<>
											<span className="text-cream/10 text-xs">·</span>
											<button
												type="button"
												onClick={handleRemindLater}
												disabled={setReminder.isPending}
												className="font-mono-retro text-[10px] tracking-[2px] uppercase text-neon-amber/40 hover:text-neon-amber/70 transition-colors duration-200 py-1.5 disabled:opacity-50"
											>
												remind me later
											</button>
										</>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogPortal>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run dev`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/review-modal.tsx
git commit -m "feat: add review modal component"
```

---

### Task 5: Wire Up Title Page Watched Button

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx`

- [ ] **Step 1: Add state and mutation imports**

Add these imports to the title page:

```typescript
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { ReviewModal } from "#/components/watched/review-modal";
```

- [ ] **Step 2: Add watch event state and mutation inside the component**

Inside the route component function, add:

```typescript
const trpc = useTRPC();
const queryClient = useQueryClient();
const [reviewModalOpen, setReviewModalOpen] = useState(false);
const [watchEventId, setWatchEventId] = useState<string | null>(null);

const createWatchEvent = useMutation(
  trpc.watched.create.mutationOptions({
    onSuccess: (data) => {
      setWatchEventId(data.id);
      setReviewModalOpen(true);
    },
  }),
);
```

- [ ] **Step 3: Add onClick to the Watched arcade button**

Change the Watched `ArcadeButton` to:

```typescript
<ArcadeButton
  icon={Check}
  label="Watched"
  color="cyan"
  onClick={() =>
    createWatchEvent.mutate({
      tmdbId: Number(tmdbId),
      mediaType: mediaType as "movie" | "tv",
      titleName: details.title ?? details.name ?? "",
    })
  }
/>
```

Note: `details` is the data from the `trpc.title.details` query. Check the existing code for the exact variable name — it may be `data` or destructured. Use the same variable that provides `title`/`name` for the poster/header.

- [ ] **Step 4: Add the ReviewModal to the JSX**

Add before the closing fragment or wrapper div:

```typescript
<ReviewModal
  open={reviewModalOpen}
  onOpenChange={setReviewModalOpen}
  watchEventId={watchEventId}
  titleName={details.title ?? details.name ?? ""}
  year={details.release_date?.slice(0, 4) ?? details.first_air_date?.slice(0, 4)}
  tmdbId={Number(tmdbId)}
  mediaType={mediaType as "movie" | "tv"}
/>
```

<!-- TODO: Wire in achievement checks from the achievements branch after merge -->

- [ ] **Step 5: Test manually**

Run: `bun run dev`

1. Navigate to a title page
2. Click the "Watched" arcade button
3. The review modal should open with the marquee header showing the film name
4. Test: tap stars, type a review, click Save & Done
5. Test: click Skip (modal closes)
6. Test: click Remind Me Later (modal closes)

- [ ] **Step 6: Commit**

```bash
git add src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: wire watched button to create watch event and open review modal"
```

---

### Task 6: Recommend Modal and Friend Search

**Files:**
- Create: `src/components/watched/recommend-modal.tsx`

- [ ] **Step 1: Create the recommend modal**

Create `src/components/watched/recommend-modal.tsx`:

```typescript
import { useState } from "react";
import { X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogPortal,
} from "#/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
}

export function RecommendModal({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
}: RecommendModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<
		Array<{ id: string; username: string | null }>
	>([]);
	const [message, setMessage] = useState("");

	const { data: friends } = useQuery(trpc.friend.list.queryOptions());

	const sendRecommendation = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				setSearch("");
				setSelected([]);
				setMessage("");
				onOpenChange(false);
			},
		}),
	);

	const filtered = (friends ?? []).filter((f) => {
		if (selected.some((s) => s.id === f.id)) return false;
		if (!search) return true;
		const q = search.toLowerCase().replace("@", "");
		return f.username?.toLowerCase().includes(q);
	});

	function toggleFriend(friend: { id: string; username: string | null }) {
		setSelected((prev) =>
			prev.some((s) => s.id === friend.id)
				? prev.filter((s) => s.id !== friend.id)
				: [...prev, friend],
		);
	}

	function removeFriend(id: string) {
		setSelected((prev) => prev.filter((s) => s.id !== id));
	}

	function handleSend() {
		if (selected.length === 0) return;
		sendRecommendation.mutate({
			recipientIds: selected.map((s) => s.id),
			tmdbId,
			mediaType,
			titleName,
			message: message.trim() || undefined,
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay />
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="w-full max-w-[360px] flex flex-col items-center">
						{/* Pink marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-pink/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,45,120,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={i}
										className="w-1.5 h-1.5 rounded-full bg-neon-pink shadow-[0_0_4px_1px_rgba(255,45,120,0.6)] animate-[chase_1.2s_infinite]"
										style={{ animationDelay: `${i * 0.15}s` }}
									/>
								))}
							</div>
							<div className="font-display text-xl text-cream tracking-wide">
								Recommend
							</div>
							<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-pink/50 mt-0.5">
								{titleName}
							</div>
						</div>

						{/* Card body */}
						<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
							<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-pink/70 to-transparent shadow-[0_0_10px_rgba(255,45,120,0.4)]" />

							<div className="p-5 flex flex-col gap-4 relative">
								{/* Close */}
								<div className="flex justify-end -mb-2">
									<button
										type="button"
										onClick={() => onOpenChange(false)}
										className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/30 hover:text-cream/60 transition-colors duration-200"
									>
										close ✕
									</button>
								</div>

								{/* Search */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Send To
									</div>
									<input
										type="text"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder="@username..."
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream placeholder:text-cream/30 focus:outline-none focus:border-neon-pink/25 transition-colors duration-200"
									/>
								</div>

								{/* Autocomplete results */}
								{filtered.length > 0 && (
									<div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
										{filtered.slice(0, 5).map((friend) => {
											const isPicked = selected.some(
												(s) => s.id === friend.id,
											);
											return (
												<button
													key={friend.id}
													type="button"
													onClick={() => toggleFriend(friend)}
													className={`flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors duration-200 text-left ${
														isPicked
															? "bg-neon-pink/[0.06] border-neon-pink/20"
															: "bg-black/20 border-cream/[0.05] hover:border-cream/10"
													}`}
												>
													<div
														className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border ${
															isPicked
																? "border-neon-pink/30 bg-neon-pink/10 text-neon-pink"
																: "border-cream/10 bg-cream/[0.06] text-cream/40"
														}`}
													>
														{friend.username
															?.slice(0, 2)
															.toUpperCase() ?? "?"}
													</div>
													<span className="flex-1 text-sm text-cream/70">
														@{friend.username}
													</span>
													{isPicked && (
														<span className="text-sm text-neon-pink">
															✓
														</span>
													)}
												</button>
											);
										})}
									</div>
								)}

								{/* Selected chips */}
								{selected.length > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Selected
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{selected.map((s) => (
												<div
													key={s.id}
													className="flex items-center gap-1 px-2.5 py-1 bg-neon-pink/[0.08] border border-neon-pink/25 rounded-full font-mono-retro text-xs text-neon-pink"
												>
													@{s.username}
													<button
														type="button"
														onClick={() => removeFriend(s.id)}
														className="opacity-40 hover:opacity-80 transition-opacity"
													>
														<X className="w-3 h-3" />
													</button>
												</div>
											))}
										</div>
									</div>
								)}

								<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

								{/* Message */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Message (optional)
									</div>
									<textarea
										value={message}
										onChange={(e) => setMessage(e.target.value)}
										placeholder="You have to see this one…"
										className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 min-h-14 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-pink/20 resize-none transition-colors duration-200"
									/>
								</div>

								{/* Send button */}
								<button
									type="button"
									onClick={handleSend}
									disabled={
										selected.length === 0 ||
										sendRecommendation.isPending
									}
									className="w-full py-3 px-6 bg-neon-pink/[0.08] border-2 border-neon-pink/35 rounded-lg font-display text-base tracking-widest text-neon-pink text-center shadow-[0_4px_0_rgba(255,45,120,0.12),0_0_16px_rgba(255,45,120,0.08)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(255,45,120,0.12),0_0_24px_rgba(255,45,120,0.12)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Send Recommendation
								</button>
							</div>
						</div>
					</div>
				</div>
			</DialogPortal>
		</Dialog>
	);
}
```

- [ ] **Step 2: Wire the recommend modal into the review modal**

In `src/components/watched/review-modal.tsx`, add state and the modal:

Add import at the top:
```typescript
import { RecommendModal } from "./recommend-modal";
```

Add state inside the component:
```typescript
const [recommendOpen, setRecommendOpen] = useState(false);
```

Change the `onRecommendClick` on the recommend button to:
```typescript
onClick={() => setRecommendOpen(true)}
```

Remove the `onRecommendClick` prop from the `ReviewModalProps` interface and the button. Replace the recommend button's `onClick`:

```typescript
<button
  type="button"
  onClick={() => setRecommendOpen(true)}
  ...
```

Add the `RecommendModal` at the end of the component JSX (after the closing `</Dialog>`):

```typescript
<RecommendModal
  open={recommendOpen}
  onOpenChange={setRecommendOpen}
  tmdbId={tmdbId}
  mediaType={mediaType}
  titleName={titleName}
/>
```

Update the component's return to wrap both in a fragment: `<>...</>`.

Also remove the `onRecommendClick` prop from the `ReviewModalProps` interface and from the title page where `ReviewModal` is used.

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/recommend-modal.tsx src/components/watched/review-modal.tsx src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: add recommend modal with friend search"
```

---

### Task 7: Recommendation tRPC Router

**Files:**
- Create: `src/integrations/trpc/routers/recommendation.ts`
- Modify: `src/integrations/trpc/router.ts`
- Modify: `src/integrations/trpc/routers/notification.ts`

- [ ] **Step 1: Add new notification types**

In `src/integrations/trpc/routers/notification.ts`, extend the `NotificationType` type to include:

```typescript
| "recommendation_received"
| "recommendation_watched"
| "review_reminder"
```

- [ ] **Step 2: Create the recommendation router**

Create `src/integrations/trpc/routers/recommendation.ts`:

```typescript
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import {
	recommendation,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";
import { createNotification } from "./notification";

export const recommendationRouter = createTRPCRouter({
	send: protectedProcedure
		.input(
			z.object({
				recipientIds: z.array(z.string()).min(1),
				tmdbId: z.number(),
				mediaType: z.enum(["movie", "tv"]),
				titleName: z.string(),
				message: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			for (const recipientId of input.recipientIds) {
				await db.insert(recommendation).values({
					senderId: ctx.userId,
					recipientId,
					tmdbId: input.tmdbId,
					mediaType: input.mediaType,
					titleName: input.titleName,
					message: input.message ?? null,
				});

				await createNotification({
					recipientId,
					actorId: ctx.userId,
					type: "recommendation_received",
					data: {
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						titleName: input.titleName,
						message: input.message ?? null,
					},
				});
			}
		}),

	accept: protectedProcedure
		.input(z.object({ recommendationId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const rec = await db.query.recommendation.findFirst({
				where: and(
					eq(recommendation.id, input.recommendationId),
					eq(recommendation.recipientId, ctx.userId),
				),
			});

			if (!rec || rec.status !== "pending") return;

			await db
				.update(recommendation)
				.set({ status: "accepted" })
				.where(eq(recommendation.id, input.recommendationId));

			// Find or create the user's Recommendations watchlist
			let recWatchlist = await db.query.watchlist.findFirst({
				where: and(
					eq(watchlist.ownerId, ctx.userId),
					eq(watchlist.type, "recommendations"),
				),
			});

			if (!recWatchlist) {
				const [created] = await db
					.insert(watchlist)
					.values({
						name: "Recommendations",
						ownerId: ctx.userId,
						isPublic: false,
						type: "recommendations",
					})
					.returning({ id: watchlist.id });
				recWatchlist = { ...created, name: "Recommendations", ownerId: ctx.userId, isPublic: false, type: "recommendations" } as typeof recWatchlist;

				await db.insert(watchlistMember).values({
					watchlistId: created.id,
					userId: ctx.userId,
					role: "owner",
				});
			}

			// Add the title to the Recommendations watchlist (ignore if already there)
			const existing = await db.query.watchlistItem.findFirst({
				where: and(
					eq(watchlistItem.watchlistId, recWatchlist!.id),
					eq(watchlistItem.tmdbId, rec.tmdbId),
					eq(watchlistItem.mediaType, rec.mediaType),
				),
			});

			if (!existing) {
				await db.insert(watchlistItem).values({
					watchlistId: recWatchlist!.id,
					tmdbId: rec.tmdbId,
					mediaType: rec.mediaType,
					addedBy: ctx.userId,
				});
			}
		}),

	decline: protectedProcedure
		.input(z.object({ recommendationId: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db
				.update(recommendation)
				.set({ status: "declined" })
				.where(
					and(
						eq(recommendation.id, input.recommendationId),
						eq(recommendation.recipientId, ctx.userId),
					),
				);
		}),
});
```

- [ ] **Step 3: Register the recommendation router**

In `src/integrations/trpc/router.ts`, add the import and register:

```typescript
import { recommendationRouter } from "./routers/recommendation";
```

Add to `createTRPCRouter`:
```typescript
recommendation: recommendationRouter,
```

- [ ] **Step 4: Add "recommendations" to watchlist type**

In `src/db/schema.ts`, the `watchlist.type` field currently allows `'default' | 'shuffle' | 'custom'`. This is a text column with no enum constraint, so `"recommendations"` will work without schema changes. No migration needed.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/recommendation.ts src/integrations/trpc/routers/notification.ts src/integrations/trpc/router.ts
git commit -m "feat: add recommendation router with send, accept, decline"
```

---

### Task 8: Update Notification Item Rendering

**Files:**
- Modify: `src/components/notifications/notification-item.tsx`

- [ ] **Step 1: Add new notification type handling**

In the `getNotificationMessage` function in `src/components/notifications/notification-item.tsx`, add cases for the new types:

```typescript
case "recommendation_received": {
  const d = data as { titleName: string; tmdbId: number; mediaType: string; message: string | null };
  return {
    message: `recommended ${d.titleName} to you${d.message ? `: "${d.message}"` : ""}`,
    link: `/app/title/${d.mediaType}/${d.tmdbId}`,
  };
}
case "recommendation_watched": {
  const d = data as { titleName: string; tmdbId: number; mediaType: string };
  return {
    message: `watched ${d.titleName} that you recommended`,
    link: `/app/title/${d.mediaType}/${d.tmdbId}`,
  };
}
case "review_reminder": {
  const d = data as { titleName: string; tmdbId: number; mediaType: string; watchEventId: string };
  return {
    message: `How was ${d.titleName}? Leave a quick review`,
    link: `/app/title/${d.mediaType}/${d.tmdbId}?reviewReminder=${d.watchEventId}`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notifications/notification-item.tsx
git commit -m "feat: render recommendation and reminder notification types"
```

---

### Task 9: Wire Watchlist Item Card to Open Review Modal

**Files:**
- Modify: `src/components/watchlist/watchlist-item-card.tsx`

- [ ] **Step 1: Add review modal state and watch event creation**

Import the review modal and add state:

```typescript
import { ReviewModal } from "#/components/watched/review-modal";
import { useTRPC } from "#/integrations/trpc/react";
import { useState } from "react";
```

Inside the component, add:

```typescript
const trpc = useTRPC();
const [reviewModalOpen, setReviewModalOpen] = useState(false);
const [watchEventId, setWatchEventId] = useState<string | null>(null);

const createWatchEvent = useMutation(
  trpc.watched.create.mutationOptions({
    onSuccess: (data) => {
      setWatchEventId(data.id);
      setReviewModalOpen(true);
    },
  }),
);
```

- [ ] **Step 2: Modify the markWatched onSuccess to also create a watch event**

Update the existing `markWatched` mutation's `onSuccess` to also trigger a watch event when marking as watched (not unmarking):

```typescript
const markWatched = useMutation(
  trpc.watchlist.markWatched.mutationOptions({
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(
        trpc.watchlist.get.queryFilter({ watchlistId }),
      );
      // If marking as watched (not unmarking), create a watch event
      if (variables.watched) {
        createWatchEvent.mutate({
          tmdbId: variables.tmdbId,
          mediaType: variables.mediaType as "movie" | "tv",
          titleName: variables.titleName ?? "",
        });
      }
    },
  }),
);
```

Note: Ensure the `markWatched.mutate()` call passes `titleName` in the existing code. If it doesn't currently pass `titleName`, add it from the card's data.

- [ ] **Step 3: Add ReviewModal to the JSX**

Add at the end of the component JSX:

```typescript
<ReviewModal
  open={reviewModalOpen}
  onOpenChange={setReviewModalOpen}
  watchEventId={watchEventId}
  titleName={item.titleName ?? ""}
  tmdbId={item.tmdbId}
  mediaType={item.mediaType as "movie" | "tv"}
/>
```

Note: The `item` object needs a `titleName` property. Check the existing type — if it doesn't have `titleName`, you may need to pass it from the parent or fetch it. The watchlist items currently store `tmdbId` and `mediaType` but may not store the title name. If needed, add a `titleName` prop to `WatchlistItemCardProps`.

- [ ] **Step 4: Commit**

```bash
git add src/components/watchlist/watchlist-item-card.tsx
git commit -m "feat: open review modal when marking watchlist item as watched"
```

---

### Task 10: Cron Endpoint for Review Reminders

**Files:**
- Create: `src/routes/api/cron/review-reminders.ts`
- Modify: `src/integrations/trpc/routers/notification.ts`

- [ ] **Step 1: Create the cron API route**

Create `src/routes/api/cron/review-reminders.ts`:

```typescript
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { and, isNotNull, lte } from "drizzle-orm";
import { db } from "#/db";
import { watchEvent } from "#/db/schema";
import { createNotification } from "#/integrations/trpc/routers/notification";

export const APIRoute = createAPIFileRoute("/api/cron/review-reminders")({
	GET: async ({ request }) => {
		// Optional: verify a cron secret header
		// const authHeader = request.headers.get("authorization");
		// if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
		//   return new Response("Unauthorized", { status: 401 });
		// }

		const now = new Date();

		const dueReminders = await db.query.watchEvent.findMany({
			where: and(
				isNotNull(watchEvent.reviewReminderAt),
				lte(watchEvent.reviewReminderAt, now),
			),
		});

		let sent = 0;
		for (const event of dueReminders) {
			await createNotification({
				recipientId: event.userId,
				actorId: event.userId,
				type: "review_reminder",
				data: {
					titleName: event.titleName,
					tmdbId: event.tmdbId,
					mediaType: event.mediaType,
					watchEventId: event.id,
				},
			});

			await db
				.update(watchEvent)
				.set({ reviewReminderAt: null, updatedAt: new Date() })
				.where(lte(watchEvent.id, event.id));

			sent++;
		}

		return Response.json({ ok: true, sent });
	},
});
```

- [ ] **Step 2: Ensure `createNotification` is exported from notification.ts**

In `src/integrations/trpc/routers/notification.ts`, verify that `createNotification` is exported (it should already be — check the existing code). If it's not exported, add the `export` keyword.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/cron/review-reminders.ts src/integrations/trpc/routers/notification.ts
git commit -m "feat: add cron endpoint for 7-day review reminders"
```

---

### Task 11: Reminder Review Flow from Notification

**Files:**
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx`

- [ ] **Step 1: Handle the `reviewReminder` query param on the title page**

When a user clicks "Leave Review" from a reminder notification, they're navigated to `/app/title/:mediaType/:tmdbId?reviewReminder=<watchEventId>`. The title page needs to detect this and open the review modal in reminder mode.

Add to the title page component:

```typescript
import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
```

Inside the component:

```typescript
const search = useSearch({ from: "/app/title/$mediaType/$tmdbId" });
const reviewReminderId = (search as Record<string, string>).reviewReminder;

const { data: reminderEvent } = useQuery(
  trpc.watched.getById.queryOptions(
    { id: reviewReminderId! },
    { enabled: !!reviewReminderId },
  ),
);

useEffect(() => {
  if (reminderEvent && reviewReminderId) {
    setWatchEventId(reminderEvent.id);
    setReviewModalOpen(true);
  }
}, [reminderEvent, reviewReminderId]);
```

Update the `ReviewModal` to pass reminder-specific props when opened from a reminder:

```typescript
<ReviewModal
  open={reviewModalOpen}
  onOpenChange={setReviewModalOpen}
  watchEventId={watchEventId}
  titleName={details.title ?? details.name ?? ""}
  year={details.release_date?.slice(0, 4) ?? details.first_air_date?.slice(0, 4)}
  tmdbId={Number(tmdbId)}
  mediaType={mediaType as "movie" | "tv"}
  isReminder={!!reviewReminderId}
  defaultWatchedAt={reminderEvent?.watchedAt ? new Date(reminderEvent.watchedAt) : undefined}
/>
```

- [ ] **Step 2: Add search params validation to the route**

In the route definition, add search params:

```typescript
export const Route = createFileRoute("/app/title/$mediaType/$tmdbId")({
  validateSearch: (search: Record<string, unknown>) => ({
    reviewReminder: (search.reviewReminder as string) || undefined,
  }),
  // ... existing loader, component, etc.
});
```

Note: Check the existing route definition for the exact pattern used. TanStack Router may use `validateSearch` or `search` schema — follow the existing convention.

- [ ] **Step 3: Test the full reminder flow**

1. Mark a film as watched, click "Remind Me Later"
2. Manually trigger the cron: `curl http://localhost:3000/api/cron/review-reminders`
3. Check the notification bell — the reminder should appear
4. Click "Leave Review" on the notification
5. The title page should open with the review modal in reminder mode
6. Verify the original date/time is pre-filled
7. Verify there's no "Remind Me Later" option in reminder mode

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/title.\$mediaType.\$tmdbId.tsx
git commit -m "feat: handle review reminder deep link on title page"
```

---

### Task 12: Recommendation-Watched Notification

**Files:**
- Modify: `src/integrations/trpc/routers/watched.ts`

- [ ] **Step 1: Notify recommenders when a user reviews a recommended title**

In the `updateReview` mutation in `src/integrations/trpc/routers/watched.ts`, after the review is saved, check if this title was recommended to the user and if the review is public. If so, notify the recommender.

Add import:
```typescript
import { recommendation } from "#/db/schema";
import { createNotification } from "./notification";
```

At the end of the `updateReview` mutation, after the `db.update()` call, add:

```typescript
// Notify recommenders if this is a public review
if (input.rating || input.reviewText) {
  const event = await db.query.watchEvent.findFirst({
    where: and(
      eq(watchEvent.id, input.watchEventId),
      eq(watchEvent.userId, ctx.userId),
    ),
  });

  if (event && event.reviewPublic) {
    const recs = await db.query.recommendation.findMany({
      where: and(
        eq(recommendation.recipientId, ctx.userId),
        eq(recommendation.tmdbId, event.tmdbId),
        eq(recommendation.mediaType, event.mediaType),
        eq(recommendation.status, "accepted"),
      ),
    });

    for (const rec of recs) {
      await createNotification({
        recipientId: rec.senderId,
        actorId: ctx.userId,
        type: "recommendation_watched",
        data: {
          titleName: event.titleName,
          tmdbId: event.tmdbId,
          mediaType: event.mediaType,
        },
      });
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/trpc/routers/watched.ts
git commit -m "feat: notify recommenders when user reviews a recommended title"
```
