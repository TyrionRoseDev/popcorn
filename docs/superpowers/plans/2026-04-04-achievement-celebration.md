# Achievement Celebration Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a celebration popup when a user earns achievements, wiring the existing `AchievementPopup` component to mutation responses via a global `MutationCache` interceptor.

**Architecture:** Server mutations that call `evaluateAchievements()` but discard the result are fixed to return `newAchievements`. On the client, a `MutationCache.onSuccess` callback detects `newAchievements` in any mutation response and feeds them into an `AchievementCelebrationProvider` context, which renders the `AchievementPopup`.

**Tech Stack:** React, TanStack Query (`MutationCache`), tRPC, motion/react

---

### Task 1: Return `newAchievements` from `recommendation.send`

**Files:**
- Modify: `src/integrations/trpc/routers/recommendation.ts:133`

- [ ] **Step 1: Capture and return the result**

In `recommendation.send`, line 133 currently reads:

```typescript
			await evaluateAchievements(ctx.userId, "recommendation_sent");
		}),
```

Change to:

```typescript
			const newAchievements = await evaluateAchievements(ctx.userId, "recommendation_sent");
			return { newAchievements };
		}),
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/recommendation.ts
git commit -m "fix: return newAchievements from recommendation.send mutation"
```

---

### Task 2: Return `newAchievements` from `shuffle.swipe`

**Files:**
- Modify: `src/integrations/trpc/routers/shuffle.ts:315,346,389`

The `swipe` mutation has 3 `evaluateAchievements` calls and multiple return paths. We need to collect achievements from all calls and include them in every return.

- [ ] **Step 1: Collect achievements from the initial swipe evaluation**

Line 315 currently reads:

```typescript
			await evaluateAchievements(ctx.userId, "swipe");
```

Change to:

```typescript
			const swipeAchievements = await evaluateAchievements(ctx.userId, "swipe");
```

- [ ] **Step 2: Collect achievements from solo shuffle-to-watchlist**

Line 346 currently reads:

```typescript
					await evaluateAchievements(ctx.userId, "shuffle_to_watchlist");

					return { match: false };
```

Change to:

```typescript
					const shuffleAchievements = await evaluateAchievements(ctx.userId, "shuffle_to_watchlist");

					return { match: false, newAchievements: [...swipeAchievements, ...shuffleAchievements] };
```

- [ ] **Step 3: Add newAchievements to group match path**

The `evaluateAchievements` call at line 389 is inside `if (inserted.length > 0)`. Change:

```typescript
					if (inserted.length > 0) {
						for (const swipe of yesSwipes) {
							await createNotification({
								recipientId: swipe.userId,
								actorId: ctx.userId,
								type: "shuffle_match",
								data: {
									watchlistId: input.watchlistId,
									titleName: "",
									tmdbId: input.tmdbId,
									mediaType: input.mediaType,
								},
							});
						}

						await evaluateAchievements(ctx.userId, "shuffle_to_watchlist");
					}

					return {
						match: true,
						watchlistName: wl.name,
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
					};
```

To:

```typescript
					let shuffleAchievements: string[] = [];
					if (inserted.length > 0) {
						for (const swipe of yesSwipes) {
							await createNotification({
								recipientId: swipe.userId,
								actorId: ctx.userId,
								type: "shuffle_match",
								data: {
									watchlistId: input.watchlistId,
									titleName: "",
									tmdbId: input.tmdbId,
									mediaType: input.mediaType,
								},
							});
						}

						shuffleAchievements = await evaluateAchievements(ctx.userId, "shuffle_to_watchlist");
					}

					return {
						match: true,
						watchlistName: wl.name,
						tmdbId: input.tmdbId,
						mediaType: input.mediaType,
						newAchievements: [...swipeAchievements, ...shuffleAchievements],
					};
```

- [ ] **Step 4: Add newAchievements to remaining return paths**

The two `{ match: false }` returns at lines 400 and 403 become:

```typescript
				return { match: false, newAchievements: swipeAchievements };
			}

			return { match: false, newAchievements: swipeAchievements };
```

