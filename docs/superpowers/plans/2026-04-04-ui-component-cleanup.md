# UI Component Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplicate components and consolidate copy-paste code into reusable, composable pieces without changing any visual appearance.

**Architecture:** Three independent refactors: (1) replace inline star rating with shared component, (2) consolidate 4 atmosphere backgrounds into a config-driven component, (3) merge 2 recommend modals into a composable component. Each refactor is safe to ship independently.

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui Dialog, tRPC, motion/react

---

## Task 1: Replace inline star rating with shared StarRating component

**Files:**
- Modify: `src/components/watched/star-rating.tsx` (add optional props for layout/label customization)
- Modify: `src/components/watchlist/review-dialog.tsx` (replace inline stars with StarRating)

The existing `StarRating` in `watched/star-rating.tsx` is centered with labels. The `review-dialog.tsx` has inline stars with a `{n}/5` display. We need to make `StarRating` flexible enough for both cases.

- [ ] **Step 1: Update StarRating to accept layout/label customizations**

In `src/components/watched/star-rating.tsx`, add optional props to control layout and labels:

```tsx
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
	/** Show rating label text below stars (default: true) */
	showLabel?: boolean;
	/** Show numeric "N/5" indicator (default: false) */
	showNumeric?: boolean;
	/** Allow clicking same star to deselect (default: true) */
	toggleable?: boolean;
	/** Additional className for the root container */
	className?: string;
}

export function StarRating({
	value,
	onChange,
	showLabel = true,
	showNumeric = false,
	toggleable = true,
	className,
}: StarRatingProps) {
	const [hovered, setHovered] = useState<number | null>(null);
	const displayValue = hovered ?? value ?? 0;

	return (
		<div className={className ?? "text-center"}>
			{showLabel && (
				<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3">
					How was it?
				</div>
			)}
			<div
				className="flex items-center gap-1.5 mb-2.5"
				role="radiogroup"
				aria-label="Star rating"
				onMouseLeave={() => setHovered(null)}
			>
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						key={star}
						type="button"
						aria-pressed={value === star}
						aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
						className="relative w-12 h-12 flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95"
						onMouseEnter={() => setHovered(star)}
						onFocus={() => setHovered(star)}
						onBlur={() => setHovered(null)}
						onClick={() =>
							onChange(toggleable && value === star ? null : star)
						}
					>
						<div
							className={`absolute inset-0.5 rounded-full bg-neon-amber/15 shadow-[0_0_16px_rgba(255,184,0,0.4)] transition-opacity duration-150 ${star <= displayValue ? "opacity-100" : "opacity-0"}`}
						/>
						<span
							className={`text-[2rem] leading-none relative z-10 transition-all duration-100 ${
								star <= displayValue
									? "text-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.7)]"
									: "text-cream/10"
							}`}
						>
							★
						</span>
					</button>
				))}
				{showNumeric && displayValue > 0 && (
					<span className="ml-1 font-mono text-xs text-neon-amber/70">
						{displayValue}/5
					</span>
				)}
			</div>
			{showLabel && (
				<div className="font-display text-sm text-neon-amber/60 tracking-wider h-5">
					{displayValue > 0 ? ratingLabels[displayValue] : "\u00A0"}
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Replace inline stars in review-dialog.tsx**

In `src/components/watchlist/review-dialog.tsx`, remove the `Star` import from lucide, remove `hoverRating` state, remove `displayRating` derived value, and replace the inline star block (lines 99-142) with:

```tsx
// Add import at top:
import { StarRating } from "#/components/watched/star-rating";

// Remove from imports: Star (from lucide-react)
// Remove state: const [hoverRating, setHoverRating] = useState(0);
// Remove derived: const displayRating = hoverRating || rating;

// Replace the star rating section (the <div> from "Star rating" comment through end of its parent div):
<div>
	<p className="font-mono text-[10px] uppercase tracking-[2px] text-cream/40 mb-3">
		Your Rating
	</p>
	<StarRating
		value={rating || null}
		onChange={(v) => setRating(v ?? 0)}
		showLabel={false}
		showNumeric
		toggleable={false}
		className=""
	/>
