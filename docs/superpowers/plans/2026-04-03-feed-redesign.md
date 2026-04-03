# Feed Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the feed page with drive-in theatre atmosphere — car silhouettes, marquee header, fog, themed dividers, date grouping — while keeping cards as clean horizontal boxes.

**Architecture:** Create a `FeedAtmosphere` component for page-level effects (amber ground glow, fog, film strips, light orbs). Reuse existing `NowShowingHeader` and `CarSilhouettes` components. Restyle all three card types inline. Group feed items by date with styled headers.

**Tech Stack:** React, TanStack Router, Tailwind CSS v4, existing component library

---

### Task 1: Create FeedAtmosphere component

**Files:**
- Create: `src/components/feed/feed-atmosphere.tsx`

- [ ] **Step 1: Create the atmosphere component**

Create `src/components/feed/feed-atmosphere.tsx` with amber ground glow, fog layers, film strip edges, and light orbs:

```tsx
export function FeedAtmosphere() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    >
      {/* Amber ground glow */}
      <div
        className="fixed inset-x-0 bottom-0"
        style={{
          height: "220px",
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(255,184,0,0.12) 0%, transparent 70%)",
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
            "radial-gradient(circle, rgba(255,184,0,0.04), transparent 70%)",
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
            "radial-gradient(circle, rgba(255,45,120,0.03), transparent 70%)",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify no build errors**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds (component not yet imported anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/components/feed/feed-atmosphere.tsx
git commit -m "feat(feed): add FeedAtmosphere component with amber glow, fog, film strips"
```

---

### Task 2: Restyle feed page layout with marquee header and car silhouettes

**Files:**
- Modify: `src/routes/app/feed.tsx`

- [ ] **Step 1: Add imports for new components**

Add these imports at the top of `src/routes/app/feed.tsx`:

```tsx
import { CarSilhouettes } from "#/components/title/car-silhouettes";
import { FeedAtmosphere } from "#/components/feed/feed-atmosphere";
import { NowShowingHeader } from "#/components/watchlist/now-showing-header";
```

- [ ] **Step 2: Replace the page header and add atmosphere**

Replace the current header section and wrapper. Change the outer div and header from:

```tsx
<div className="mx-auto max-w-2xl px-4 py-8">
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <h1 className="font-display text-2xl text-cream tracking-wide">Feed</h1>
    <select
      value={filter}
      onChange={(e) => setFilter(e.target.value as "all" | "mine")}
      className="bg-drive-in-card border border-drive-in-border rounded-md px-3 py-1.5 text-xs font-mono-retro text-cream/60 focus:outline-none focus:border-neon-cyan/20 [color-scheme:dark]"
    >
      <option value="all">Everyone</option>
      <option value="mine">Just Me</option>
    </select>
  </div>
```

To:

```tsx
<>
  <FeedAtmosphere />
  <div className="relative z-[2] mx-auto max-w-2xl px-4 py-8">
    {/* Car silhouettes + Marquee header */}
    <CarSilhouettes />
    <NowShowingHeader title="Feed" />

    {/* Filter */}
    <div className="flex justify-end mt-7 mb-6">
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
    </div>
```

Also update the closing tag at the end of the component — the outermost `</div>` becomes `</div></>` to close the fragment.

- [ ] **Step 3: Verify the page renders**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "feat(feed): add marquee header, car silhouettes, atmosphere, and styled filter"
```

---

### Task 3: Add date grouping and film dividers to feed

**Files:**
- Modify: `src/routes/app/feed.tsx`

- [ ] **Step 1: Add date grouping helper function**

Add this function inside `feed.tsx` (above the `FeedPage` component or at the bottom with the other helpers):

```tsx
function groupByDate(
  items: Array<{ type: string; timestamp: Date; data: Record<string, unknown> }>,
): Array<{ label: string; items: typeof items }> {
  const groups: Array<{ label: string; items: typeof items }> = [];
  let currentLabel = "";

  for (const item of items) {
    const date = new Date(item.timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / 86400000,
    );

    let label: string;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Yesterday";
    else if (diffDays < 7) label = `${diffDays} days ago`;
    else if (diffDays < 14) label = "Last week";
    else {
      label = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
    }

    if (label !== currentLabel) {
      groups.push({ label, items: [item] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].items.push(item);
    }
  }

  return groups;
}
```

- [ ] **Step 2: Add FilmDivider and DateHeader inline components**

Add these small components in `feed.tsx`:

```tsx
function DateHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-4">
      <span
        className="font-mono-retro text-[11px] tracking-[2px] uppercase whitespace-nowrap"
        style={{
          color: "rgba(255,184,0,0.6)",
          textShadow: "0 0 8px rgba(255,184,0,0.15)",
        }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,184,0,0.2), transparent)",
        }}
      />
    </div>
  );
}