- [ ] **Step 5: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/shuffle.ts
git commit -m "fix: return newAchievements from shuffle.swipe mutation"
```

---

### Task 3: Return `newAchievements` from `watchlist.join` (addMember)

**Files:**
- Modify: `src/integrations/trpc/routers/watchlist.ts:692`

- [ ] **Step 1: Capture and return the result**

Line 692 currently reads:

```typescript
			await evaluateAchievements(input.userId, "watchlist_joined");
		}),
```

Change to:

```typescript
			const newAchievements = await evaluateAchievements(input.userId, "watchlist_joined");
			return { newAchievements };
		}),
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/watchlist.ts
git commit -m "fix: return newAchievements from watchlist.addMember mutation"
```

---

### Task 4: Return `newAchievements` from taste profile mutations

**Files:**
- Modify: `src/integrations/trpc/routers/taste-profile.ts:407,433`

- [ ] **Step 1: Update `saveTasteProfile`**

Lines 407-409 currently read:

```typescript
			await evaluateAchievements(userId, "onboarding");

			return { success: true };
```

Change to:

```typescript
			const newAchievements = await evaluateAchievements(userId, "onboarding");

			return { success: true, newAchievements };
```

- [ ] **Step 2: Update `saveProfileExtras`**

Lines 433-435 currently read:

```typescript
			await evaluateAchievements(ctx.userId, "onboarding");

			return { success: true };
```

Change to:

```typescript
			const newAchievements = await evaluateAchievements(ctx.userId, "onboarding");

			return { success: true, newAchievements };
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/taste-profile.ts
git commit -m "fix: return newAchievements from taste profile mutations"
```

---

### Task 5: Return `newAchievements` from `friend.acceptRequest`

**Files:**
- Modify: `src/integrations/trpc/routers/friend.ts:464`

- [ ] **Step 1: Include addressee's achievements in the return**

Line 464 currently reads:

```typescript
			return updated;
```

Change to:

```typescript
			return { ...updated, newAchievements: addresseeAchievements };
```

The current user is the addressee (they're the one accepting the request), so `addresseeAchievements` is the correct array to return.

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/integrations/trpc/routers/friend.ts
git commit -m "fix: return newAchievements from friend.acceptRequest mutation"
```

---

### Task 6: Rework `AchievementPopup` to summary layout

**Files:**
- Modify: `src/components/achievements/achievement-popup.tsx`

The current popup shows one achievement at a time with a `currentIndex` prop. The spec calls for a summary layout that shows all earned badges at once in a grid.

- [ ] **Step 1: Update the props interface and add TOTAL_ACHIEVEMENTS import**

Change the import and props at the top of the file. Add `TOTAL_ACHIEVEMENTS` to the achievements import:

```typescript
import { ACHIEVEMENTS_BY_ID, TOTAL_ACHIEVEMENTS } from "#/lib/achievements";
```

Replace the props interface:

```typescript
interface AchievementPopupProps {
	achievementIds: string[];
	earnedTotal: number;
	onDismiss: () => void;
}
```

- [ ] **Step 2: Rewrite the component body**

Replace the entire `AchievementPopup` function (keep the `PARTICLES` constant and `<style>` block unchanged). The new component:
- Shows "Achievement Unlocked" (singular) or "Achievements Unlocked" (plural)
- Displays all earned badges in a centered flex-wrap grid with staggered flip-in animations
- Each badge is 120x150px with conic gradient border, icon, and name
- For a single achievement, also shows the description
- Shows progress count and a "Continue" button

