# Profile Activity Cap + Feed User Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap profile tab content to a fixed height with a "See more" link that navigates to the feed page filtered to that user's activity.

**Architecture:** Two changes — (1) wrap each profile tab's content in a height-capped container with a fade overlay and "See more" link, (2) add a `userId` search param to the feed route so it can show a single user's activity with a personalized header.

**Tech Stack:** TanStack Router (search params), tRPC + React Query, Tailwind CSS, Framer Motion

---

### Task 1: Add `userId` search param to feed route

**Files:**
- Modify: `src/routes/app/feed.tsx`

- [ ] **Step 1: Add search param validation and user query**

Add `validateSearch` to the route, import `useQuery`, `z`, and `ArrowLeft`. Add a `useQuery` to fetch the target user's profile when `userId` is present.

In `src/routes/app/feed.tsx`, update the route definition and the top of `FeedPage`:

```tsx
// Add to imports at top of file:
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Film, Loader2 } from "lucide-react";
import { z } from "zod";

// Replace the route definition:
const feedSearchSchema = z.object({
	userId: z.string().optional(),
});

export const Route = createFileRoute("/app/feed")({
	component: FeedPage,
	validateSearch: feedSearchSchema,
});
```

Then inside `FeedPage`, after the existing `const trpc = useTRPC();` line, add the search param reading and user profile query:

```tsx
function FeedPage() {
	const trpc = useTRPC();
	const { userId: filterUserId } = Route.useSearch();
	const navigate = useNavigate();
	const [filter, setFilter] = useState<"all" | "mine">("all");

	// Fetch target user's username when filtering by userId
	const { data: filterUser } = useQuery(
		trpc.friend.profile.queryOptions(
			{ userId: filterUserId! },
			{ enabled: !!filterUserId },
		),
	);

	// ... rest of existing state (editModal, routeContext, etc.)
```

- [ ] **Step 2: Update the getFeed query to pass userId**

Replace the existing `useInfiniteQuery` call to conditionally pass `userId`:

```tsx
const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
	useInfiniteQuery(
		trpc.watchEvent.getFeed.infiniteQueryOptions(
			{ filter: filterUserId ? "all" : filter, limit: 20, userId: filterUserId },
			{ getNextPageParam: (lastPage) => lastPage.nextCursor },
		),
	);
```

- [ ] **Step 3: Update the header and filter UI**

Replace the header and filter section (the `<CarSilhouettes />`, `<NowShowingHeader>`, and filter `<div>`) with conditional rendering:

```tsx
{/* Car silhouettes + Marquee header */}
<CarSilhouettes />
<div className="mt-4">
	<NowShowingHeader
		title={filterUser ? `${filterUser.username}'s Feed` : "Feed"}
	/>
</div>

{/* Filter / Back link */}
<div className="flex justify-end mt-7 mb-6">
	{filterUserId ? (
		<button
			type="button"
			onClick={() => navigate({ to: "/app/feed", search: {} })}
			className="flex items-center gap-1.5 font-mono-retro text-xs tracking-wide text-neon-cyan hover:text-neon-cyan/80 transition-colors"
			style={{ textShadow: "0 0 6px rgba(0,229,255,0.2)" }}
		>
			<ArrowLeft className="h-3.5 w-3.5" />
			Back to full feed
		</button>
	) : (
		<select
			value={filter}
			onChange={(e) => setFilter(e.target.value as "all" | "mine")}
			className="font-mono-retro text-xs tracking-wide text-neon-cyan bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.2)] rounded-md px-4 py-2 focus:outline-none focus:border-[rgba(0,229,255,0.35)] [color-scheme:dark] cursor-pointer"
			style={{
				textShadow: "0 0 6px rgba(0,229,255,0.2)",
				boxShadow: "0 0 12px rgba(0,229,255,0.05)",
			}}
		>
			<option value="all">Everyone</option>
			<option value="mine">Just Me</option>
		</select>
	)}
</div>
```

- [ ] **Step 4: Verify in browser**

Run: `bun dev`

1. Navigate to `/app/feed` — should work exactly as before (title "Feed", filter dropdown visible)
2. Navigate to `/app/feed?userId=<some-user-id>` — should show "{username}'s Feed" as title, "Back to full feed" link instead of dropdown, only that user's activity
3. Click "Back to full feed" — should return to normal feed

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "feat: add userId search param to feed route for per-user filtering"
```

---

### Task 2: Cap profile tab content height with fade and "See more"

**Files:**
- Modify: `src/routes/app/profile.$userId.tsx`

- [ ] **Step 1: Update the tab content wrapper in FriendExpandedSections**

In `src/routes/app/profile.$userId.tsx`, replace the `{/* Tab content */}` section (lines 1244-1264) inside `FriendExpandedSections`. Wrap the `motion.div` content in a height-capped container with a fade overlay and "See more" link:

```tsx
{/* Tab content */}
<AnimatePresence mode="wait">
	<motion.div
		key={activeTab}
		initial={{ opacity: 0, y: 6 }}
		animate={{ opacity: 1, y: 0 }}
		exit={{ opacity: 0, y: -6 }}
		transition={{ duration: 0.2 }}
		className="pt-4"
	>
		{/* Height-capped container */}
		<div className="relative">
			<div className="max-h-[420px] overflow-hidden">
				{activeTab === "activity" && (
					<ActivityTab userId={profile.id} isOwn={isSelf} />
				)}
				{activeTab === "journal" && (
					<DiaryTab userId={profile.id} isOwn={isSelf} />
				)}
				{activeTab === "watchlists" && (
					<WatchlistsTab watchlists={profile.publicWatchlists} />
				)}
			</div>
			{/* Fade overlay */}
			<div
				className="pointer-events-none absolute bottom-0 left-0 right-0 h-20"
				style={{
					background:
						"linear-gradient(to top, rgb(10,10,30) 0%, transparent 100%)",
				}}
			/>
		</div>
		{/* See more link */}
		<div className="flex justify-center pt-2 pb-1">
			<Link
				to="/app/feed"
				search={{ userId: profile.id }}
				className="font-mono-retro text-[10px] uppercase tracking-[2px] text-cream/40 hover:text-cream/70 transition-colors no-underline"
				style={{ textShadow: "0 0 6px rgba(255,255,240,0.08)" }}
			>
				See more &rarr;
			</Link>
		</div>
	</motion.div>
</AnimatePresence>
```

- [ ] **Step 2: Simplify ActivityTab — remove infinite scroll and edit modal**

Since the profile activity tab is now capped and "See more" sends users to the feed, remove the "Load more" button and `ReviewModal` from `ActivityTab`. Replace the entire `ActivityTab` function (lines 1419-1558) with:

```tsx
function ActivityTab({ userId, isOwn }: { userId: string; isOwn: boolean }) {
	const trpc = useTRPC();

	const { data, isLoading } = useInfiniteQuery(
		trpc.watchEvent.getFeed.infiniteQueryOptions(
			{ userId, limit: 10 },
			{ getNextPageParam: (lastPage) => lastPage.nextCursor },
		),
	);

	if (isLoading) {
		return (
			<div className="flex justify-center py-8">
				<Loader2 className="h-4 w-4 animate-spin text-cream/30" />
			</div>
		);
	}

	const items = data?.pages.flatMap((p) => p.items) ?? [];

	if (items.length === 0) {
		return (
			<div className="flex flex-col items-center py-8 text-center">
				<Film className="mb-2 h-6 w-6 text-neon-pink/20" />
				<p className="text-xs text-cream/30">No activity yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{items.map((item) => {
				if (item.type === "watch_event") {
					const event = item.data;
					return (
						<WatchEventCard
							key={`we-${event.id}`}
							event={event}
							showTitle={{
								name: event.title ?? `Title #${event.tmdbId}`,
							}}
							isOwn={isOwn}
						/>
					);
				}

				if (item.type === "watchlist_created") {
					const wl = item.data;
					return (
						<Link
							key={`wl-${wl.id}`}
							to="/app/watchlists/$watchlistId"
							params={{ watchlistId: wl.id }}
							search={{ sort: "date-added", type: "all" }}
							className="group flex items-center gap-3 rounded-lg border border-neon-pink/15 px-3 py-2.5 no-underline transition-all hover:border-neon-pink/25 hover:bg-neon-pink/[0.03]"
						>
							<List className="h-4 w-4 shrink-0 text-neon-pink/40" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm text-cream/70 transition-colors group-hover:text-cream/90">
									Created{" "}
									<span className="font-semibold text-neon-pink/80">
										{wl.name}
									</span>
								</p>
								<p className="mt-0.5 font-mono-retro text-[9px] text-cream/25">
									{wl.items.length}{" "}
									{wl.items.length === 1 ? "title" : "titles"}
								</p>
							</div>
							<span className="font-mono-retro text-[9px] text-cream/20">
								{formatActivityTime(wl.createdAt)}
							</span>
						</Link>
					);
				}

				if (item.type === "journal_entry") {
					return (
						<FeedJournalCard key={`je-${item.data.id}`} entry={item.data} />
					);
				}

				return null;
			})}
		</div>
	);
}
```

Note: `onEdit` prop removed from `WatchEventCard` — editing happens on the feed page now. The `editModal` state and `ReviewModal` are no longer needed in this component. The `useState` import for this can stay since other components in the file use it.

- [ ] **Step 3: Verify in browser**

Run: `bun dev`

1. Navigate to a profile page — all three tabs should be capped at ~420px with a fade at the bottom
2. "See more" link should appear below each tab
3. Clicking "See more" should navigate to `/app/feed?userId=<that-user-id>`
4. Tabs with little content should still show the fade (acceptable — keeps it consistent)

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/profile.\$userId.tsx
git commit -m "feat: cap profile tab sections with fade overlay and see-more link"
```
