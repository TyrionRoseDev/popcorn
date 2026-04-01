# Watch History Neon Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the watch history cards from plain bordered cards to a "Neon Journal" aesthetic with glowing amber borders, star bloom, cyan accents, and a scrollable container when entries overflow.

**Architecture:** Pure CSS/Tailwind restyling of the existing `WatchEventCard` component and a scroll wrapper in `TitleActions`. No data model, API, or behavioral changes. One custom scrollbar utility added to `styles.css`.

**Tech Stack:** React, Tailwind CSS v4, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-01-watch-history-neon-journal-design.md`

---

### Task 1: Add custom scrollbar utility to styles.css

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add the scrollbar utility class**

Add this after the existing `@layer base` block (around line 357):

```css
/* Amber-tinted thin scrollbar for watch history */
.scrollbar-amber::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-amber::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-amber::-webkit-scrollbar-thumb {
  background: rgba(255, 184, 0, 0.25);
  border-radius: 9999px;
}
.scrollbar-amber {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 184, 0, 0.25) transparent;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add amber scrollbar utility class"
```

---

### Task 2: Restyle WatchEventCard to Neon Journal aesthetic

**Files:**
- Modify: `src/components/watched/watch-event-card.tsx`

This component is used in three places (title page, feed, profile diary). The restyling applies everywhere.

- [ ] **Step 1: Replace the card wrapper classes**

In `watch-event-card.tsx`, the card's outer `<div>` is at line 135. Replace the current wrapper:

```tsx
// OLD (line 135):
<div className="rounded-lg border border-drive-in-border p-3 transition-colors hover:bg-cream/[0.03]">

// NEW:
<div className="relative rounded-[10px] border border-[rgba(255,184,0,0.2)] p-4 transition-colors hover:border-[rgba(255,184,0,0.3)]"
  style={{
    background: 'linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)',
    boxShadow: '0 0 12px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,255,240,0.03)',
  }}