</div>
```

- [ ] **Step 3: Run the dev server and verify both dialogs visually**

Run: `bun run dev`

Verify in Chrome test browser:
1. Navigate to a watchlist, trigger the review dialog — confirm stars render, hover highlights work, numeric `N/5` shows, clicking sets rating
2. Navigate to a watched title, trigger the review modal — confirm the existing StarRating still works with labels, toggle behavior works

- [ ] **Step 4: Commit**

```bash
git add src/components/watched/star-rating.tsx src/components/watchlist/review-dialog.tsx
git commit -m "refactor: use shared StarRating component in watchlist review dialog"
```

---

## Task 2: Consolidate atmosphere components

**Files:**
- Create: `src/components/atmosphere.tsx`
- Modify: `src/routes/app/feed.tsx` (swap `FeedAtmosphere` → `Atmosphere`)
- Modify: `src/routes/app/friends.tsx` (swap `FriendsAtmosphere` → `Atmosphere`)
- Modify: `src/routes/app/watchlists/$watchlistId.tsx` (swap `WatchlistAtmosphere` → `Atmosphere`)
- Modify: `src/routes/app/watchlists/index.tsx` (swap `WatchlistAtmosphere` → `Atmosphere`)
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx` (swap `TitlePageAtmosphere` → `Atmosphere`)
- Delete: `src/components/feed/feed-atmosphere.tsx`
- Delete: `src/components/friends/friends-atmosphere.tsx`
- Delete: `src/components/watchlist/watchlist-atmosphere.tsx`
- Delete: `src/components/title/title-page-atmosphere.tsx`

Note: `shuffle/shuffle-atmosphere.tsx` is NOT touched — it's a completely different design (projector beam, car dashboard, particles).

The 4 atmosphere components share the same structure with these differences:

| Page | Ground glow color | Ground height | Fog heights | Film strips | Light orbs |
|------|-------------------|--------------|-------------|-------------|------------|
| Feed | amber `rgba(255,184,0,0.12)` | 220px | 140/110/90 | Yes | amber, cyan, pink |
| Friends | pink `rgba(255,45,120,0.12)` | 220px | 140/110/90 | Yes | pink, cyan, amber |
| Watchlist | pink `rgba(236,72,153,0.15)` | 200px | 120/100/80 | No | No |
| Title | pink `rgba(236,72,153,0.15)` | 200px | None | No | No |

- [ ] **Step 1: Create the configurable Atmosphere component**

Create `src/components/atmosphere.tsx`:

```tsx
interface LightOrb {
	position: { top?: string; bottom?: string; left?: string; right?: string };
	size: string;
	color: string;
}

interface AtmosphereProps {
	/** Ground glow radial gradient color, e.g. "rgba(255,184,0,0.12)" */
	glowColor: string;
	/** Height of the ground glow (default "220px") */
	glowHeight?: string;
	/** Whether to render fog layers (default true) */
	fog?: boolean;
	/** Heights of the 3 fog layers (default ["140px","110px","90px"]) */
	fogHeights?: [string, string, string];
	/** Whether to render film strip edges (default false) */
	filmStrips?: boolean;
	/** Optional scattered light orbs */
	orbs?: LightOrb[];
}

export function Atmosphere({
	glowColor,
	glowHeight = "220px",
	fog = true,
	fogHeights = ["140px", "110px", "90px"],
	filmStrips = false,
	orbs,
}: AtmosphereProps) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Ground glow */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: glowHeight,
					background: `radial-gradient(ellipse at 50% 100%, ${glowColor} 0%, transparent 70%)`,
				}}
			/>

			{/* Fog layers */}
			{fog && (
				<>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[0],
							background:
								"radial-gradient(ellipse 120% 80% at 30% 100%, rgba(255,255,255,0.03) 0%, transparent 70%)",
							animationName: "fog-drift-1",
							animationDuration: "20s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[1],
							background:
								"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.025) 0%, transparent 65%)",
							animationName: "fog-drift-2",
							animationDuration: "23s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[2],
							background:
								"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
							animationName: "fog-drift-3",
							animationDuration: "25s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
				</>
			)}

			{/* Film strip edges */}
			{filmStrips && (
				<>
					<div
						className="fixed left-0 top-0 bottom-0"
						style={{ width: "22px", opacity: 0.06 }}
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
					<div
						className="fixed right-0 top-0 bottom-0"
						style={{ width: "22px", opacity: 0.06 }}
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
				</>
			)}

			{/* Scattered light orbs */}
			{orbs?.map((orb, i) => (
				<div
					key={`orb-${i.toString()}`}
					className="fixed"
					style={{
						...orb.position,
						width: orb.size,
						height: orb.size,
						borderRadius: "50%",
						background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
					}}
				/>
			))}
		</div>
	);
}
```

