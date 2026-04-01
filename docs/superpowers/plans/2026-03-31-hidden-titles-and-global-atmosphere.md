# Hidden Titles UI + Global Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate four duplicated atmosphere components into one global layer, fix star randomness, and widen the hidden titles grid to 6 columns.

**Architecture:** `RetroOverlays` becomes the single global atmosphere (stars, grain, scanlines, VHS scan) rendered in the app layout on every page. Page-specific atmosphere components (`ShuffleAtmosphere`, `TitlePageAtmosphere`, `WatchlistAtmosphere`) become thin additive layers containing only their unique effects. The hidden titles page drops its atmosphere component entirely and switches to a wider responsive grid.

**Tech Stack:** React, Tailwind CSS, TanStack Router

---

## File Structure

| File | Role |
|------|------|
| `src/components/retro-overlays.tsx` | Global atmosphere — night sky, 100 scattered stars, film grain, scanlines, VHS scan |
| `src/routes/app/route.tsx` | App layout — renders RetroOverlays unconditionally |
| `src/routes/app/shuffle/hidden.tsx` | Hidden titles page — wider grid, no ShuffleAtmosphere |
| `src/components/shuffle/shuffle-atmosphere.tsx` | Additive drive-in layer — projector, screen frame, fog, dashboard only |
| `src/components/title/title-page-atmosphere.tsx` | Additive title layer — pink ground glow only |
| `src/components/watchlist/watchlist-atmosphere.tsx` | Additive watchlist layer — pink ground glow + fog only |

---

### Task 1: Upgrade RetroOverlays to full global atmosphere

**Files:**
- Modify: `src/components/retro-overlays.tsx`

- [ ] **Step 1: Replace the STARS generator with a seeded PRNG**

Replace the entire file contents with:

```tsx
// Seeded PRNG (mulberry32) for deterministic but scattered star positions
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rand = mulberry32(42);

const STARS = Array.from({ length: 100 }, (_, i) => ({
	id: i,
	top: `${(rand() * 100).toFixed(1)}%`,
	left: `${(rand() * 100).toFixed(1)}%`,
	size: 1 + rand() * 1.5,
	dur: `${2.5 + rand() * 2}s`,
	delay: `${-(rand() * 3)}s`,
	o1: 0.1 + rand() * 0.1,
	o2: 0.6 + rand() * 0.35,
}));

export function RetroOverlays() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Night sky gradient */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #030305 60%)",
				}}
			/>

			{/* Starfield — 100 scattered stars */}
			{STARS.map((star) => (
				<div
					key={star.id}
					className="fixed rounded-full bg-white"
					style={
						{
							top: star.top,
							left: star.left,
							width: `${star.size}px`,
							height: `${star.size}px`,
							animationName: "twinkle",
							animationDuration: star.dur,
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDelay: star.delay,
							"--o1": star.o1,
							"--o2": star.o2,
						} as React.CSSProperties
					}
				/>
			))}

			{/* Film grain */}
			<div
				className="fixed"
				style={{
					inset: "-50%",
					width: "200%",
					height: "200%",
					opacity: 0.05,
					zIndex: 49,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					animationName: "grain",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(3)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Scanlines */}
			<div
				className="fixed inset-0"
				style={{
					zIndex: 50,
					opacity: 0.4,
					background:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
				}}
			/>

			{/* VHS scan line */}
			<div
				className="fixed left-0 right-0"
				style={{
					height: "2px",
					zIndex: 51,
					background:
						"linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
					animationName: "vhs-scan",
					animationDuration: "8s",
					animationTimingFunction: "linear",
					animationIterationCount: "infinite",
				}}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify in browser**

Run: `bun run dev`

Open any app page. Confirm:
- Night sky gradient visible (dark gradient from top)
- Stars are scattered randomly across the viewport (not in lines)
- Film grain flickers subtly
- VHS scan line moves top-to-bottom
- Scanlines visible as faint horizontal stripes

- [ ] **Step 3: Commit**

```bash
git add src/components/retro-overlays.tsx
git commit -m "feat: upgrade RetroOverlays with night sky, seeded PRNG stars, 100 count"
```

---

### Task 2: Make RetroOverlays render on all pages

**Files:**
- Modify: `src/routes/app/route.tsx`

- [ ] **Step 1: Remove the isTitlePage conditional**

In `src/routes/app/route.tsx`, remove the `useMatches` import (if no longer needed), the `isTitlePage` variable, and the conditional around `<RetroOverlays />`.

Change the imports from:

```tsx
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useMatches,
} from "@tanstack/react-router";
```

to:

```tsx
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
```

Change the component body from:

```tsx
function AppLayout() {
	const matches = useMatches();
	const isTitlePage = matches.some(
		(m) => m.routeId === "/app/title/$mediaType/$tmdbId",
	);

	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			{!isTitlePage && <RetroOverlays />}
```

to:

```tsx
function AppLayout() {
	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			<RetroOverlays />
```

- [ ] **Step 2: Verify in browser**

Navigate to a title detail page (e.g. `/app/title/movie/123`). Confirm stars, grain, VHS scan, and scanlines are now visible there too.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/route.tsx
git commit -m "feat: render RetroOverlays on all app pages including title pages"
```

---

### Task 3: Strip base effects from ShuffleAtmosphere

**Files:**
- Modify: `src/components/shuffle/shuffle-atmosphere.tsx`

- [ ] **Step 1: Remove duplicated effects and spotlights**

Replace the entire file with the additive-only version. Remove: STARS array, starfield, night sky gradient, film grain, scanlines, VHS scan, swaying spotlights. Keep: projector beam, dust particles, projector source glow, drive-in screen frame, vignette, amber ground glow, fog, dashboard, steering wheel, speaker box.

```tsx
const DUST_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
	id: i,
	left: `${42 + ((i * 7) % 16)}%`,
	size: 1 + ((i * 13) % 3) * 0.5,
	dur: `${4 + ((i * 11) % 6)}s`,
	delay: `${-((i * 17) % 8)}s`,
}));

export function ShuffleAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* ===== PROJECTOR BEAM — single cone with stacked radial gradients ===== */}
			<div
				className="fixed"
				style={{
					top: "-10%",
					left: "-10%",
					right: "-10%",
					height: "120%",
					clipPath: "polygon(42% 8%, 58% 8%, 72% 100%, 28% 100%)",
					background: [
						"radial-gradient(ellipse 18% 80% at 50% 8%, rgba(255,245,210,0.1) 0%, transparent 100%)",
						"radial-gradient(ellipse 30% 90% at 50% 8%, rgba(255,235,180,0.07) 0%, transparent 100%)",
						"radial-gradient(ellipse 45% 100% at 50% 8%, rgba(255,220,140,0.04) 0%, transparent 100%)",
					].join(", "),
					filter: "blur(20px)",
					animationName: "projector-flicker",
					animationDuration: "4s",
					animationTimingFunction: "steps(1)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Projector dust particles floating in the beam */}
			{DUST_PARTICLES.map((p) => (
				<div
					key={p.id}
					className="fixed rounded-full bg-white/60"
					style={{
						left: p.left,
						top: "5%",
						width: `${p.size}px`,
						height: `${p.size}px`,
						animationName: "dust-float",
						animationDuration: p.dur,
						animationTimingFunction: "linear",
						animationIterationCount: "infinite",
						animationDelay: p.delay,
					}}
				/>
			))}

			{/* Projector source glow — small bright spot at top center */}
			<div
				className="fixed left-1/2 top-0 -translate-x-1/2"
				style={{
					width: "80px",
					height: "40px",
					background:
						"radial-gradient(ellipse at 50% 0%, rgba(255,220,140,0.5) 0%, rgba(255,184,0,0.15) 50%, transparent 100%)",
					filter: "blur(8px)",
				}}
			/>

			{/* ===== DRIVE-IN SCREEN FRAME — structural posts ===== */}
			{/* Left post */}
			<div
				className="fixed hidden sm:block"
				style={{
					left: "calc(50% - 220px)",
					top: "15%",
					bottom: "35%",
					width: "3px",
					background:
						"linear-gradient(180deg, rgba(40,40,60,0.6) 0%, rgba(40,40,60,0.2) 100%)",
					borderRadius: "2px",
				}}
			/>
			{/* Right post */}
			<div
				className="fixed hidden sm:block"
				style={{
					right: "calc(50% - 220px)",
					top: "15%",
					bottom: "35%",
					width: "3px",
					background:
						"linear-gradient(180deg, rgba(40,40,60,0.6) 0%, rgba(40,40,60,0.2) 100%)",
					borderRadius: "2px",
				}}
			/>
			{/* Top crossbar */}
			<div
				className="fixed hidden sm:block"
				style={{
					left: "calc(50% - 220px)",
					right: "calc(50% - 220px)",
					top: "15%",
					height: "2px",
					background:
						"linear-gradient(90deg, rgba(40,40,60,0.4) 0%, rgba(40,40,60,0.6) 50%, rgba(40,40,60,0.4) 100%)",
				}}
			/>

			{/* Vignette overlay — strong dark edges like looking through a windshield */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 100%)",
					zIndex: 1,
				}}
			/>

			{/* Warm amber ground glow — screen reflecting off the ground */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "300px",
					background:
						"radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.04) 40%, transparent 70%)",
				}}
			/>

			{/* Low-lying fog — denser, atmospheric ground mist */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "140px",
					background:
						"radial-gradient(ellipse 130% 90% at 30% 100%, rgba(255,255,255,0.04) 0%, transparent 70%)",
					animationName: "fog-crawl",
					animationDuration: "18s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				}}
			/>
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "100px",
					background:
						"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.03) 0%, transparent 65%)",
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
					height: "80px",
					background:
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.025) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>

			{/* ===== CAR DASHBOARD SILHOUETTE ===== */}
			{/* Dashboard curve at bottom */}
			<div
				className="fixed inset-x-0 bottom-0 hidden md:block"
				style={{
					height: "80px",
					zIndex: 3,
					background:
						"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.07) 100%)",
					borderTop: "1px solid rgba(30,30,50,0.08)",
					borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
				}}
			/>
			{/* Steering wheel silhouette — subtle arc at bottom center */}
			<div
				className="fixed bottom-0 left-1/2 hidden md:block"
				style={{
					width: "140px",
					height: "60px",
					transform: "translateX(-50%)",
					zIndex: 4,
					border: "2px solid rgba(30,30,50,0.06)",
					borderBottom: "none",
					borderRadius: "70px 70px 0 0",
					opacity: 0.6,
				}}
			/>

			{/* ===== SPEAKER BOX — bottom-right corner ===== */}
			<div
				className="fixed hidden md:flex"
				style={{
					bottom: "90px",
					right: "24px",
					width: "36px",
					height: "52px",
					zIndex: 4,
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{/* Speaker wire */}
				<div
					style={{
						width: "2px",
						height: "16px",
						background: "rgba(40,40,60,0.15)",
						borderRadius: "1px",
					}}
				/>
				{/* Speaker body */}
				<div
					style={{
						width: "32px",
						height: "36px",
						background: "rgba(15,15,25,0.08)",
						border: "1px solid rgba(40,40,60,0.1)",
						borderRadius: "4px",
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gridTemplateRows: "repeat(4, 1fr)",
						gap: "2px",
						padding: "4px",
					}}
				>
					{/* Grill dots */}
					{Array.from({ length: 12 }, (_, i) => (
						<div
							key={`grill-${i.toString()}`}
							style={{
								width: "4px",
								height: "4px",
								borderRadius: "50%",
								background: "rgba(40,40,60,0.1)",
								justifySelf: "center",
								alignSelf: "center",
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify in browser**

Open `/app/shuffle`. Confirm:
- No spotlights swaying on left/right
- No duplicate stars (stars come from global RetroOverlays only)
- Projector beam, screen frame posts, dashboard, speaker box still visible
- VHS scan and grain come from the global layer behind

- [ ] **Step 3: Commit**

```bash
git add src/components/shuffle/shuffle-atmosphere.tsx
git commit -m "refactor: strip base effects and spotlights from ShuffleAtmosphere"
```

---

### Task 4: Strip base effects from TitlePageAtmosphere

**Files:**
- Modify: `src/components/title/title-page-atmosphere.tsx`

- [ ] **Step 1: Replace with additive-only version**

Replace the entire file with just the pink ground glow:

```tsx
export function TitlePageAtmosphere() {
	return (
		<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
			{/* Pink ground glow */}
			<div
				className="fixed bottom-0 left-0 right-0"
				style={{
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236, 72, 153, 0.15) 0%, transparent 70%)",
					zIndex: 1,
				}}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify in browser**

Open a title detail page. Confirm:
- Global stars, grain, VHS scan visible
- Pink ground glow still present at bottom
- No duplicate stars

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-page-atmosphere.tsx
git commit -m "refactor: strip base effects from TitlePageAtmosphere"
```

---

### Task 5: Strip base effects from WatchlistAtmosphere

**Files:**
- Modify: `src/components/watchlist/watchlist-atmosphere.tsx`

- [ ] **Step 1: Replace with additive-only version**

Replace the entire file with just the pink ground glow and fog layers:

```tsx
export function WatchlistAtmosphere() {
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
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.15) 0%, transparent 70%)",
				}}
			/>

			{/* Low-lying fog layers */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "120px",
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
					height: "100px",
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
					height: "80px",
					background:
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
		</div>
	);
}
```

- [ ] **Step 2: Verify in browser**

Open `/app/watchlists`. Confirm:
- Global stars, grain, VHS scan visible
- Pink ground glow and fog layers still present
- No duplicate stars

- [ ] **Step 3: Commit**

```bash
git add src/components/watchlist/watchlist-atmosphere.tsx
git commit -m "refactor: strip base effects from WatchlistAtmosphere"
```

---

### Task 6: Widen hidden titles grid and remove ShuffleAtmosphere

**Files:**
- Modify: `src/routes/app/shuffle/hidden.tsx`

- [ ] **Step 1: Remove ShuffleAtmosphere import and usage**

Remove the import line:

```tsx
import { ShuffleAtmosphere } from "#/components/shuffle/shuffle-atmosphere";
```

Remove the JSX usage:

```tsx
			<ShuffleAtmosphere />
```

- [ ] **Step 2: Widen the container and grid**

Change the container class from:

```tsx
			<div
				className="relative mx-auto max-w-2xl px-4 pt-6 pb-12"
				style={{ zIndex: 2 }}
			>
```

to:

```tsx
			<div
				className="relative mx-auto max-w-7xl px-6 pt-6 pb-12"
				style={{ zIndex: 2 }}
			>
```

Change both grid classes (the main grid and the skeleton grid) from:

```tsx
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
```

to:

```tsx
					<div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
```

Also update the skeleton count from 6 to 12 to fill the wider grid:

```tsx
						{Array.from({ length: 12 }, (_, i) => (
```

- [ ] **Step 3: Verify in browser**

Open `/app/shuffle/hidden`. Confirm:
- No drive-in elements (no projector beam, no screen posts)
- Global stars, grain, VHS scan visible from RetroOverlays
- Grid shows 6 columns on desktop, scales down responsively
- Grid fills the available width (no narrow centered column)
- Skeleton loading state shows 12 items

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/shuffle/hidden.tsx
git commit -m "feat: widen hidden titles grid to 6 columns, remove ShuffleAtmosphere"
```