function FilmDivider() {
  return (
    <div className="flex items-center justify-center gap-1.5 py-2.5 opacity-50">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="h-1 w-1 rounded-full"
          style={{
            background:
              i % 2 === 0
                ? "rgba(0,229,255,0.3)"
                : "rgba(255,45,120,0.3)",
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update the feed rendering to use date groups and dividers**

Replace the current feed items rendering block. Change:

```tsx
<div className="flex flex-col gap-3">
  {feedItems.map((item) => {
```

To use grouped rendering:

```tsx
<div className="flex flex-col">
  {groupByDate(feedItems).map((group) => (
    <div key={group.label}>
      <DateHeader label={group.label} />
      {group.items.map((item, idx) => (
        <div key={`${item.type}-${(item.data as { id: string }).id}`}>
          {idx > 0 && <FilmDivider />}
          {item.type === "watch_event" && (() => {
            const event = item.data as typeof feedItems[number] & { type: "watch_event" } extends { data: infer D } ? D : never;
```

Actually, since the existing code already handles type narrowing via `item.type` checks, a cleaner approach is to keep the existing rendering logic but wrap it with date groups. Replace the entire feed list from `<div className="flex flex-col gap-3">` through the closing `</div>` before `{hasNextPage &&` with:

```tsx
<div className="flex flex-col">
  {groupByDate(feedItems).map((group) => (
    <div key={group.label}>
      <DateHeader label={group.label} />
      <div className="flex flex-col">
        {group.items.map((item, idx) => {
          let card: React.ReactNode = null;

          if (item.type === "watch_event") {
            const event = item.data;
            card = (
              <WatchEventCard
                key={`we-${event.id}`}
                event={event}
                showTitle={{
                  name: event.title ?? `Title #${event.tmdbId}`,
                }}
                actor={event.user}
                isOwn={event.userId === currentUserId}
                onEdit={(e) =>
                  setEditModal({
                    open: true,
                    tmdbId: event.tmdbId,
                    mediaType: event.mediaType as "movie" | "tv",
                    titleName:
                      event.title ?? `Title #${event.tmdbId}`,
                    event: e,
                  })
                }
              />
            );
          } else if (item.type === "watchlist_created") {
            const wl = item.data;
            card = (
              <WatchlistCreatedCard
                key={`wl-${wl.id}`}
                watchlist={wl}
                isOwn={wl.ownerId === currentUserId}
              />
            );
          } else if (item.type === "journal_entry") {
            card = (
              <FeedJournalCard
                key={`je-${item.data.id}`}
                entry={item.data}
              />
            );
          }

          return (
            <div key={`${item.type}-${item.data.id}`}>
              {idx > 0 && <FilmDivider />}
              {card}
            </div>
          );
        })}
      </div>
    </div>
  ))}
```

Keep the existing `{hasNextPage && ...}` load-more button after this block, inside the outer flex-col div.

- [ ] **Step 4: Verify build**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "feat(feed): add date grouping with styled headers and film dividers"
```

---

### Task 4: Restyle WatchEventCard for new horizontal layout

**Files:**
- Modify: `src/components/watched/watch-event-card.tsx`

- [ ] **Step 1: Update the card layout**

Replace the card's outer wrapper and layout. The card body (from the opening `<div className="relative rounded-[10px]...` through the closing `</div>` of the component's return) should become:

