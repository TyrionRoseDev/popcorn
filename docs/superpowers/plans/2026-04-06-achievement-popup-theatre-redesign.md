# Achievement Popup Theatre Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the achievement celebration popup with a theatre/Oscars aesthetic — red curtain swag, stage floor, gold-bordered cards, and trophy emojis flanking the badges.

**Architecture:** Single component rewrite of `achievement-popup.tsx`. Replace the neon conic gradient card borders with gold gradients, add theatre set dressing (curtain swag SVG, curtain slivers, stage floor, spotlight), and position trophy emojis flanking the badge cards. Keep existing confetti particles, flip-in animations, and dialog structure.

**Tech Stack:** React, motion/react, Tailwind CSS, inline SVG

---

## Task 1: Restyle AchievementPopup with theatre theme

**Files:**
- Modify: `src/components/achievements/achievement-popup.tsx`

- [ ] **Step 1: Replace the keyframes**

Remove `ach-projector-sweep` and `ach-conic-spin` / `@property --ach-angle` keyframes. Add a new `ach-spotlight-pulse` keyframe. Keep `ach-particle-rise` and `ach-icon-glow-pulse` unchanged.

Replace the `<style>` block content (lines 51-86). The new keyframes:

```css
@keyframes ach-particle-rise {
    0% {
        transform: translateY(0) translateX(0) rotate(var(--rot)) scale(1);
        opacity: 0;
    }
    10% { opacity: 1; }
    80% { opacity: 0.8; }
    100% {
        transform: translateY(-85vh) translateX(var(--drift)) rotate(calc(var(--rot) + 720deg)) scale(0.3);
        opacity: 0;
    }
}
@keyframes ach-icon-glow-pulse {
    0%, 100% {
        text-shadow: 0 0 12px rgba(255,184,0,0.6), 0 0 30px rgba(255,184,0,0.4), 0 0 60px rgba(255,184,0,0.2);
    }
    50% {
        text-shadow: 0 0 18px rgba(255,184,0,0.9), 0 0 45px rgba(255,184,0,0.6), 0 0 90px rgba(255,184,0,0.3);
    }
}
@keyframes ach-spotlight-pulse {
    0%, 100% { opacity: 0.08; }
    50% { opacity: 0.12; }
}
```

- [ ] **Step 2: Replace the projector sweep beam with theatre set dressing**

Replace the projector sweep `<div>` (lines 106-118) and everything inside the outer `<div className="flex items-center justify-center...">` up to the `{/* Particles */}` comment with the theatre elements:

```tsx
{/* Curtain swag valance */}
<svg
    aria-hidden="true"
    className="pointer-events-none absolute top-0 left-0 right-0 z-20"
    viewBox="0 0 500 50"
    style={{ width: "100%", height: "50px" }}
    preserveAspectRatio="none"
>
    <defs>
        <linearGradient id="ach-velvet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B0000" />
            <stop offset="25%" stopColor="#DC143C" />
            <stop offset="55%" stopColor="#A00020" />
            <stop offset="100%" stopColor="#5C0000" />
        </linearGradient>
    </defs>
    <path
        d="M0,0 L0,12 Q62,50 125,12 Q187,50 250,12 Q312,50 375,12 Q437,50 500,12 L500,0 Z"
        fill="url(#ach-velvet)"
    />
</svg>

{/* Left curtain sliver */}
<div
    aria-hidden="true"
    className="pointer-events-none absolute top-0 left-0 z-10"
    style={{
        width: "8%",
        height: "100%",
        background: "linear-gradient(90deg, #4a0000, #8B0000, #DC143C)",
        boxShadow: "inset -8px 0 15px rgba(0,0,0,0.5), 3px 0 10px rgba(0,0,0,0.5)",
    }}
/>

{/* Right curtain sliver */}
<div
    aria-hidden="true"
    className="pointer-events-none absolute top-0 right-0 z-10"
    style={{
        width: "8%",
        height: "100%",
        background: "linear-gradient(270deg, #4a0000, #8B0000, #DC143C)",
        boxShadow: "inset 8px 0 15px rgba(0,0,0,0.5), -3px 0 10px rgba(0,0,0,0.5)",
    }}
/>

{/* Spotlight cone */}
<div
    aria-hidden="true"
    className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-[1]"
    style={{
        top: "50px",
        width: "250px",
        height: "calc(100% - 50px)",
        background: "radial-gradient(ellipse at center top, rgba(255,240,200,0.1) 0%, transparent 70%)",
        animation: "ach-spotlight-pulse 4s ease-in-out infinite",
    }}
/>

{/* Stage floor */}
<div
    aria-hidden="true"
    className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
    style={{
        height: "55px",
        background: "linear-gradient(180deg, #2a1508 0%, #1a0c04 40%, #0f0802 100%)",
    }}
/>
<div
    aria-hidden="true"
    className="pointer-events-none absolute bottom-[53px] left-[20%] right-[20%] z-10"
    style={{
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,184,0,0.1), transparent)",
    }}
/>
```

- [ ] **Step 3: Restructure the modal content to include trophies**