```tsx
export function AchievementPopup({
	achievementIds,
	earnedTotal,
	onDismiss,
}: AchievementPopupProps) {
	const achievements = useMemo(
		() =>
			achievementIds
				.map((id) => ACHIEVEMENTS_BY_ID.get(id))
				.filter(Boolean),
		[achievementIds],
	);

	if (achievements.length === 0) return null;

	const plural = achievements.length > 1;
	const totalAchievements = TOTAL_ACHIEVEMENTS;

	return (
		<>
			<style>{`
				@keyframes ach-particle-rise {
					0% {
						transform: translateY(0) translateX(0) scale(1);
						opacity: 0;
					}
					10% { opacity: 1; }
					80% { opacity: 0.8; }
					100% {
						transform: translateY(-85vh) translateX(var(--drift)) scale(0.3);
						opacity: 0;
					}
				}
				@keyframes ach-projector-sweep {
					0% { transform: rotate(-25deg); opacity: 0.12; }
					50% { transform: rotate(25deg); opacity: 0.18; }
					100% { transform: rotate(-25deg); opacity: 0.12; }
				}
				@keyframes ach-icon-glow-pulse {
					0%, 100% {
						text-shadow: 0 0 12px rgba(255,184,0,0.6), 0 0 30px rgba(255,184,0,0.4), 0 0 60px rgba(255,184,0,0.2);
					}
					50% {
						text-shadow: 0 0 18px rgba(255,184,0,0.9), 0 0 45px rgba(255,184,0,0.6), 0 0 90px rgba(255,184,0,0.3);
					}
				}
				@keyframes ach-conic-spin {
					from { --ach-angle: 0deg; }
					to { --ach-angle: 360deg; }
				}
				@property --ach-angle {
					syntax: '<angle>';
					initial-value: 0deg;
					inherits: false;
				}
			`}</style>

			<Dialog
				open
				onOpenChange={(v) => {
					if (!v) onDismiss();
				}}
			>
				<DialogContent
					className="inset-0 top-0 left-0 max-w-none w-screen h-screen translate-x-0 translate-y-0 rounded-none border-none bg-transparent p-0 gap-0 shadow-none"
					overlayClassName="bg-[rgba(5,5,8,0.88)] backdrop-blur-[12px]"
					showCloseButton={false}
					aria-describedby={undefined}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogTitle className="sr-only">
						{plural ? "Achievements Unlocked" : "Achievement Unlocked"}
					</DialogTitle>

					{/* Projector sweep beam */}
					<div className="flex items-center justify-center overflow-hidden w-full h-full">
						<div
							aria-hidden="true"
							className="pointer-events-none absolute bottom-0 left-1/2 origin-bottom"
							style={{
								width: "300px",
								height: "100vh",
								marginLeft: "-150px",
								background:
									"conic-gradient(from -15deg at 50% 100%, transparent 0deg, rgba(255,184,0,0.08) 15deg, transparent 30deg)",
								animation: "ach-projector-sweep 4s ease-in-out infinite",
							}}
						/>

						{/* Particles */}
						<div
							aria-hidden="true"
							className="pointer-events-none fixed inset-0"
						>
							{PARTICLES.map((p) => (
								<div
									key={p.id}
									className="absolute bottom-0 rounded-full"
									style={
										{
											left: p.left,
											width: `${p.size}px`,
											height: `${p.size}px`,
											background: p.color,
											"--drift": p.drift,
											animation: `ach-particle-rise ${p.duration} ${p.delay} ease-out infinite`,
										} as React.CSSProperties
									}
								/>
							))}
						</div>

						{/* Modal card */}
						<motion.div
							className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 text-center"
							style={{ maxWidth: "480px", width: "100%" }}
							initial={{ scale: 0.9, y: 20, opacity: 0 }}
							animate={{ scale: 1, y: 0, opacity: 1 }}
							exit={{ scale: 0.9, y: -20, opacity: 0 }}
							transition={{ type: "spring", damping: 18, stiffness: 220 }}
						>
							{/* Label */}
							<p
								className="font-mono-retro text-xs uppercase tracking-[4px] text-neon-amber/80"
								style={{
									textShadow:
										"0 0 12px rgba(255,184,0,0.5), 0 0 30px rgba(255,184,0,0.2)",
								}}
							>
								{plural ? "Achievements Unlocked" : "Achievement Unlocked"}
							</p>

							{/* Badge grid */}
							<div className="flex flex-wrap items-center justify-center gap-4">
								{achievements.map((achievement, i) => (
									<motion.div
										key={achievement.id}
										style={{ perspective: "600px" }}
										initial={{ rotateY: 90, scale: 0.85, opacity: 0 }}
										animate={{ rotateY: 0, scale: 1, opacity: 1 }}
										transition={{
											delay: 0.15 * i,
											duration: 0.7,
											ease: [0.16, 1, 0.3, 1],
										}}
									>
										<div
											className="relative flex flex-col items-center justify-center gap-2 rounded-2xl"
											style={{
												width: "120px",
												height: "150px",
												background: "#0a0a1e",
												padding: "3px",
												backgroundImage:
													"conic-gradient(from var(--ach-angle), #FF2D78 0%, #FFB800 33%, #00E5FF 66%, #FF2D78 100%)",
												animation: "ach-conic-spin 3s linear infinite",
											}}
										>
											<div
												className="absolute inset-[3px] rounded-2xl"
												style={{ background: "#0a0a1e" }}
											/>
											<div
												className="relative z-10 text-4xl leading-none"
												style={{
													animation:
														"ach-icon-glow-pulse 2s ease-in-out infinite",
													textShadow:
														"0 0 12px rgba(255,184,0,0.7), 0 0 30px rgba(255,184,0,0.4)",
												}}
											>
												{achievement.icon}
											</div>
											<p
												className="relative z-10 font-display text-xs text-cream/90 px-2 text-center leading-tight"
												style={{
													textShadow: "0 0 8px rgba(255,184,0,0.3)",
												}}
											>
												{achievement.name}
											</p>
										</div>
									</motion.div>
								))}
							</div>

							{/* Single achievement: show description */}
							{!plural && (
								<motion.p
									className="text-sm leading-relaxed text-cream/55"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.35, duration: 0.4 }}
								>
									{achievements[0].description}
								</motion.p>
							)}

							{/* Progress count */}
							<motion.p
								className="font-mono-retro text-xs tracking-[2px] text-neon-amber/45"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.45, duration: 0.4 }}
							>
								{earnedTotal} / {totalAchievements} Achievements
							</motion.p>

							{/* Continue button */}
							<motion.button
								type="button"
								onClick={onDismiss}
								className="relative overflow-hidden rounded-full border border-neon-amber/50 bg-neon-amber/12 px-8 py-3 font-mono-retro text-sm uppercase tracking-[2px] text-neon-amber transition-all hover:border-neon-amber/80 hover:bg-neon-amber/22 hover:shadow-[0_0_24px_rgba(255,184,0,0.25)] active:scale-95"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.5, duration: 0.35 }}
							>
								Continue
							</motion.button>
						</motion.div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors (popup is not imported anywhere active yet).

- [ ] **Step 4: Commit**

```bash
git add src/components/achievements/achievement-popup.tsx
git commit -m "feat: rework AchievementPopup to summary layout with badge grid"
```

---

### Task 7: Create `AchievementCelebrationProvider`

**Files:**
- Create: `src/components/achievements/achievement-celebration-provider.tsx`

- [ ] **Step 1: Create the provider component**

Create `src/components/achievements/achievement-celebration-provider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#/integrations/trpc/react";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
import { setOnNewAchievements } from "#/integrations/tanstack-query/root-provider";
import { AchievementPopup } from "./achievement-popup";

