# Friends Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the friends page with a pink neon identity, film strip card metaphor, friend stats, atmosphere layer, and fix marquee header consistency.

**Architecture:** Create a `FriendsAtmosphere` component for page-level effects (pink ground glow, fog, film strips, light orbs). Replace the ticket stub cards with film strip frame cards containing a scoreboard stats bar. Extend the `friend.list` tRPC query to include per-friend watch/rating/list stats via batch subqueries. Restyle pending request and discover cards as compact horizontal film strip variants. Fix the NowShowingHeader wrapper consistency across tracker and watchlists pages.

**Tech Stack:** React, TailwindCSS v4, motion (framer-motion), tRPC, Drizzle ORM, lucide-react

---

### Task 1: Backend — Add Friend Stats to `friend.list`

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts:136-172`

- [ ] **Step 1: Add batch stats queries to `friend.list`**

After the existing `friends` query (line 170), add batch queries for watch count, avg rating, and list count. Replace the return statement:

```typescript
list: protectedProcedure.query(async ({ ctx }) => {
    const friends = await db
        .select({
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
            favouriteFilmTmdbId: user.favouriteFilmTmdbId,
            favouriteFilmMediaType: user.favouriteFilmMediaType,
            favouriteGenreId: user.favouriteGenreId,
            bio: user.bio,
        })
        .from(friendship)
        .innerJoin(
            user,
            or(
                and(
                    eq(friendship.requesterId, ctx.userId),
                    eq(user.id, friendship.addresseeId),
                ),
                and(
                    eq(friendship.addresseeId, ctx.userId),
                    eq(user.id, friendship.requesterId),
                ),
            ),
        )
        .where(
            and(
                eq(friendship.status, "accepted"),
                or(
                    eq(friendship.requesterId, ctx.userId),
                    eq(friendship.addresseeId, ctx.userId),
                ),
            ),
        );

    if (friends.length === 0) return [];

    const friendIds = friends.map((f) => f.id);

    // Batch watch stats
    const watchStats = await db
        .select({
            userId: watchEvent.userId,
            watchCount: sql<number>`count(*)::int`,
            avgRating: sql<number | null>`round(avg(${watchEvent.rating})::numeric, 1)::float`,
        })
        .from(watchEvent)
        .where(inArray(watchEvent.userId, friendIds))
        .groupBy(watchEvent.userId);

    // Batch list counts (owned + member)
    const ownedCounts = await db
        .select({
            userId: watchlist.ownerId,
            count: sql<number>`count(*)::int`,
        })
        .from(watchlist)
        .where(
            and(
                inArray(watchlist.ownerId, friendIds),
                eq(watchlist.isPublic, true),
            ),
        )
        .groupBy(watchlist.ownerId);

    const memberCounts = await db
        .select({
            userId: watchlistMember.userId,
            count: sql<number>`count(*)::int`,
        })
        .from(watchlistMember)
        .innerJoin(watchlist, eq(watchlist.id, watchlistMember.watchlistId))
        .where(
            and(
                inArray(watchlistMember.userId, friendIds),
                eq(watchlist.isPublic, true),
                sql`${watchlistMember.userId} <> ${watchlist.ownerId}`,
            ),
        )
        .groupBy(watchlistMember.userId);

    const watchMap = new Map(watchStats.map((s) => [s.userId, s]));
    const ownedMap = new Map(ownedCounts.map((s) => [s.userId, s.count]));
    const memberMap = new Map(memberCounts.map((s) => [s.userId, s.count]));

    return friends.map((f) => ({
        ...f,
        watchCount: watchMap.get(f.id)?.watchCount ?? 0,
        avgRating: watchMap.get(f.id)?.avgRating ?? null,
        listCount: (ownedMap.get(f.id) ?? 0) + (memberMap.get(f.id) ?? 0),
    }));
}),
```

- [ ] **Step 2: Verify the dev server compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run dev`