```tsx
return (
  <div
    className="relative rounded-[10px] border border-neon-amber/20 p-4 transition-all hover:border-neon-amber/30 hover:-translate-y-px"
    style={{
      background:
        "linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
      boxShadow:
        "0 0 12px rgba(255,184,0,0.04), 0 4px 16px rgba(0,0,0,0.3)",
    }}
  >
    {/* Header row: avatar + action + timestamp */}
    {actor && (
      <div className="flex items-center gap-2 mb-2.5">
        <Link
          to="/app/profile/$userId"
          params={{ userId: actor.id }}
          className="flex items-center gap-2 no-underline"
        >
          <div className="w-7 h-7 rounded-full bg-neon-amber/15 border border-neon-amber/20 flex items-center justify-center text-[11px] font-medium text-neon-amber shrink-0">
            {actor.avatarUrl ? (
              <img
                src={actor.avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              (actor.username?.charAt(0) ?? "?").toUpperCase()
            )}
          </div>
          <span className="text-[13px] font-semibold text-cream/75">
            {isOwn ? "You" : (actor.username ?? "Someone")}
          </span>
        </Link>
        <span className="text-xs text-cream/30">watched</span>
        <span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
          {formatTimeAgo(event.watchedAt)}
        </span>
      </div>
    )}

    {/* Main row: title + episode on left, stars on right */}
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {showTitle && (
          <Link
            to="/app/title/$mediaType/$tmdbId"
            params={{
              mediaType: event.mediaType as "movie" | "tv",
              tmdbId: event.tmdbId,
            }}
            className="text-[15px] font-bold text-neon-cyan no-underline hover:text-neon-cyan/90"
            style={{ textShadow: "0 0 8px rgba(0,229,255,0.15)" }}
          >
            {showTitle.name}
          </Link>
        )}

        {!actor && (
          <div className="font-mono-retro text-[10px] tracking-[1px] text-[rgba(255,184,0,0.45)] mt-1">
            {formatDate(event.watchedAt)}
          </div>
        )}

        {companionText && (
          <div className="flex items-center gap-1.5 text-[11px] text-cream/30 mt-1">
            <span className="inline-block h-1 w-1 rounded-full bg-neon-cyan/50 shrink-0" />
            {companionText}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {event.rating && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-[15px] w-[15px] ${
                  s <= (event.rating ?? 0)
                    ? "text-neon-amber fill-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.5)]"
                    : "text-cream/8"
                }`}
              />
            ))}
          </div>
        )}

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
                className="p-1 text-cream/20 hover:text-cream/50 transition-colors"
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
    </div>

    {/* Note row */}
    {event.note && (
      <div
        className="mt-2.5 py-1.5 px-3 rounded-r-md"
        style={{
          background: "rgba(0,229,255,0.03)",
          borderLeft: "2px solid rgba(0,229,255,0.25)",
        }}
      >
        <p className="text-[12px] text-cream/50 italic line-clamp-2">
          {event.note}
        </p>
      </div>
    )}
  </div>
);
```

Note: Remove the warm radial light overlay div that existed in the old version — it's no longer needed with the cleaner card style.

- [ ] **Step 2: Verify build**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/watched/watch-event-card.tsx
git commit -m "design(feed): restyle WatchEventCard with horizontal layout"
```

---

### Task 5: Restyle FeedJournalCard to match new design

**Files:**
- Modify: `src/components/tracker/feed-journal-card.tsx`

- [ ] **Step 1: Update the journal card layout**

Replace the entire return block of `FeedJournalCard` with the new horizontal layout matching the feed design. The card should use a cyan border accent instead of amber:

```tsx
return (
  <div
    className="relative rounded-[10px] border border-neon-cyan/15 p-4 transition-all hover:border-neon-cyan/25 hover:-translate-y-px"
    style={{
      background:
        "linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
      boxShadow:
        "0 0 12px rgba(0,229,255,0.04), 0 4px 16px rgba(0,0,0,0.3)",
    }}
  >
    {/* Header row */}
    <div className="flex items-center gap-2 mb-2.5">
      <Link
        to="/app/profile/$userId"
        params={{ userId: actor.id }}
        className="flex items-center gap-2 no-underline"
      >
        <div className="w-7 h-7 rounded-full bg-neon-cyan/15 border border-neon-cyan/20 flex items-center justify-center text-[11px] font-medium text-neon-cyan shrink-0">
          {actor.avatarUrl ? (
            <img
              src={actor.avatarUrl}
              alt=""
              className="w-7 h-7 rounded-full object-cover"
            />
          ) : (
            (actor.username?.charAt(0) ?? "?").toUpperCase()
          )}
        </div>
        <span className="text-[13px] font-semibold text-cream/75">
          {actor.username ?? "Someone"}
        </span>
      </Link>
      <span className="text-xs text-cream/30">wrote about</span>
      <span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
        {formatTimeAgo(entry.createdAt)}
      </span>
    </div>

    {/* Main row: title + scope on left */}
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Link
          to="/app/title/$mediaType/$tmdbId"
          params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
          className="text-[15px] font-bold text-neon-cyan no-underline hover:text-neon-cyan/90"
          style={{ textShadow: "0 0 8px rgba(0,229,255,0.15)" }}
        >
          {entry.titleName}
        </Link>
        {badge && (
          <span className="ml-2 text-[11px] font-mono-retro text-cream/35">
            {badge}
          </span>
        )}
      </div>
    </div>

    {/* Note row */}
    <div
      className="mt-2.5 py-1.5 px-3 rounded-r-md"
      style={{
        background: "rgba(0,229,255,0.03)",
        borderLeft: "2px solid rgba(0,229,255,0.25)",
      }}
    >
      <p className="text-[12px] text-cream/50 italic line-clamp-3">
        {entry.note}
      </p>
    </div>
  </div>
);
```

