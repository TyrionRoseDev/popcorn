# Ticket Stub Transition & Spotlight Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard hero→marquee color transition with a retro ticket stub, fix spotlight positioning/speed, and add breathing room.

**Architecture:** Pure frontend — 1 new component (`ticket-stub.tsx`), edits to 3 existing files. No backend, no data, no routing changes. All CSS-only animations.

**Tech Stack:** React, Tailwind CSS v4, existing `Righteous` + `Space Mono` fonts.

**Spec:** `docs/superpowers/specs/2026-03-22-ticket-stub-spotlight-redesign.md`

---

### File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/styles.css` | Modify (lines 411-419) | Update sway keyframes, add ticket-glow keyframe |
| `src/components/ticket-stub.tsx` | Create | Decorative ticket stub component |
| `src/components/spotlight.tsx` | Modify (lines 90-135) | Reposition beams closer, speed up animations |
| `src/routes/index.tsx` | Modify (lines 91-118) | Restructure layout — remove first FilmStrip, merge into combined section |

---

### Task 1: Update CSS Keyframes

**Files:**
- Modify: `src/styles.css:411-419` (sway keyframes)
- Modify: `src/styles.css:409` (insert after footer-flicker, before sway-left)

- [ ] **Step 1: Update sway-left keyframe**

In `src/styles.css`, change the `sway-left` keyframe (lines 411-414):

```css
/* BEFORE */
@keyframes sway-left {
  0% { transform: rotate(-4deg); }
  100% { transform: rotate(6deg); }
}

/* AFTER */
@keyframes sway-left {
  0% { transform: rotate(-10deg); }
  100% { transform: rotate(16deg); }
}
```

- [ ] **Step 2: Update sway-right keyframe**

In `src/styles.css`, change the `sway-right` keyframe (lines 416-419):

```css
/* BEFORE */
@keyframes sway-right {
  0% { transform: rotate(4deg); }
  100% { transform: rotate(-6deg); }
}

/* AFTER */
@keyframes sway-right {
  0% { transform: rotate(10deg); }
  100% { transform: rotate(-16deg); }
}
```

- [ ] **Step 3: Verify dev server compiles without errors**

Run: `npm run dev` (if not already running) and check the terminal for CSS compilation errors.

---

### Task 2: Create Ticket Stub Component

**Files:**
- Create: `src/components/ticket-stub.tsx`

- [ ] **Step 1: Create the ticket stub component**

Create `src/components/ticket-stub.tsx` with the full component:

```tsx
export function TicketStub() {
	return (
		<div className="relative mx-auto max-w-md px-4">
			<div
				className="group relative"
				style={{
					background:
						"linear-gradient(165deg, #f5e6c8 0%, #ecdbb2 40%, #f0ddb5 70%, #e8d0a5 100%)",
					borderRadius: "6px",
					boxShadow:
						"0 2px 8px rgba(0,0,0,0.25), 0 8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(255,184,0,0.06), inset 0 1px 0 rgba(255,255,255,0.35)",
				}}
			>
				{/* Left notch */}
				<div
					className="absolute left-0 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						background: "#070714",
						boxShadow: "inset 2px 0 6px rgba(0,0,0,0.3)",
					}}
				/>
				{/* Right notch */}
				<div
					className="absolute right-0 top-1/2 h-7 w-7 translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						background: "#070714",
						boxShadow: "inset -2px 0 6px rgba(0,0,0,0.3)",
					}}
				/>

				<div className="flex items-stretch">
					{/* Left stub */}
					<div className="relative flex w-12 shrink-0 items-center justify-center">
						<div className="absolute bottom-3 right-0 top-3 w-px border-r border-dashed border-[#c4a870]/35" />
						<span className="rotate-180 font-mono-retro text-[7px] uppercase tracking-[3px] text-[#8b7050]/60 [writing-mode:vertical-lr]">
							Admit One
						</span>
					</div>

					{/* Center content */}
					<div className="flex-1 py-7 text-center">
						<p className="font-mono-retro text-[7px] uppercase tracking-[4px] text-[#9a825e]">
							✦ Popcorn Drive-In ✦
						</p>

						{/* Decorative divider */}
						<div className="mx-auto my-3 flex max-w-[180px] items-center gap-3">
							<div className="h-px flex-1 bg-[#c4a870]/30" />
							<span className="font-mono-retro text-[8px] text-[#b8986a]">
								♦
							</span>
							<div className="h-px flex-1 bg-[#c4a870]/30" />
						</div>

						<p
							className="font-display text-xl text-[#3d2810]"
							style={{
								textShadow: "1px 1px 0 rgba(255,255,255,0.3)",
							}}
						>
							Admit One
						</p>

						{/* Decorative divider */}
						<div className="mx-auto my-3 flex max-w-[180px] items-center gap-3">
							<div className="h-px flex-1 bg-[#c4a870]/30" />
							<span className="font-mono-retro text-[8px] text-[#b8986a]">
								✦
							</span>
							<div className="h-px flex-1 bg-[#c4a870]/30" />
						</div>

						<p className="font-mono-retro text-[7px] tracking-[2px] text-[#9a825e]">
							SCREEN 01 · No. 000001
						</p>
					</div>

					{/* Right stub */}
					<div className="relative flex w-12 shrink-0 items-center justify-center">
						<div className="absolute bottom-3 left-0 top-3 w-px border-l border-dashed border-[#c4a870]/35" />
						<span className="font-mono-retro text-[7px] uppercase tracking-[3px] text-[#8b7050]/60 [writing-mode:vertical-lr]">
							Admit One
						</span>
					</div>
				</div>

				{/* Paper texture overlay */}
				<div
					className="pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.03]"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					}}
				/>

				{/* Hover glow overlay (CSS-only via group-hover) */}
				<div
					className="pointer-events-none absolute -inset-1 rounded-lg opacity-0 transition-opacity duration-700 group-hover:opacity-100"
					style={{
						boxShadow: "0 0 80px rgba(255,184,0,0.1)",
					}}
				/>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Verify the component imports and renders**

Check that the dev server shows no TypeScript errors for the new file.

---

### Task 3: Update Spotlight Positioning

**Files:**
- Modify: `src/components/spotlight.tsx:90-135` (the `Spotlights` component)

- [ ] **Step 1: Update the left spotlight**

In `src/components/spotlight.tsx`, update the left spotlight wrapper div (lines 94-108). Change these style properties:

```
width:             "65vw"  →  "55vw"
maxWidth:          "850px" →  "750px"
bottom:            "-5%"   →  "-8%"
left:              "-20%"  →  "0%"
animationDuration: "8s"    →  "5s"
```

All other properties stay the same.

- [ ] **Step 2: Update the right spotlight**

Update the right spotlight wrapper div (lines 114-130). Change these style properties:

```
width:             "55vw"  →  "48vw"
maxWidth:          "720px" →  "650px"
bottom:            "-5%"   →  "-8%"
right:             "-20%"  →  "0%"
animationDuration: "7s"    →  "4.5s"
```

All other properties stay the same.

- [ ] **Step 3: Verify spotlights render**

Check the dev server — spotlights should now sweep closer to center with faster, wider arcs.

---

### Task 4: Restructure Landing Page Layout

**Files:**
- Modify: `src/routes/index.tsx:1-138`

- [ ] **Step 1: Add TicketStub import**

Add to the imports at the top of `src/routes/index.tsx`:

```tsx
import { TicketStub } from "#/components/ticket-stub";
```

- [ ] **Step 2: Replace the first FilmStrip and marquee section**

Replace lines 91-116 (the first `<FilmStrip />` through the end of the marquee `</section>`):

```tsx
{/* BEFORE: */}
<FilmStrip />

{/* ========== SPOTLIGHT + MARQUEE BOARD ========== */}
<section className="relative overflow-hidden bg-drive-in-card px-4 py-20 sm:px-8">
  <Spotlights />
  {/* Vignette */}
  <div ... />
  <MarqueeBoard ...>...</MarqueeBoard>
</section>
```

With:

```tsx
{/* ========== TICKET + MARQUEE SECTION ========== */}
<section
  className="relative overflow-hidden px-4 sm:px-8"
  style={{
    background:
      "linear-gradient(180deg, #050508 0%, #070714 15%, #0a0a1e 40%, #0a0a1e 100%)",
  }}
>
  {/* Ticket stub */}
  <div className="relative z-10 pb-12 pt-16">
    <TicketStub />
  </div>

  <Spotlights />

  {/* Vignette */}
  <div
    className="pointer-events-none absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at center, transparent 30%, rgba(8,8,26,0.4) 100%)",
      zIndex: 3,
    }}
  />

  <div className="relative z-10 pb-24">
    <MarqueeBoard title="Tonight's Programme">
      {FEATURES.map((feature) => (
        <MarqueeBoardRow
          key={feature}
          label={feature}
          status="Coming Soon"
        />
      ))}
    </MarqueeBoard>
  </div>
</section>
```

Key changes:
- Removed the first `<FilmStrip />`
- Replaced `bg-drive-in-card` with inline gradient style
- Removed `py-20`, replaced with wrapper divs that control padding per element
- Ticket stub wrapped in `pt-16 pb-12` div
- MarqueeBoard wrapped in `pb-24` div
- Both content wrappers get `relative z-10` to sit above spotlights

- [ ] **Step 3: Verify the full page renders correctly**

Check the dev server at `localhost:3000` (or configured port). Verify:
- Smooth gradient transition from hero into the combined section
- Ticket stub renders centered with warm parchment styling
- Spotlights sweep across the marquee area
- Marquee board has generous vertical padding
- Film strip still appears before footer
- No console errors

- [ ] **Step 4: Commit all changes**

```bash
git add src/styles.css src/components/ticket-stub.tsx src/components/spotlight.tsx src/routes/index.tsx
git commit -m "feat: add ticket stub transition, fix spotlight positioning"
```