Check the terminal for TypeScript compilation errors. The server should start without errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "feat(friends): add watchCount, avgRating, listCount to friend.list"
```

---

### Task 2: Friends Atmosphere Component

**Files:**
- Create: `src/components/friends/friends-atmosphere.tsx`

- [ ] **Step 1: Create the atmosphere component**

Model this on `src/components/feed/feed-atmosphere.tsx` but with pink tones. Create the file:

```tsx
export function FriendsAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Pink ground glow */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "220px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(255,45,120,0.12) 0%, transparent 70%)",
				}}
			/>

			{/* Fog layer 1 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "140px",
					background:
						"radial-gradient(ellipse 120% 80% at 30% 100%, rgba(255,255,255,0.03) 0%, transparent 70%)",
					animationName: "fog-drift-1",
					animationDuration: "20s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
			{/* Fog layer 2 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "110px",
					background:
						"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.025) 0%, transparent 65%)",
					animationName: "fog-drift-2",
					animationDuration: "23s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
			{/* Fog layer 3 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "90px",
					background:
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>

			{/* Film strip left edge */}
			<div
				className="fixed left-0 top-0 bottom-0"
				style={{
					width: "22px",
					opacity: 0.06,
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						background:
							"repeating-linear-gradient(180deg, transparent 0px, transparent 8px, rgba(255,255,240,0.5) 8px, rgba(255,255,240,0.5) 10px, transparent 10px, transparent 24px)",
						borderRight: "2px solid rgba(255,255,240,0.4)",
					}}
				/>
			</div>

			{/* Film strip right edge */}
			<div
				className="fixed right-0 top-0 bottom-0"
				style={{
					width: "22px",
					opacity: 0.06,
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						background:
							"repeating-linear-gradient(180deg, transparent 0px, transparent 8px, rgba(255,255,240,0.5) 8px, rgba(255,255,240,0.5) 10px, transparent 10px, transparent 24px)",
						borderLeft: "2px solid rgba(255,255,240,0.4)",
					}}
				/>
			</div>

			{/* Scattered light orbs */}
			<div
				className="fixed"
				style={{
					top: "20%",
					left: "8%",
					width: "80px",
					height: "80px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255,45,120,0.04), transparent 70%)",
				}}
			/>
			<div
				className="fixed"
				style={{
					top: "55%",
					right: "6%",
					width: "100px",
					height: "100px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(0,229,255,0.03), transparent 70%)",
				}}
			/>
			<div
				className="fixed"
				style={{
					bottom: "30%",
					left: "5%",
					width: "60px",
					height: "60px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255,184,0,0.03), transparent 70%)",
				}}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/friends/friends-atmosphere.tsx