- [ ] **Step 2: Remove unused imports**

Remove the `BookOpen` import from lucide-react since it's no longer used in the new layout.

- [ ] **Step 3: Verify build**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/tracker/feed-journal-card.tsx
git commit -m "design(feed): restyle FeedJournalCard with cyan accent and horizontal layout"
```

---

### Task 6: Restyle WatchlistCreatedCard to match new design

**Files:**
- Modify: `src/routes/app/feed.tsx` (inline `WatchlistCreatedCard` component)

- [ ] **Step 1: Update the watchlist card**

Replace the entire `WatchlistCreatedCard` function in `feed.tsx` with the pink-accented version:

```tsx
function WatchlistCreatedCard({
  watchlist,
  isOwn,
}: {
  watchlist: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: Date;
    owner: { id: string; username: string | null; avatarUrl: string | null };
    items: Array<{ id: string }>;
  };
  isOwn: boolean;
}) {
  const actor = watchlist.owner;
  const itemCount = watchlist.items.length;

  return (
    <div
      className="relative rounded-[10px] border border-neon-pink/15 p-4 transition-all hover:border-neon-pink/25 hover:-translate-y-px"
      style={{
        background:
          "linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
        boxShadow:
          "0 0 12px rgba(255,45,120,0.04), 0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <Link
          to="/app/profile/$userId"
          params={{ userId: actor.id }}
          className="flex items-center gap-2 no-underline"
        >
          <div className="w-7 h-7 rounded-full bg-neon-pink/15 border border-neon-pink/20 flex items-center justify-center text-[11px] font-medium text-neon-pink shrink-0">
            {actor.avatarUrl ? (
              <img
                src={actor.avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              (actor.username?.charAt(0) ?? "?").toUpperCase()
            )}
          </div>
          <span className="text-[13px] font-semibold text-cream/75">
            {isOwn ? "You" : (actor.username ?? "Someone")}
          </span>
        </Link>
        <span className="text-xs text-cream/30">created a watchlist</span>
        <span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
          {formatTimeAgo(watchlist.createdAt)}
        </span>
      </div>

      {/* Main row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            to="/app/watchlists/$watchlistId"
            params={{ watchlistId: watchlist.id }}
            search={{ sort: "date-added", type: "all" }}
            className="text-[15px] font-bold text-neon-pink no-underline hover:text-neon-pink/90"
            style={{ textShadow: "0 0 8px rgba(255,45,120,0.15)" }}
          >
            {watchlist.name}
          </Link>
          <span className="ml-2 text-[11px] font-mono-retro text-cream/35">
            {itemCount} {itemCount === 1 ? "title" : "titles"}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove unused Bookmark import**

Remove the `Bookmark` import from lucide-react at the top of `feed.tsx` if it's no longer used elsewhere in the file.

- [ ] **Step 3: Verify build**

Run: `cd /Users/tyrion/Dev/popcorn && bun run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "design(feed): restyle WatchlistCreatedCard with pink accent"
```

---

### Task 7: Visual verification and cleanup

**Files:**
- Possibly modify: `src/routes/app/feed.tsx`, card components

- [ ] **Step 1: Run the dev server and verify visually**

Run: `cd /Users/tyrion/Dev/popcorn && bun run dev`

Check in browser at the feed page:
- Car silhouettes visible above the marquee header
- "Now Showing" label + "Feed" title in marquee with chasing bulbs
- Amber ground glow at the bottom
- Drifting fog layers
- Film strip edges on left and right (very subtle)
- Cyan filter button with glow
- Date section headers with amber text and gradient line
- Film perforation dividers between cards
- Watch event cards: amber border accent, horizontal layout, title left + stars right, note below
- Watchlist cards: pink border accent
- Journal cards: cyan border accent
- Starfield and grain already active from app layout
- Hover effects on all cards (border brightens, subtle lift)

- [ ] **Step 2: Fix any visual issues found**

Address spacing, alignment, or color issues discovered during visual review.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "design(feed): visual polish and cleanup"
```