interface AchievementCelebrationContextValue {
	celebrate: (ids: string[]) => void;
}

const AchievementCelebrationContext =
	createContext<AchievementCelebrationContextValue>({
		celebrate: () => {},
	});

export function useAchievementCelebration() {
	return useContext(AchievementCelebrationContext);
}

export function AchievementCelebrationProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [pendingIds, setPendingIds] = useState<string[]>([]);
	const [earnedTotal, setEarnedTotal] = useState(0);
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const celebrate = useCallback(
		(ids: string[]) => {
			const validIds = ids.filter((id) => ACHIEVEMENTS_BY_ID.has(id));
			if (validIds.length === 0) return;

			setPendingIds((prev) => [...prev, ...validIds]);

			// Estimate earned total from cache or use a reasonable fallback
			const cached = queryClient.getQueryData<{
				earned: unknown[];
				total: number;
			}>(trpc.achievement.myAchievements.queryKey());
			setEarnedTotal((cached?.earned.length ?? 0) + ids.length);
		},
		[queryClient, trpc],
	);

	useEffect(() => {
		setOnNewAchievements(celebrate);
		return () => setOnNewAchievements(null);
	}, [celebrate]);

	const handleDismiss = useCallback(() => {
		setPendingIds([]);
		queryClient.invalidateQueries({
			queryKey: trpc.achievement.myAchievements.queryKey(),
		});
	}, [queryClient, trpc]);

	return (
		<AchievementCelebrationContext value={{ celebrate }}>
			{children}
			{pendingIds.length > 0 && (
				<AchievementPopup
					achievementIds={pendingIds}
					earnedTotal={earnedTotal}
					onDismiss={handleDismiss}
				/>
			)}
		</AchievementCelebrationContext>
	);
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/achievements/achievement-celebration-provider.tsx
git commit -m "feat: add AchievementCelebrationProvider context"
```

---

### Task 8: Add `MutationCache` interceptor and wire up provider in root layout

**Files:**
- Modify: `src/integrations/tanstack-query/root-provider.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add MutationCache to QueryClient**