git commit -m "feat(friends): add FriendsAtmosphere component with pink glow and fog"
```

---

### Task 3: Rewrite Friends Page — Structure, Atmosphere, Search Bar, Header

**Files:**
- Modify: `src/routes/app/friends.tsx`

This task rewrites the page scaffold: imports, atmosphere integration, header wrapper fix, and search bar restyle. The card components are handled in Tasks 4-6.

- [ ] **Step 1: Update imports and page wrapper**

Replace the existing `FriendsPage` function's return block (lines 438-615). Keep all the hooks and state at the top unchanged. Update the imports at the top of the file — add `FriendsAtmosphere`, remove any unused imports after the card refactors.

Add to imports:

```tsx
import { FriendsAtmosphere } from "#/components/friends/friends-atmosphere";
```

Replace the return statement of `FriendsPage` (starting at line 438 `return (`) with:

```tsx
return (
    <>
        <FriendsAtmosphere />
        <div className="relative z-[2] mx-auto max-w-2xl px-4 pt-8 pb-16">
            <NowShowingHeader title="Friends" />

            {/* Search bar */}
            <div className="relative mx-auto mt-8 max-w-xl">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neon-pink/50" />
                <input
                    type="text"
                    placeholder="Search friends or find new people..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full rounded-lg border border-neon-pink/25 bg-neon-pink/[0.05] py-3 pl-10 pr-4 text-sm text-cream/85 outline-none transition-all placeholder:text-cream/25 focus:border-neon-pink/50 focus:shadow-[0_0_20px_rgba(255,45,120,0.08)]"
                />
                {(searchLoading || isTyping) && hasApiQuery && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-pink/20 border-t-neon-pink/60" />
                    </div>
                )}
            </div>

            <div className="mt-8">
                {/* Pending requests section — only when not searching and requests exist */}
                {!isSearching && pendingRequests && pendingRequests.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-pink/50">
                            Friend Requests
                        </p>
                        <div className="flex flex-col gap-2">
                            <AnimatePresence mode="popLayout">
                                {pendingRequests.map((request) => (
                                    <PendingRequestCard
                                        key={request.friendshipId}
                                        request={request}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                        <div className="mt-8 border-t border-neon-pink/10" />
                    </motion.div>
                )}

                {/* Main content */}
                <AnimatePresence mode="wait">
                    {isSearching ? (
                        <motion.div
                            key="search-results"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Filtered friends */}
                            {filteredFriends.length > 0 && (
                                <div className="mb-8">
                                    <p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-pink/50">
                                        Your Friends
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {filteredFriends.map((friend) => (
                                            <FilmStripCard key={friend.id} friend={friend} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Other users from search */}
                            {hasApiQuery && (
                                <div>
                                    <p className="mb-3 font-mono-retro text-[11px] uppercase tracking-[2px] text-neon-cyan/50">
                                        Other Users
                                    </p>
                                    {searchLoading || isTyping ? (
                                        <div className="flex flex-col gap-2">
                                            {SKELETON_KEYS.map((key) => (
                                                <div
                                                    key={key}
                                                    className="h-[60px] animate-pulse rounded-lg bg-cream/[0.03]"
                                                />
                                            ))}
                                        </div>
                                    ) : otherUsers.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                            {otherUsers.map((user, index) => (
                                                <motion.div
                                                    key={user.id}
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{
                                                        duration: 0.25,
                                                        delay: index * 0.06,
                                                    }}
                                                >
                                                    <DiscoverResultCard
                                                        user={user}
                                                        isFriend={friendIds.has(user.id)}
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center py-12 text-center">
                                            <Search className="mb-3 h-8 w-8 text-neon-pink/15" />
                                            <p className="text-sm text-cream/40">
                                                No other users found matching &ldquo;{debouncedQuery}
                                                &rdquo;
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* No matches at all */}
                            {filteredFriends.length === 0 && !hasApiQuery && (
                                <div className="flex flex-col items-center py-16 text-center">
                                    <Search className="mb-3 h-8 w-8 text-neon-pink/15" />
                                    <p className="text-sm text-cream/35">
                                        No friends match &ldquo;{searchInput}&rdquo;
                                    </p>
                                    <p className="mt-1 text-xs text-cream/20">
                                        Type at least 2 characters to search all users
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="friends-grid"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {friendsLoading ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {SKELETON_KEYS.map((key) => (
                                        <div
                                            key={key}
                                            className="h-[180px] animate-pulse rounded-lg bg-cream/[0.04]"
                                        />
                                    ))}
                                </div>
                            ) : friends && friends.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {friends.map((friend) => (
                                        <FilmStripCard key={friend.id} friend={friend} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-20 text-center">
                                    <div
                                        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-neon-pink/15"
                                        style={{
                                            background:
                                                "radial-gradient(circle, rgba(255,45,120,0.06) 0%, transparent 70%)",
                                        }}
                                    >
                                        <UserSearch className="h-8 w-8 text-neon-pink/25" />
                                    </div>
                                    <p className="font-display text-lg text-cream/45">
                                        No friends yet
                                    </p>
                                    <p className="mt-1.5 max-w-xs text-sm text-cream/25">
                                        Search by username above to find people and send friend
                                        requests
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </>
);
```

Key changes from the original:
- `<FriendsAtmosphere />` added as first child
- Outer div changed from `max-w-4xl px-4 pb-16 pt-10` to `relative z-[2] mx-auto max-w-2xl px-4 pt-8 pb-16`
- Search bar: `neon-amber` → `neon-pink` everywhere
- Section labels: `neon-amber/50` → `neon-pink/50` for friend sections
- Divider: `neon-amber/10` → `neon-pink/10`
- Empty state icon: `neon-amber` → `neon-pink`
- `TicketStubCard` → `FilmStripCard` (built in Task 4)
- Skeleton height: `h-24` → `h-[180px]` to match taller film strip cards

- [ ] **Step 2: Commit**

```bash
git add src/routes/app/friends.tsx
git commit -m "design(friends): restyle page with pink atmosphere, search bar, and header fix"
```

---

### Task 4: Film Strip Friend Card

**Files:**
- Modify: `src/routes/app/friends.tsx`

- [ ] **Step 1: Update the `Friend` interface and replace `TicketStubCard` with `FilmStripCard`**

Update the `Friend` interface (around line 43) to include the new stats:

```typescript
interface Friend {
    id: string;
    username: string | null;
    avatarUrl: string | null;
    favouriteFilmTmdbId: number | null;
    favouriteFilmMediaType: string | null;
    favouriteGenreId: number | null;
    bio: string | null;
    watchCount: number;
    avgRating: number | null;
    listCount: number;
}
```

Delete the entire `TicketStubCard` function (lines 53-152) and replace it with `FilmStripCard`:

```tsx
function SprocketRow({ color }: { color: string }) {
    return (
        <div
            className="flex justify-center gap-[10px] py-1.5"
            style={{
                background: `${color}04`,
                borderBottom: `1px solid ${color}12`,
            }}
        >
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="h-[5px] w-2 rounded-sm transition-colors"
                    style={{ background: `${color}26` }}
                />
            ))}
        </div>
    );
}

function SprocketRowBottom({ color }: { color: string }) {
    return (
        <div
            className="flex justify-center gap-[10px] py-1.5"
            style={{
                background: `${color}04`,
                borderTop: `1px solid ${color}12`,
            }}
        >
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                    key={i}
                    className="h-[5px] w-2 rounded-sm transition-colors"
                    style={{ background: `${color}26` }}
                />
            ))}
        </div>
    );
}

function FilmStripCard({ friend }: { friend: Friend }) {
    const trpc = useTRPC();
    const initial = (friend.username ?? "?").charAt(0).toUpperCase();
    const gradient = getAvatarGradient(initial);
    // Extract the first color from the gradient for sprocket/border accents
    const accentColor = gradient.match(/#[A-Fa-f0-9]{6}/)?.[0] ?? "#FF2D78";

    const { data: favFilm } = useQuery(
        trpc.title.details.queryOptions(
            friend.favouriteFilmTmdbId
                ? {
                        tmdbId: friend.favouriteFilmTmdbId,
                        mediaType: "movie" as const,
                    }
                : skipToken,
        ),
    );

    return (
        <Link
            to="/app/profile/$userId"
            params={{ userId: friend.id }}
            className="group block no-underline"
        >
            <div
                className="relative overflow-hidden rounded-[10px] transition-all duration-200 group-hover:-translate-y-0.5"
                style={{
                    border: `1px solid ${accentColor}1a`,
                    background: "rgba(8,6,18,0.95)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
                }}
            >
                {/* Top sprockets */}
                <SprocketRow color={accentColor} />

                {/* Interior */}
                <div className="p-4">
                    {/* Avatar + name row */}
                    <div className="flex items-center gap-3">
                        {friend.avatarUrl ? (
                            <img
                                src={friend.avatarUrl}
                                alt=""
                                className="h-[50px] w-[50px] shrink-0 rounded-full object-cover"
                                style={{
                                    border: `2px solid ${accentColor}4d`,
                                    boxShadow: `0 0 20px ${accentColor}26`,
                                }}
                            />
                        ) : (
                            <div
                                className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full"
                                style={{
                                    background: gradient,
                                    boxShadow: `0 0 20px ${accentColor}26`,
                                }}
                            >
                                <span className="text-xl font-bold text-cream/90">
                                    {initial}
                                </span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="truncate font-mono-retro text-sm font-bold text-cream/92">
                                @{friend.username ?? "unknown"}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-cream/30">
                                ♥{" "}
                                {favFilm?.title
                                    ? favFilm.title
                                    : friend.favouriteFilmTmdbId
                                        ? "Loading…"
                                        : "No fave yet"}
                            </div>
                        </div>
                    </div>

                    {/* Stats bar */}
                    <div className="mt-3.5 flex gap-px overflow-hidden rounded-md">
                        <div className="flex-1 py-2 text-center" style={{ background: "rgba(255,45,120,0.06)" }}>
                            <div className="font-mono-retro text-base font-bold text-neon-pink">{friend.watchCount}</div>
                            <div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">Watched</div>
                        </div>
                        <div className="flex-1 py-2 text-center" style={{ background: "rgba(255,184,0,0.06)" }}>
                            <div className="font-mono-retro text-base font-bold text-neon-amber">
                                {friend.avgRating != null ? friend.avgRating.toFixed(1) : "—"}
                            </div>
                            <div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">Avg ★</div>
                        </div>
                        <div className="flex-1 py-2 text-center" style={{ background: "rgba(0,229,255,0.06)" }}>
                            <div className="font-mono-retro text-base font-bold text-neon-cyan">{friend.listCount}</div>
                            <div className="mt-0.5 text-[7px] uppercase tracking-[1.5px] text-cream/25">Lists</div>
                        </div>
                    </div>
                </div>

                {/* Bottom sprockets */}
                <SprocketRowBottom color={accentColor} />
            </div>
        </Link>
    );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `cd /Users/tyrion/Dev/popcorn && bun run dev`

Open the friends page in the browser. Verify:
- Film strip cards render in a 2-column grid
- Avatar, username, favourite film, and stats bar all display
- Sprocket holes are visible at top and bottom
- Hover lifts the card

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/friends.tsx
git commit -m "design(friends): replace TicketStubCard with FilmStripCard scoreboard layout"
```

---

### Task 5: Mini Film Strip — Pending Request Card

**Files:**
- Modify: `src/routes/app/friends.tsx`

- [ ] **Step 1: Replace `PendingRequestCard`**

Delete the existing `PendingRequestCard` function (around lines 154-271 in the original, position will have shifted after Task 4) and replace with:

```tsx
function VerticalSprockets({ color, side }: { color: string; side: "left" | "right" }) {
    return (
        <div
            className="flex shrink-0 flex-col items-center justify-center gap-[6px] px-1.5"
            style={{
                background: `${color}06`,
                ...(side === "left"
                    ? { borderRight: `1px solid ${color}15` }
                    : { borderLeft: `1px solid ${color}15` }),
            }}
        >
            {[0, 1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="h-[5px] w-2 rounded-sm"
                    style={{ background: `${color}26` }}
                />
            ))}
        </div>
    );
}

function PendingRequestCard({
    request,
}: {
    request: {
        friendshipId: string;
        requesterId: string;
        username: string | null;
        avatarUrl: string | null;
        createdAt: Date | null;
    };
}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const initial = (request.username ?? "?").charAt(0).toUpperCase();
    const gradient = getAvatarGradient(initial);

    const acceptMutation = useMutation(
        trpc.friend.acceptRequest.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: trpc.friend.list.queryKey(),
                });
                queryClient.invalidateQueries({
                    queryKey: trpc.friend.pendingRequests.queryKey(),
                });
                queryClient.invalidateQueries(
                    trpc.notification.getUnreadCount.queryFilter(),
                );
            },
        }),
    );

    const declineMutation = useMutation(
        trpc.friend.declineRequest.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: trpc.friend.pendingRequests.queryKey(),
                });
                queryClient.invalidateQueries(
                    trpc.notification.getUnreadCount.queryFilter(),
                );
            },
        }),
    );

    const isPending = acceptMutation.isPending || declineMutation.isPending;

    const timeAgo = request.createdAt
        ? formatTimeAgo(new Date(request.createdAt))
        : "";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="group flex overflow-hidden rounded-lg transition-all hover:-translate-y-px"
            style={{
                border: "1px solid rgba(255,45,120,0.1)",
                background: "rgba(8,6,18,0.95)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
            }}
        >
            {/* Left sprockets */}
            <VerticalSprockets color="#FF2D78" side="left" />

            {/* Content */}
            <div className="flex flex-1 items-center gap-3 px-4 py-3">
                <Link
                    to="/app/profile/$userId"
                    params={{ userId: request.requesterId }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                >
                    {request.avatarUrl ? (
                        <img
                            src={request.avatarUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-full border border-neon-pink/20 object-cover"
                        />
                    ) : (
                        <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neon-pink/20"
                            style={{ background: gradient }}
                        >
                            <span className="text-[15px] font-bold text-cream/90">
                                {initial}
                            </span>
                        </div>
                    )}

                    <div className="min-w-0 flex-1">
                        <p className="truncate font-mono-retro text-sm text-cream/85">
                            @{request.username ?? "unknown"}
                        </p>
                        {timeAgo && (
                            <p className="mt-0.5 text-xs text-cream/30">{timeAgo}</p>
                        )}
                    </div>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                            acceptMutation.mutate({
                                friendshipId: request.friendshipId,
                            })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 text-green-400 transition-colors hover:border-green-500/50 hover:bg-green-500/20 disabled:opacity-40"
                    >
                        <Check className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                            declineMutation.mutate({
                                friendshipId: request.friendshipId,
                            })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-40"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Right sprockets */}
            <VerticalSprockets color="#FF2D78" side="right" />
        </motion.div>
    );
}
```

- [ ] **Step 2: Verify pending requests render**

If you have pending requests, check they display with sprocket holes on left/right edges. If not, temporarily add a mock request to verify layout.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/friends.tsx
git commit -m "design(friends): restyle PendingRequestCard as mini film strip"
```

---

### Task 6: Mini Film Strip — Discover Result Card

**Files:**
- Modify: `src/routes/app/friends.tsx`

- [ ] **Step 1: Replace `DiscoverResultCard`**

Delete the existing `DiscoverResultCard` function and replace with:

```tsx
function DiscoverResultCard({
    user,
    isFriend,
}: {
    user: { id: string; username: string | null; avatarUrl: string | null };
    isFriend: boolean;
}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const initial = (user.username ?? "?").charAt(0).toUpperCase();
    const gradient = getAvatarGradient(initial);
    const [requestSent, setRequestSent] = useState(false);

    const sendRequestMutation = useMutation(
        trpc.friend.sendRequest.mutationOptions({
            onSuccess: () => {
                setRequestSent(true);
                toast.success(`Friend request sent to @${user.username ?? "user"}!`);
                queryClient.invalidateQueries({
                    queryKey: trpc.friend.pendingRequests.queryKey(),
                });
            },
            onError: (error) => {
                if (error.message === "Request already exists") {
                    setRequestSent(true);
                    toast.info("A request already exists with this user");
                } else {
                    toast.error("Failed to send request");
                }
            },
        }),
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="group flex overflow-hidden rounded-lg transition-all hover:-translate-y-px"
            style={{
                border: "1px solid rgba(0,229,255,0.1)",
                background: "rgba(8,6,18,0.95)",
                boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
            }}
        >
            {/* Left sprockets */}
            <VerticalSprockets color="#00E5FF" side="left" />

            {/* Content */}
            <div className="flex flex-1 items-center gap-3 px-4 py-3">
                <Link
                    to="/app/profile/$userId"
                    params={{ userId: user.id }}
                    className="shrink-0 no-underline"
                >
                    {user.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt=""
                            className="h-11 w-11 rounded-full border border-neon-cyan/20 object-cover transition-colors group-hover:border-neon-cyan/40"
                        />
                    ) : (
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-full border border-neon-cyan/20 transition-colors group-hover:border-neon-cyan/40"
                            style={{ background: gradient }}
                        >
                            <span className="text-[15px] font-bold text-cream/90">
                                {initial}
                            </span>
                        </div>
                    )}
                </Link>

                <div className="min-w-0 flex-1">
                    <Link
                        to="/app/profile/$userId"
                        params={{ userId: user.id }}
                        className="block truncate font-mono-retro text-sm text-cream/85 no-underline transition-colors hover:text-neon-cyan"
                    >
                        @{user.username ?? "unknown"}
                    </Link>
                </div>

                <div className="shrink-0">
                    {isFriend ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/8 px-3 py-1.5 font-mono-retro text-xs text-green-400/70">
                            <Check className="h-3 w-3" />
                            Friends
                        </span>
                    ) : requestSent ? (
                        <span className="flex items-center gap-1.5 rounded-full border border-cream/10 bg-cream/[0.04] px-3 py-1.5 font-mono-retro text-xs text-cream/35">
                            <Clock className="h-3 w-3" />
                            Request Sent
                        </span>
                    ) : (
                        <button
                            type="button"
                            disabled={sendRequestMutation.isPending}
                            onClick={() =>
                                sendRequestMutation.mutate({ userId: user.id })
                            }
                            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/10 px-3 py-1.5 font-mono-retro text-xs text-neon-pink transition-all hover:border-neon-pink/50 hover:bg-neon-pink/20 hover:shadow-[0_0_12px_rgba(255,45,120,0.15)] disabled:opacity-50"
                        >
                            <UserPlus className="h-3 w-3" />
                            {sendRequestMutation.isPending ? "Sending..." : "Add Friend"}
                        </button>
                    )}
                </div>
            </div>

            {/* Right sprockets */}
            <VerticalSprockets color="#00E5FF" side="right" />
        </motion.div>
    );
}
```

Note: The "Add Friend" button uses `neon-pink` instead of `neon-amber` to match the page's pink identity.

- [ ] **Step 2: Clean up unused imports**

Remove `Heart` and `Clock` from lucide-react imports if `Clock` is still used (it is — in the discover card "Request Sent" badge). Remove `Heart` since the ticket stub's favourite film heart is now a text `♥` character. Keep `Clock`.

- [ ] **Step 3: Verify search results render**

Run the dev server, type a search query on the friends page, and verify:
- Discover result cards have cyan sprocket holes on left/right edges
- Add Friend button is pink
- Friends badge and Request Sent badge display correctly

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/friends.tsx
git commit -m "design(friends): restyle DiscoverResultCard as mini film strip with cyan accents"
```

---

### Task 7: Fix Marquee Header Consistency — Tracker & Watchlists

**Files:**
- Modify: `src/routes/app/tracker.index.tsx:181-195`
- Modify: `src/routes/app/watchlists/index.tsx:24-29`

- [ ] **Step 1: Fix tracker page wrapper**

In `src/routes/app/tracker.index.tsx`, the outer container is at line 181. Change `pt-10` to `pt-8` (keep `max-w-3xl` since tracker content needs the width — `NowShowingHeader` self-constrains to 700px via its inner div):

```tsx
<div className="relative mx-auto max-w-3xl px-4 pt-8 pb-16">
```

Then remove the extra `<div className="mb-6">` wrapper around `NowShowingHeader` at line 194. The header should be a direct child of the `z-10` div, with the stats ribbon getting its own margin. Change:

```tsx
<div className="relative z-10">
    {/* ── Marquee Header ─────────────────────────────────────────────── */}
    <div className="mb-6">
        <NowShowingHeader title="Series Tracker" />
```

To:

```tsx
<div className="relative z-10">
    {/* ── Marquee Header ─────────────────────────────────────────────── */}
    <NowShowingHeader title="Series Tracker" />

    <div className="mb-6">
```

Move the closing `</div>` for the old `mb-6` wrapper to after the stats ribbon (this just shifts which content the `mb-6` wraps — it now wraps only the stats ribbon, not the header).

- [ ] **Step 2: Fix watchlists page wrapper**

In `src/routes/app/watchlists/index.tsx`, replace the inline styles at line 28 with Tailwind classes (don't add `max-w-2xl` since watchlist reels need full width — `NowShowingHeader` self-constrains):

```tsx
<div className="relative z-[2] pt-8">
```

- [ ] **Step 3: Verify both pages**

Open the tracker page and watchlists page. Verify the marquee header has the same width and vertical spacing as the feed page.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/tracker.index.tsx src/routes/app/watchlists/index.tsx
git commit -m "design: fix NowShowingHeader wrapper consistency across tracker and watchlists"
```