- [ ] **Step 2: Update feed route**

In `src/routes/app/feed.tsx`, replace:

```tsx
// Old import:
import { FeedAtmosphere } from "#/components/feed/feed-atmosphere";
// New import:
import { Atmosphere } from "#/components/atmosphere";

// Old usage:
<FeedAtmosphere />
// New usage:
<Atmosphere
  glowColor="rgba(255,184,0,0.12)"
  filmStrips
  orbs={[
    { position: { top: "20%", left: "8%" }, size: "80px", color: "rgba(255,184,0,0.04)" },
    { position: { top: "55%", right: "6%" }, size: "100px", color: "rgba(0,229,255,0.03)" },
    { position: { bottom: "30%", left: "5%" }, size: "60px", color: "rgba(255,45,120,0.03)" },
  ]}
/>
```

- [ ] **Step 3: Update friends route**

In `src/routes/app/friends.tsx`, replace:

```tsx
// Old import:
import { FriendsAtmosphere } from "#/components/friends/friends-atmosphere";
// New import:
import { Atmosphere } from "#/components/atmosphere";

// Old usage:
<FriendsAtmosphere />
// New usage:
<Atmosphere
  glowColor="rgba(255,45,120,0.12)"
  filmStrips
  orbs={[
    { position: { top: "20%", left: "8%" }, size: "80px", color: "rgba(255,45,120,0.04)" },
    { position: { top: "55%", right: "6%" }, size: "100px", color: "rgba(0,229,255,0.03)" },
    { position: { bottom: "30%", left: "5%" }, size: "60px", color: "rgba(255,184,0,0.03)" },
  ]}
/>
```

- [ ] **Step 4: Update watchlist routes**

In `src/routes/app/watchlists/$watchlistId.tsx` and `src/routes/app/watchlists/index.tsx`, replace:

```tsx
// Old import:
import { WatchlistAtmosphere } from "#/components/watchlist/watchlist-atmosphere";
// New import:
import { Atmosphere } from "#/components/atmosphere";

// Old usage (all instances):
<WatchlistAtmosphere />
// New usage:
<Atmosphere
  glowColor="rgba(236,72,153,0.15)"
  glowHeight="200px"
  fogHeights={["120px", "100px", "80px"]}
/>
```

- [ ] **Step 5: Update title route**

In `src/routes/app/title.$mediaType.$tmdbId.tsx`, replace:

```tsx
// Old import:
import { TitlePageAtmosphere } from "#/components/title/title-page-atmosphere";
// New import:
import { Atmosphere } from "#/components/atmosphere";

// Old usage:
<TitlePageAtmosphere />
// New usage:
<Atmosphere glowColor="rgba(236,72,153,0.15)" glowHeight="200px" fog={false} />
```

- [ ] **Step 6: Delete old atmosphere files**

```bash
rm src/components/feed/feed-atmosphere.tsx
rm src/components/friends/friends-atmosphere.tsx
rm src/components/watchlist/watchlist-atmosphere.tsx
rm src/components/title/title-page-atmosphere.tsx
```

- [ ] **Step 7: Verify visually in browser**

Run: `bun run dev`

Check all 5 pages in Chrome test browser to confirm backgrounds look identical:
1. `/app/feed` — amber glow, fog, film strips, 3 orbs
2. `/app/friends` — pink glow, fog, film strips, 3 orbs (different colors)
3. `/app/watchlists` — pink glow, shorter fog, no strips, no orbs
4. `/app/watchlists/:id` — same as watchlists index
5. `/app/title/:type/:id` — pink glow only, no fog

- [ ] **Step 8: Commit**

```bash
git add src/components/atmosphere.tsx src/routes/app/feed.tsx src/routes/app/friends.tsx src/routes/app/watchlists/\$watchlistId.tsx src/routes/app/watchlists/index.tsx src/routes/app/title.\$mediaType.\$tmdbId.tsx
git rm src/components/feed/feed-atmosphere.tsx src/components/friends/friends-atmosphere.tsx src/components/watchlist/watchlist-atmosphere.tsx src/components/title/title-page-atmosphere.tsx
git commit -m "refactor: consolidate 4 atmosphere components into single configurable Atmosphere"
```