In `src/integrations/tanstack-query/root-provider.tsx`, add the `MutationCache` import and a ref for the celebration callback.

Change the imports at the top from:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
```

To:

```typescript
import {
	MutationCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
```

Then add a celebration callback ref and update the `QueryClient` creation. Change:

```typescript
let context:
	| {
			queryClient: QueryClient;
			trpc: ReturnType<typeof createTRPCOptionsProxy<TRPCRouter>>;
	  }
	| undefined;

export function getContext() {
	if (context) {
		return context;
	}

	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: { serializeData: superjson.serialize },
			hydrate: { deserializeData: superjson.deserialize },
		},
	});
```

To:

```typescript
// Mutable ref so MutationCache can call into React context without circular deps
export let onNewAchievements: ((ids: string[]) => void) | null = null;
export function setOnNewAchievements(fn: ((ids: string[]) => void) | null) {
	onNewAchievements = fn;
}

let context:
	| {
			queryClient: QueryClient;
			trpc: ReturnType<typeof createTRPCOptionsProxy<TRPCRouter>>;
	  }
	| undefined;

export function getContext() {
	if (context) {
		return context;
	}

	const queryClient = new QueryClient({
		defaultOptions: {
			dehydrate: { serializeData: superjson.serialize },
			hydrate: { deserializeData: superjson.deserialize },
		},
		mutationCache: new MutationCache({
			onSuccess: (data) => {
				if (
					data &&
					typeof data === "object" &&
					"newAchievements" in data &&
					Array.isArray(data.newAchievements) &&
					data.newAchievements.length > 0
				) {
					onNewAchievements?.(data.newAchievements as string[]);
				}
			},
		}),
	});
```

- [ ] **Step 2: Add the provider to the root layout**

In `src/routes/__root.tsx`, add the import:

```typescript
import { AchievementCelebrationProvider } from "#/components/achievements/achievement-celebration-provider";
```

Then wrap the children inside `TanStackQueryProvider`. Change:

```tsx
				<TanStackQueryProvider>
					<TooltipProvider>{children}</TooltipProvider>
					<Toaster />
```

To:

```tsx
				<TanStackQueryProvider>
					<AchievementCelebrationProvider>
						<TooltipProvider>{children}</TooltipProvider>
					</AchievementCelebrationProvider>
					<Toaster />
```

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/tanstack-query/root-provider.tsx src/routes/__root.tsx
git commit -m "feat: wire achievement celebration popup to global mutation interceptor"
```

---

### Task 9: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/tyrion/Dev/popcorn && bun run dev`

- [ ] **Step 2: Test achievement popup**

Open the app in a browser. Navigate to your profile page (which triggers `achievement.sync`). If any backfilled achievements are found, the popup should appear.

To force-test: temporarily add a test button or use the browser console to call `celebrate(["first-watch"])` via the context.

- [ ] **Step 3: Test by marking a movie watched**

If you have an unwatched movie in a watchlist, mark it as watched. If it triggers a new achievement, the celebration popup should appear with the badge(s).

- [ ] **Step 4: Verify dismiss behavior**

Click "Continue" — the popup should close and the achievement count on your profile should update.