Replace the `{/* Modal card */}` motion.div and its contents (lines 144-250) with a new layout that positions trophies flanking the card(s):

```tsx
{/* Center content: trophies + cards */}
<motion.div
    className="relative z-10 flex flex-col items-center gap-6 text-center"
    initial={{ scale: 0.9, y: 20, opacity: 0 }}
    animate={{ scale: 1, y: 0, opacity: 1 }}
    exit={{ scale: 0.9, y: -20, opacity: 0 }}
    transition={{ type: "spring", damping: 18, stiffness: 220 }}
>
    {/* "Achievement(s) Unlocked" label */}
    <p
        className="font-mono-retro text-xs uppercase tracking-[5px]"
        style={{
            color: "rgba(255,184,0,0.9)",
            textShadow: "0 0 15px rgba(255,184,0,0.5)",
        }}
    >
        {isSingle ? "Achievement Unlocked" : "Achievements Unlocked"}
    </p>

    {/* Trophies + cards row */}
    <div className="flex items-center gap-5">
        {/* Left trophy */}
        <motion.div
            className="text-[72px] leading-none"
            style={{
                filter: "drop-shadow(0 0 24px rgba(255,184,0,0.7)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))",
                transform: "rotate(-5deg)",
                marginTop: "30px",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.3 }}
        >
            🏆
        </motion.div>

        {/* Badge cards */}
        <div
            className="flex flex-wrap justify-center gap-4"
            style={{ perspective: "800px" }}
        >
            {achievements.map((achievement, i) => (
                <motion.div
                    key={achievement.id}
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
                            width: achievements.length >= 3 ? "150px" : "180px",
                            height: achievements.length >= 3 ? "190px" : "220px",
                            padding: "3px",
                            background: "linear-gradient(135deg, #FFD700 0%, #B8860B 25%, #DAA520 50%, #B8860B 75%, #FFD700 100%)",
                            boxShadow: "0 0 40px rgba(255,184,0,0.3), 0 8px 32px rgba(0,0,0,0.5)",
                        }}
                    >
                        {/* Inner card fill */}
                        <div
                            className="absolute inset-[3px] rounded-2xl"
                            style={{ background: "linear-gradient(180deg, #1a1020, #0f0a18)" }}
                        />

                        {/* Icon */}
                        <div
                            className="relative z-10 leading-none"
                            style={{
                                fontSize: achievements.length >= 3 ? "44px" : "56px",
                                animation: "ach-icon-glow-pulse 2s ease-in-out infinite",
                                textShadow: "0 0 12px rgba(255,184,0,0.7), 0 0 30px rgba(255,184,0,0.4)",
                            }}
                        >
                            {achievement.icon}
                        </div>

                        {/* Name on badge */}
                        <p
                            className="relative z-10 font-display px-3 text-center leading-tight"
                            style={{
                                fontSize: achievements.length >= 3 ? "14px" : "18px",
                                color: "#FFD700",
                                textShadow: "0 0 10px rgba(255,184,0,0.4)",
                            }}
                        >
                            {achievement.name}
                        </p>

                        {/* Description on badge */}
                        <p
                            className="relative z-10 font-sans text-center leading-snug px-3"
                            style={{
                                fontSize: achievements.length >= 3 ? "9px" : "12px",
                                color: "rgba(245,240,232,0.8)",
                            }}
                        >
                            {achievement.description}
                        </p>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Right trophy */}
        <motion.div
            className="text-[72px] leading-none"
            style={{
                filter: "drop-shadow(0 0 24px rgba(255,184,0,0.7)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))",
                transform: "rotate(5deg)",
                marginTop: "30px",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.3 }}
        >
            🏆
        </motion.div>
    </div>

    {/* Progress count */}
    <motion.p
        className="font-mono-retro text-xs tracking-[2px]"
        style={{ color: "rgba(255,184,0,0.6)" }}
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
        className="relative overflow-hidden rounded-full px-8 py-3 font-mono-retro text-sm uppercase tracking-[3px] transition-all active:scale-95"
        style={{
            border: "1px solid rgba(255,184,0,0.45)",
            color: "rgba(255,184,0,0.75)",
            background: "rgba(255,184,0,0.08)",
        }}
        whileHover={{
            borderColor: "rgba(255,184,0,0.8)",
            background: "rgba(255,184,0,0.15)",
            boxShadow: "0 0 24px rgba(255,184,0,0.25)",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
    >
        Continue
    </motion.button>
</motion.div>
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build completes without errors.

- [ ] **Step 5: Manual visual check**

Start dev server: `bun run dev`
Trigger an achievement and verify:
- Red curtain swag drapes across the top (scalloped, no gold bar)
- Thin red curtain slivers at left/right edges
- Stage floor gradient at bottom
- Spotlight illuminates center with slow pulse
- Gold-bordered badge card(s) centered
- Achievement name in gold, description in bright cream
- Two trophy emojis flanking the cards with gold glow
- Confetti particles still tumbling over everything
- Continue button on the stage area

- [ ] **Step 6: Commit**

```bash
git add src/components/achievements/achievement-popup.tsx
git commit -m "feat: redesign achievement popup with theatre/Oscars theme"
```