---

## Task 3: Consolidate recommend modals into composable component

**Files:**
- Create: `src/components/recommend/recommend-modal.tsx`
- Modify: `src/routes/app/title.$mediaType.$tmdbId.tsx` (use new component)
- Modify: `src/components/title/title-actions.tsx` (use new component)
- Modify: `src/components/watched/review-modal.tsx` (use new component)
- Delete: `src/components/title/recommend-dialog.tsx`
- Delete: `src/components/title/recommend-modal.tsx` (dead code)
- Delete: `src/components/watched/recommend-modal.tsx`

Currently there are 3 recommend components but only 2 are used:

| Component | Used from | Has search | Has message | Visual style | Friend source |
|-----------|-----------|------------|-------------|-------------|--------------|
| `title/recommend-dialog.tsx` | title page hero | No | No | Scanline/amber | `friend.list` |
| `watched/recommend-modal.tsx` | title-actions, review-modal | No | Yes | Marquee/pink | `friend.list` |
| `title/recommend-modal.tsx` | **UNUSED (dead code)** | Yes | Yes | Standard | `recommendation.searchFriends` |

The new composable component will support all features through composition:

```tsx
<RecommendModal open onOpenChange={...} tmdbId={...} mediaType={...} titleName={...}>
  <RecommendModal.Search />          {/* optional: adds friend search */}
  <RecommendModal.FriendList />      {/* always: shows friends, toggleable */}
  <RecommendModal.Message />         {/* optional: adds message textarea */}
</RecommendModal>
```

But since the two active use cases are simple (both load all friends, one has a message), a simpler approach is a single component with `showMessage` prop and visual `variant` prop.

- [ ] **Step 1: Create the unified RecommendModal**

Create `src/components/recommend/recommend-modal.tsx`:

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Send, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface RecommendModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	mediaType: "movie" | "tv";
	titleName: string;
	/** Include optional message textarea (default: false) */
	showMessage?: boolean;
	/** Visual theme variant */
	variant?: "scanline" | "marquee";
}