>
  {/* Warm radial light overlay */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 rounded-[10px]"
    style={{
      background: 'radial-gradient(ellipse at top left, rgba(255,184,0,0.06), transparent 50%)',
    }}
  />
```

All existing children remain inside this wrapper (they just need `relative z-10` to sit above the overlay — see next steps).

- [ ] **Step 2: Update the actor header block**

The actor block (lines 136-163) needs `relative z-10` added. No other changes to this block — it only shows in feed context, not on the title page.

```tsx
{actor && (
  <div className="relative z-10 flex items-center gap-2 mb-2">
    {/* ... existing actor content unchanged ... */}
  </div>
)}
```

- [ ] **Step 3: Restyle the content body**

The content body `<div>` at line 164 needs `relative z-10`. Then restyle the child elements:

```tsx
<div className="relative z-10 flex items-start justify-between gap-2">
  <div className="min-w-0 flex-1">
    {/* showTitle link — unchanged */}
    {showTitle && (
      <Link
        to="/app/title/$mediaType/$tmdbId"
        params={{
          mediaType: event.mediaType as "movie" | "tv",
          tmdbId: event.tmdbId,
        }}
        className="text-sm font-semibold text-cream/90 hover:text-cream no-underline"
      >
        {showTitle.name}
      </Link>
    )}

    {/* Stars — larger with amber glow */}
    {event.rating && (
      <div className="flex items-center gap-1 mt-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`h-[15px] w-[15px] ${
              s <= (event.rating ?? 0)
                ? "text-neon-amber fill-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.5)]"
                : "text-cream/[0.08]"
            }`}
          />
        ))}
      </div>
    )}

    {/* Date — amber-tinted Space Mono */}
    {!actor && (
      <div className="font-mono-retro text-[10px] tracking-[1px] text-[rgba(255,184,0,0.45)] mt-1.5">
        {formatDate(event.watchedAt)}
      </div>
    )}

    {/* Divider — amber gradient line (only show if there are companions or a note) */}
    {(companionText || event.note) && (
      <div
        className="h-px mt-2.5 mb-2"
        style={{
          background: 'linear-gradient(90deg, rgba(255,184,0,0.2), transparent 80%)',
        }}
      />
    )}

    {/* Companions — cyan dot prefix */}
    {companionText && (
      <div className="flex items-center gap-1.5 text-[11px] text-cream/30">
        <span className="inline-block h-1 w-1 rounded-full bg-[rgba(0,229,255,0.5)] shrink-0" />
        {companionText}
      </div>
    )}

    {/* Note — cyan quote bar */}
    {event.note && (
      <p className="relative text-[12.5px] leading-[1.6] text-cream/55 mt-1.5 pl-3 line-clamp-2 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:rounded-full before:bg-[rgba(0,229,255,0.2)]">
        {event.note}
      </p>
    )}
  </div>

  {/* Menu popover — unchanged except z-10 */}
  {isOwn && (
    <Popover
      open={menuOpen}
      onOpenChange={(o) => {
        setMenuOpen(o);
        if (!o) setConfirmDelete(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1 text-cream/20 hover:text-cream/50 transition-colors shrink-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className="bg-drive-in-card border border-drive-in-border rounded-lg shadow-xl p-1 w-40"
      >
        <button
          type="button"
          onClick={handleEdit}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-cream/5 text-sm text-cream/70 hover:text-cream transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteEvent.isPending}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-red-500/10 text-sm transition-colors ${
            confirmDelete
              ? "text-red-400 font-medium"
              : "text-red-400/70 hover:text-red-400"
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmDelete ? "Confirm Delete" : "Delete"}
        </button>
      </PopoverContent>
    </Popover>
  )}
</div>
```

- [ ] **Step 4: Verify in browser**

Run: `bun run dev`

Check the watch history section on a title page where you have watch events. Confirm:
- Amber glow border and radial light overlay visible
- Stars have amber drop-shadow bloom
- Date is in Space Mono with amber tint
- Amber gradient divider separates header from body
- Companions have cyan dot prefix
- Note has cyan left quote-bar
- Menu popover still works

Also check the feed page and profile diary page to confirm the restyling looks good there too.

- [ ] **Step 5: Commit**

```bash
git add src/components/watched/watch-event-card.tsx
git commit -m "feat: restyle WatchEventCard to neon journal aesthetic"
```

---

### Task 3: Add scrollable container with fade mask to TitleActions

**Files:**
- Modify: `src/components/title/title-actions.tsx`

- [ ] **Step 1: Wrap the watch event list in a scrollable container**

In `title-actions.tsx`, the watch history section starts at line 260. Replace the list wrapper:

```tsx
{watchEvents && watchEvents.length > 0 && (
  <div className="mt-6 mx-auto max-w-sm">
    <div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3 text-center">
      Your Watch History
    </div>
    <div className="relative">
      <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto scrollbar-amber pr-1">
        {watchEvents.map((event) => (
          <WatchEventCard
            key={event.id}
            event={event}
            isOwn={true}
            onEdit={(e) => {
              setEditEvent(e);
              setReviewOpen(true);
            }}
          />
        ))}
      </div>
      {/* Bottom fade hint — always present, invisible when not scrollable */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-[10px]"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(5,5,8,0.9))',
        }}
      />
    </div>
  </div>
)}
```

Key changes from the original:
- `gap-2` → `gap-2.5` (slightly more breathing room between neon journal cards)
- Added `max-h-[360px] overflow-y-auto scrollbar-amber pr-1` on the list wrapper
- Wrapped in a `relative` container with a bottom fade gradient overlay
- Fade overlay uses the page background color `rgba(5,5,8,0.9)` to blend seamlessly

- [ ] **Step 2: Verify in browser**

Run: `bun run dev`

Test with a title that has 1 watch event — confirm no scrollbar appears and fade is barely noticeable. If possible, temporarily add extra events (or test on a title with many) to confirm:
- Scrollbar appears when content exceeds ~360px
- Scrollbar is thin with amber thumb
- Bottom fade gradient hints at more content below
- Scrolling is smooth

- [ ] **Step 3: Commit**

```bash
git add src/components/title/title-actions.tsx
git commit -m "feat: add scrollable container with fade mask to watch history"
```
