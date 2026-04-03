# Arcade Button Active States & Click Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make arcade button active states dramatically more visible with a Plasma Core animated gradient, and add satisfying Scale Bounce + Flash click feedback.

**Architecture:** Two files change. `arcade-button.tsx` gets new active styling (animated gradient, white icon, brighter glow, colored label) and click animation logic (CSS keyframe triggered via React ref). `title-actions.tsx` adds an `isBookmarked` query to light up the Watchlist button when the film is on any list. Two keyframe animations are added to `styles.css`.

**Tech Stack:** React, Tailwind CSS v4, CSS keyframes, tRPC + React Query

---

### Task 1: Add CSS keyframes to styles.css

**Files:**
- Modify: `src/styles.css` (append after the existing `@keyframes` block around line 555)

- [ ] **Step 1: Add the plasma-shift keyframe**

Add this after the existing `@keyframes celebration-fade-in` block (around line 570):

```css
@keyframes plasma-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

- [ ] **Step 2: Add the arcade-bounce keyframe**

Add this immediately after `plasma-shift`:

```css
@keyframes arcade-bounce {
  0% { transform: scale(1); }
  15% { transform: scale(0.85); filter: brightness(0.8); }
  40% { transform: scale(1.15); filter: brightness(1.4); }
  60% { transform: scale(0.95); }
  80% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
```

Note: We use `filter: brightness()` instead of `box-shadow` in the keyframe because the box-shadow values differ per color and are already set on the element. The brightness filter creates the flash/dim effect universally.

- [ ] **Step 3: Verify the dev server compiles without errors**

Run: `bun run dev`
Expected: No CSS compilation errors. Page loads normally.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css
git commit -m "feat: add plasma-shift and arcade-bounce keyframe animations"
```

---

### Task 2: Update ArcadeButton with Plasma Core active state

**Files:**
- Modify: `src/components/title/arcade-button.tsx`

- [ ] **Step 1: Update the colorConfig to add Plasma Core active styles**

Replace the entire `colorConfig` object with:

```tsx
const colorConfig = {
  pink: {
    border: "border-neon-pink",
    bg: "bg-neon-pink/20",
    text: "text-neon-pink",
    shadow:
      "shadow-[0_5px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
    shadowHover:
      "hover:shadow-[0_3px_0_rgba(255,45,120,0.35),0_0_20px_rgba(255,45,120,0.2)]",
    ringBorder: "border-neon-pink",
    // Plasma Core active state
    activeGradient:
      "linear-gradient(270deg, rgba(255,45,120,0.6), rgba(200,20,80,0.3), rgba(255,100,160,0.5), rgba(255,45,120,0.6))",
    activeShadow:
      "shadow-[0_2px_0_rgba(255,45,120,0.4),0_0_30px_rgba(255,45,120,0.35),0_0_60px_rgba(255,45,120,0.15)]",
    activeIconGlow: "drop-shadow(0 0 3px rgba(255,45,120,0.8))",
    activeLabel: "text-neon-pink",
  },
  cyan: {
    border: "border-neon-cyan",
    bg: "bg-neon-cyan/12",
    text: "text-neon-cyan",
    shadow:
      "shadow-[0_5px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
    shadowHover:
      "hover:shadow-[0_3px_0_rgba(0,229,255,0.2),0_0_12px_rgba(0,229,255,0.15)]",
    ringBorder: "border-neon-cyan",
    // Plasma Core active state
    activeGradient:
      "linear-gradient(270deg, rgba(0,229,255,0.6), rgba(0,150,200,0.3), rgba(80,240,255,0.5), rgba(0,229,255,0.6))",
    activeShadow:
      "shadow-[0_2px_0_rgba(0,229,255,0.4),0_0_30px_rgba(0,229,255,0.35),0_0_60px_rgba(0,229,255,0.15)]",
    activeIconGlow: "drop-shadow(0 0 3px rgba(0,229,255,0.8))",
    activeLabel: "text-neon-cyan",
  },
  amber: {
    border: "border-neon-amber",
    bg: "bg-neon-amber/12",
    text: "text-neon-amber",
    shadow:
      "shadow-[0_5px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
    shadowHover:
      "hover:shadow-[0_3px_0_rgba(255,184,0,0.2),0_0_12px_rgba(255,184,0,0.12)]",
    ringBorder: "border-neon-amber",
    // Plasma Core active state
    activeGradient:
      "linear-gradient(270deg, rgba(255,184,0,0.6), rgba(200,140,0,0.3), rgba(255,210,80,0.5), rgba(255,184,0,0.6))",
    activeShadow:
      "shadow-[0_2px_0_rgba(255,184,0,0.4),0_0_30px_rgba(255,184,0,0.35),0_0_60px_rgba(255,184,0,0.15)]",
    activeIconGlow: "drop-shadow(0 0 3px rgba(255,184,0,0.8))",
    activeLabel: "text-neon-amber",
  },
};
```

Key differences from the old config:
- Removed `activeBg` and `activeShadow` (the old subtle ones)
- Added `activeGradient` (inline style string for the animated gradient)
- Added new `activeShadow` (wider/brighter box-shadow for Plasma Core)
- Added `activeIconGlow` (drop-shadow filter for the white icon)
- Added `activeLabel` (neon color class for the label text)

- [ ] **Step 2: Add click animation state and update the component**

Replace the entire `ArcadeButton` function with:

```tsx
export function ArcadeButton({
  icon: Icon,
  label,
  color,
  active,
  onClick,
}: ArcadeButtonProps) {
  const c = colorConfig[color];
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleClick() {
    // Trigger bounce animation
    const btn = buttonRef.current;
    if (btn) {
      btn.style.animation = "none";
      btn.offsetHeight; // reflow
      btn.style.animation = "arcade-bounce 0.5s ease-out";
      btn.addEventListener(
        "animationend",
        () => {
          // Clear imperative override so React's style prop (plasma-shift) resumes
          btn.style.animation = "";
        },
        { once: true },
      );
    }
    onClick?.();
  }

  return (
    <div className="text-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={buttonRef}
              type="button"
              onClick={handleClick}
              className={cn(
                "size-16 rounded-full border-[3px] flex items-center justify-center",
                "relative cursor-pointer transition",
                "hover:translate-y-[2px]",
                c.border,
                active
                  ? cn(c.activeShadow, "translate-y-[2px]")
                  : cn(c.bg, c.shadow, c.shadowHover),
              )}
              style={
                active
                  ? {
                      background: c.activeGradient,
                      backgroundSize: "300% 300%",
                      animation: "plasma-shift 3s ease infinite",
                    }
                  : undefined
              }
            >
              {/* Outer glow ring */}
              <div
                aria-hidden="true"
                className={cn(
                  "absolute rounded-full border opacity-30 pointer-events-none",
                  "transition-[inset,opacity]",
                  active ? "inset-[-10px] opacity-15" : "inset-[-6px]",
                  "hover:inset-[-10px] hover:opacity-15",
                  c.ringBorder,
                )}
              />

              {/* Inner concave depth — only when inactive */}
              {!active && (
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute rounded-full pointer-events-none",
                    "inset-[3px]",
                    c.bg,
                  )}
                  style={{ filter: "brightness(0.6)" }}
                />
              )}

              {/* Icon */}
              <Icon
                className={cn(
                  "w-6 h-6 relative z-10",
                  active ? "text-white" : c.text,
                )}
                style={active ? { filter: c.activeIconGlow } : undefined}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={8}>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div
        className={cn(
          "text-sm mt-2.5 text-center tracking-[0.3px]",
          active ? cn("font-bold", c.activeLabel) : "font-semibold",
        )}
        style={active ? undefined : { color: "#fffff0" }}
      >
        {label}
      </div>
    </div>
  );
}
```

Key changes:
- Added `useRef` for the button element to trigger click animations
- `handleClick` resets and re-triggers the `arcade-bounce` CSS animation on every click
- Active state uses inline `style` for the animated gradient (since Tailwind can't express animated gradients)
- Active icon is white with colored drop-shadow glow
- Active label uses the button's neon color + bold
- Inner concave depth div is hidden when active (the gradient replaces it)
- Note: when active, the click animation (`arcade-bounce`) imperatively overrides `plasma-shift`. The `animationend` listener clears the imperative style, letting React's `style` prop re-assert `plasma-shift`.

- [ ] **Step 3: Add the useRef import**

Update the import line at the top of the file. Change:

```tsx
import { cn } from "#/lib/utils";
```

The file doesn't currently import React hooks. Add `useRef` at the top of the file:

```tsx
import { useRef } from "react";
```

- [ ] **Step 4: Verify the component compiles**

Run: `bun run dev`
Expected: No TypeScript or build errors. Navigate to any title page to see the buttons.

- [ ] **Step 5: Commit**

```bash
git add src/components/title/arcade-button.tsx
git commit -m "feat: add Plasma Core active state and bounce click animation to arcade buttons"
```

---

### Task 3: Wire up Watchlist active state in TitleActions

**Files:**
- Modify: `src/components/title/title-actions.tsx:76-82` (queries section)
- Modify: `src/components/title/title-actions.tsx:289-293` (Watchlist button JSX)

- [ ] **Step 1: Add the isBookmarked query**

In `title-actions.tsx`, after the existing `isWatched` query (line 80-82), add:

```tsx
const { data: isBookmarked } = useQuery(
  trpc.watchlist.isBookmarked.queryOptions({ tmdbId, mediaType }),
);
```

This query already exists in the tRPC router (`src/integrations/trpc/routers/watchlist.ts:242`) and returns a boolean. It's already invalidated by `addItemMutation`, `quickWatchedMutation`, and `removeItemMutation` in this file.

- [ ] **Step 2: Pass active prop to the Watchlist ArcadeButton**

Find the Watchlist button JSX (around line 292):

```tsx
<ArcadeButton icon={Plus} label="Watchlist" color="pink" />
```

Replace with:

```tsx
<ArcadeButton icon={Plus} label="Watchlist" color="pink" active={!!isBookmarked} />
```

- [ ] **Step 3: Verify end-to-end**

Run: `bun run dev`

Manual verification checklist:
1. Navigate to a title page for a film NOT on any watchlist and NOT watched
   - All three buttons should be in their default inactive state
2. Click "Watched" — button should bounce, then light up with the cyan Plasma Core animation
3. Click "Watchlist" → add to a list — button should bounce on click, then light up with pink Plasma Core after the mutation completes
4. Click the lit-up Watchlist button again — it should still bounce and open the popover (can add to more lists)
5. The Invite button should never show an active state

- [ ] **Step 4: Commit**

```bash
git add src/components/title/title-actions.tsx
git commit -m "feat: light up Watchlist button when film is on a list"
```