export function RecommendModal({
	open,
	onOpenChange,
	tmdbId,
	mediaType,
	titleName,
	showMessage = false,
	variant = "scanline",
}: RecommendModalProps) {
	const trpc = useTRPC();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [sent, setSent] = useState(false);
	const [message, setMessage] = useState("");

	const { data: friends = [], isLoading } = useQuery(
		trpc.friend.list.queryOptions(),
	);

	const sendRec = useMutation(
		trpc.recommendation.send.mutationOptions({
			onSuccess: () => {
				if (variant === "scanline") {
					setSent(true);
					setTimeout(() => handleClose(), 1400);
				} else {
					const count = selectedIds.size;
					toast.success(
						`Recommended ${titleName} to ${count} friend${count > 1 ? "s" : ""}`,
					);
					handleClose();
				}
			},
			onError: (err) => {
				toast.error(err.message ?? "Failed to send recommendation");
			},
		}),
	);

	function handleClose() {
		setSelectedIds(new Set());
		setSent(false);
		setMessage("");
		onOpenChange(false);
	}

	function toggleFriend(id: string) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function handleSend() {
		if (selectedIds.size === 0) return;
		sendRec.mutate({
			tmdbId,
			mediaType,
			recipientIds: Array.from(selectedIds),
			titleName,
			message: showMessage && message.trim() ? message.trim() : undefined,
		});
	}

	const count = selectedIds.size;

	if (variant === "marquee") {
		return (
			<Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
				<DialogContent
					className="max-w-[360px] border-none bg-transparent p-0 gap-0 shadow-none"
					showCloseButton={false}
					aria-describedby={undefined}
				>
					<DialogTitle className="sr-only">Recommend</DialogTitle>
					<div className="w-full flex flex-col items-center">
						{/* Pink marquee header */}
						<div className="w-[calc(100%-16px)] border-2 border-neon-pink/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,45,120,0.08)]">
							<div className="flex justify-center gap-3 mb-1.5">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={`bulb-${i.toString()}`}
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
										onClick={handleClose}
										className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/30 hover:text-cream/60 transition-colors duration-200"
									>
										close ✕
									</button>
								</div>

								{/* Friend list */}
								<div>
									<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
										Send To
									</div>
									{isLoading ? (
										<div className="py-4 text-center">
											<div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-neon-pink/30 border-t-neon-pink/80" />
										</div>
									) : friends.length === 0 ? (
										<div className="py-4 text-center">
											<p className="font-mono-retro text-xs text-cream/30">
												No friends yet
											</p>
										</div>
									) : (
										<div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
											{friends.map((friend) => {
												const isSelected = selectedIds.has(friend.id);
												return (
													<button
														key={friend.id}
														type="button"
														onClick={() => toggleFriend(friend.id)}
														className={`flex items-center gap-2.5 px-3 py-2 rounded-md border transition-colors duration-200 text-left ${
															isSelected
																? "bg-neon-pink/[0.06] border-neon-pink/20"
																: "bg-black/20 border-cream/[0.05] hover:border-cream/10"
														}`}
													>
														<div
															className={`w-7 h-7 rounded-full flex items-center justify-center font-mono-retro text-xs shrink-0 border ${
																isSelected
																	? "border-neon-pink/30 bg-neon-pink/10 text-neon-pink"
																	: "border-cream/10 bg-cream/[0.06] text-cream/40"
															}`}
														>
															{friend.avatarUrl ? (
																<img
																	src={friend.avatarUrl}
																	alt=""
																	className="w-7 h-7 rounded-full object-cover"
																/>
															) : (
																(friend.username?.slice(0, 2).toUpperCase() ?? "?")
															)}
														</div>
														<span className="flex-1 text-sm text-cream/70">
															@{friend.username}
														</span>
														{isSelected && (
															<span className="text-sm text-neon-pink">✓</span>
														)}
													</button>
												);
											})}
										</div>
									)}
								</div>

								{/* Selected chips */}
								{count > 0 && (
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Selected
										</div>
										<div className="flex gap-1.5 flex-wrap">
											{friends
												.filter((f) => selectedIds.has(f.id))
												.map((f) => (
													<div
														key={f.id}
														className="flex items-center gap-1 px-2.5 py-1 bg-neon-pink/[0.08] border border-neon-pink/25 rounded-full font-mono-retro text-xs text-neon-pink"
													>
														@{f.username}
														<button
															type="button"
															onClick={() => toggleFriend(f.id)}
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

								{/* Optional message */}
								{showMessage && (
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
								)}

								{/* Send button */}
								<button
									type="button"
									onClick={handleSend}
									disabled={count === 0 || sendRec.isPending}
									className="w-full py-3 px-6 bg-neon-pink/[0.08] border-2 border-neon-pink/35 rounded-lg font-display text-base tracking-widest text-neon-pink text-center shadow-[0_4px_0_rgba(255,45,120,0.12),0_0_16px_rgba(255,45,120,0.08)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(255,45,120,0.12),0_0_24px_rgba(255,45,120,0.12)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									Send Recommendation
								</button>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	// Default: scanline variant
	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
			<DialogContent
				className="max-w-sm rounded-2xl border-none bg-transparent p-0 gap-0 shadow-none"
				overlayClassName="bg-[rgba(5,5,8,0.82)] backdrop-blur-[10px]"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">Recommend</DialogTitle>
				<div
					className="rounded-2xl p-px"
					style={{
						background:
							"linear-gradient(135deg, rgba(255,184,0,0.3) 0%, rgba(255,45,120,0.2) 60%, rgba(0,229,255,0.1) 100%)",
						boxShadow:
							"0 0 40px rgba(255,184,0,0.1), 0 24px 60px rgba(0,0,0,0.6)",
					}}
				>
					<div
						className="relative rounded-2xl overflow-hidden"
						style={{ background: "#0b0b18" }}
					>
						{/* Scanline texture */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-0"
							style={{
								backgroundImage:
									"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)",
							}}
						/>

						{/* Header */}
						<div className="relative z-10 px-5 pt-5 pb-4 border-b border-cream/8">
							<button
								type="button"
								onClick={handleClose}
								className="absolute top-4 right-4 rounded-lg p-1.5 text-cream/30 hover:text-cream/60 hover:bg-cream/8 transition-colors"
								aria-label="Close"
							>
								<X className="h-4 w-4" />
							</button>

							<p
								className="font-mono text-[10px] uppercase tracking-[3px] text-neon-amber/60 mb-1"
								style={{ textShadow: "0 0 10px rgba(255,184,0,0.3)" }}
							>
								Share the Reel
							</p>
							<h2
								className="font-display text-xl text-cream"
								style={{ textShadow: "0 0 20px rgba(255,184,0,0.15)" }}
							>
								Recommend
							</h2>
							<p className="mt-0.5 text-xs text-cream/40 pr-6 truncate">
								Send <span className="text-cream/65">{titleName}</span> to your
								friends
							</p>
						</div>

						{/* Friend list */}
						<div className="relative z-10 px-3 py-3 max-h-64 overflow-y-auto">
							{isLoading ? (
								<div className="py-8 text-center">
									<div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-neon-amber/30 border-t-neon-amber/80" />
								</div>
							) : friends.length === 0 ? (
								<div className="py-8 text-center">
									<Users className="mx-auto mb-2 h-7 w-7 text-cream/15" />
									<p className="font-mono text-xs text-cream/30 uppercase tracking-wider">
										No friends yet
									</p>
								</div>
							) : (
								<ul className="space-y-1">
									{friends.map((friend) => {
										const isSelected = selectedIds.has(friend.id);
										const initial =
											(friend.username ?? "?")[0]?.toUpperCase() ?? "?";

										return (
											<li key={friend.id}>
												<button
													type="button"
													onClick={() => toggleFriend(friend.id)}
													className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all text-left"
													style={
														isSelected
															? {
																	background: "rgba(255,184,0,0.1)",
																	border: "1px solid rgba(255,184,0,0.3)",
																}
															: {
																	background: "transparent",
																	border: "1px solid transparent",
																}
													}
												>
													{friend.avatarUrl ? (
														<img
															src={friend.avatarUrl}
															alt={friend.username ?? "Friend"}
															className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-cream/10"
														/>
													) : (
														<div
															className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
															style={{
																background: isSelected
																	? "rgba(255,184,0,0.2)"
																	: "rgba(255,255,255,0.06)",
																color: isSelected
																	? "#FFB800"
																	: "rgba(255,255,255,0.4)",
																border: isSelected
																	? "1px solid rgba(255,184,0,0.3)"
																	: "1px solid rgba(255,255,255,0.08)",
															}}
														>
															{initial}
														</div>
													)}

													<span
														className="flex-1 font-mono text-sm truncate"
														style={{
															color: isSelected
																? "rgba(255,184,0,0.9)"
																: "rgba(255,255,255,0.6)",
														}}
													>
														@{friend.username ?? friend.id.slice(0, 8)}
													</span>

													<AnimatePresence>
														{isSelected && (
															<motion.div
																initial={{ scale: 0, opacity: 0 }}
																animate={{ scale: 1, opacity: 1 }}
																exit={{ scale: 0, opacity: 0 }}
																transition={{
																	type: "spring",
																	damping: 18,
																	stiffness: 300,
																}}
															>
																<Check
																	className="h-4 w-4"
																	style={{ color: "#FFB800" }}
																/>
															</motion.div>
														)}
													</AnimatePresence>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</div>

						{/* Optional message */}
						{showMessage && count > 0 && (
							<div className="relative z-10 px-5 pb-2">
								<textarea
									value={message}
									onChange={(e) => setMessage(e.target.value.slice(0, 150))}
									placeholder="Add a message (optional)"
									rows={2}
									className="w-full rounded-xl border border-cream/10 bg-cream/[0.04] px-3.5 py-3 font-mono text-sm text-cream placeholder:text-cream/20 focus:border-neon-amber/40 focus:outline-none resize-none transition-colors"
								/>
								<div className="text-right mt-1">
									<span className="text-[11px] text-cream/25">
										{message.length}/150
									</span>
								</div>
							</div>
						)}

						{/* Footer */}
						<div className="relative z-10 px-5 pb-5 pt-3 border-t border-cream/8">
							{sent ? (
								<motion.div
									initial={{ opacity: 0, y: 4 }}
									animate={{ opacity: 1, y: 0 }}
									className="flex items-center justify-center gap-2 py-2"
								>
									<Check className="h-4 w-4 text-neon-cyan" />
									<span className="font-mono text-xs uppercase tracking-[2px] text-neon-cyan">
										Sent!
									</span>
								</motion.div>
							) : (
								<button
									type="button"
									onClick={handleSend}
									disabled={count === 0 || sendRec.isPending}
									className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs uppercase tracking-[1.5px] transition-all disabled:cursor-not-allowed"
									style={
										count > 0
											? {
													background: "rgba(255,184,0,0.12)",
													borderColor: "rgba(255,184,0,0.45)",
													color: "#FFB800",
													boxShadow: "0 0 16px rgba(255,184,0,0.12)",
												}
											: {
													background: "transparent",
													borderColor: "rgba(255,255,255,0.08)",
													color: "rgba(255,255,255,0.2)",
												}
									}
								>
									<Send className="h-3.5 w-3.5" />
									{count > 0
										? `Send to ${count} friend${count !== 1 ? "s" : ""}`
										: "Select friends"}
								</button>
							)}
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Update title page hero (was using RecommendDialog)**

In `src/routes/app/title.$mediaType.$tmdbId.tsx`:

```tsx
// Old import:
import { RecommendDialog } from "#/components/title/recommend-dialog";
// New import:
import { RecommendModal } from "#/components/recommend/recommend-modal";

// Old usage:
{showRecommend && (
  <RecommendDialog
    tmdbId={data.tmdbId}
    mediaType={mediaType}
    titleName={data.title}
    onClose={() => setShowRecommend(false)}
  />
)}
// New usage:
<RecommendModal
  open={showRecommend}
  onOpenChange={setShowRecommend}
  tmdbId={data.tmdbId}
  mediaType={mediaType as "movie" | "tv"}
  titleName={data.title}
/>
```

- [ ] **Step 3: Update title-actions (was using watched/RecommendModal)**

In `src/components/title/title-actions.tsx`:

```tsx
// Old import:
import { RecommendModal } from "#/components/watched/recommend-modal";
// New import:
import { RecommendModal } from "#/components/recommend/recommend-modal";

// Old usage:
<RecommendModal
  open={inviteOpen}
  onOpenChange={setInviteOpen}
  tmdbId={tmdbId}
  mediaType={mediaType}
  titleName={title}
/>
// New usage:
<RecommendModal
  open={inviteOpen}
  onOpenChange={setInviteOpen}
  tmdbId={tmdbId}
  mediaType={mediaType}
  titleName={title}
  showMessage
  variant="marquee"
/>
```

- [ ] **Step 4: Update review-modal (was using watched/RecommendModal)**

In `src/components/watched/review-modal.tsx`:

```tsx
// Old import:
import { RecommendModal } from "./recommend-modal";
// New import:
import { RecommendModal } from "#/components/recommend/recommend-modal";

// The usage should already work since the props are the same. Just add showMessage and variant:
<RecommendModal
  open={...}
  onOpenChange={...}
  tmdbId={...}
  mediaType={...}
  titleName={...}
  showMessage
  variant="marquee"
/>
```

- [ ] **Step 5: Delete old files**

```bash
rm src/components/title/recommend-dialog.tsx
rm src/components/title/recommend-modal.tsx
rm src/components/watched/recommend-modal.tsx
```

- [ ] **Step 6: Verify visually in browser**

Run: `bun run dev`

Check in Chrome test browser:
1. Navigate to a title page → click the recommend button in the hero section → scanline/amber dialog should appear with friend list
2. On same title page → open the action popover → click "Recommend" → marquee/pink dialog with message field
3. Mark a title as watched → go through review flow → when recommend modal appears, verify marquee/pink dialog with message field

- [ ] **Step 7: Commit**

```bash
git add src/components/recommend/recommend-modal.tsx src/routes/app/title.\$mediaType.\$tmdbId.tsx src/components/title/title-actions.tsx src/components/watched/review-modal.tsx
git rm src/components/title/recommend-dialog.tsx src/components/title/recommend-modal.tsx src/components/watched/recommend-modal.tsx
git commit -m "refactor: consolidate 3 recommend modals into single composable RecommendModal"
```

---

## Task 4: Verify full app and clean up

- [ ] **Step 1: Run type check**

```bash
bun run typecheck
```

Expected: no errors

- [ ] **Step 2: Run linter**

```bash
bun run lint
```

Expected: no new errors

- [ ] **Step 3: Full visual regression check in browser**

Navigate through all major flows in Chrome test browser:
- Feed page (atmosphere)
- Friends page (atmosphere)  
- Watchlist index + detail pages (atmosphere)
- Title page (atmosphere + recommend from hero + recommend from actions)
- Watch a title → review dialog (star rating)
- Review flow → recommend modal
- Shuffle page (shuffle atmosphere should be unchanged)

- [ ] **Step 4: Final commit if any fixes needed**
