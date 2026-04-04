# Review Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose Public, Companion, or Private visibility for their review when logging a watch event.

**Architecture:** Replace the `reviewPublic` boolean column with a `visibility` text column (`public` | `companion` | `private`). The UI gets a stacked card selector as the final step before saving. The feed query strips rating + review text server-side for unauthorized viewers.

**Tech Stack:** Drizzle ORM (Postgres), tRPC, React, TanStack Query, Zod

**Spec:** `docs/superpowers/specs/2026-04-04-review-visibility-design.md`

---

### File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/schema.ts` | Modify | Replace `reviewPublic` boolean with `visibility` text column |
| `src/components/watched/visibility-selector.tsx` | Create | Stacked card radio group component |
| `src/components/watched/review-modal.tsx` | Modify | Add visibility state, wire selector, send with mutations |
| `src/integrations/trpc/routers/watch-event.ts` | Modify | Accept visibility on create/update, filter review content in getFeed |
| `src/integrations/trpc/routers/watched.ts` | Modify | Update notification check from `reviewPublic` to `visibility === "public"` |
| `src/routes/app/feed.tsx` | Modify | Pass visibility to edit modal so it loads correctly |

---

### Task 1: Schema — Replace `reviewPublic` with `visibility`

**Files:**
- Modify: `src/db/schema.ts:280` (the `reviewPublic` column definition)

- [ ] **Step 1: Replace the column in schema.ts**

In `src/db/schema.ts`, find the `watchEvent` table definition. Replace:

```typescript
reviewPublic: boolean("review_public").default(true).notNull(),
```

With:

```typescript
visibility: text("visibility").default("public").notNull(),
```

- [ ] **Step 2: Push schema change**

Run: `bunx drizzle-kit push`

This will prompt to rename `review_public` → `visibility` and change the type. Accept the rename. The default value `"public"` maps correctly from the old boolean `true` default.

Existing rows with `review_public = true` will need a data migration. Since the column is being renamed and retyped, drizzle-kit push may drop and recreate — confirm the migration plan drizzle shows. If it creates a new column, add a manual SQL step:

```sql
UPDATE watch_event SET visibility = CASE WHEN review_public = true THEN 'public' ELSE 'private' END;
```

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "schema: replace reviewPublic boolean with visibility text column"
```

---

### Task 2: Visibility Selector Component

**Files:**
- Create: `src/components/watched/visibility-selector.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/watched/visibility-selector.tsx`:

```tsx
import { Eye, EyeOff, Users } from "lucide-react";

export type Visibility = "public" | "companion" | "private";

interface VisibilitySelectorProps {
	value: Visibility | null;
	onChange: (value: Visibility) => void;
	hasCompanions: boolean;
}

const options: Array<{
	value: Visibility;
	label: string;
	description: string;
	icon: typeof Eye;
	requiresCompanions: boolean;
}> = [
	{
		value: "public",
		label: "Public",
		description: "Visible to all your friends",
		icon: Eye,
		requiresCompanions: false,
	},
	{
		value: "companion",
		label: "Companion",
		description: "Only you & who you watched with",
		icon: Users,
		requiresCompanions: true,
	},
	{
		value: "private",
		label: "Private",
		description: "Only visible to you",
		icon: EyeOff,
		requiresCompanions: false,
	},
];

export function VisibilitySelector({
	value,
	onChange,
	hasCompanions,
}: VisibilitySelectorProps) {
	const visibleOptions = options.filter(
		(o) => !o.requiresCompanions || hasCompanions,
	);

	return (
		<div>
			<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
				Who can see this?
			</div>
			<div className="flex flex-col gap-1.5">
				{visibleOptions.map((option) => {
					const Icon = option.icon;
					const selected = value === option.value;
					return (
						<button
							key={option.value}
							type="button"
							onClick={() => onChange(option.value)}
							className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-left transition-all duration-200 ${
								selected
									? "bg-neon-cyan/[0.04] border border-neon-cyan/25 shadow-[0_0_12px_rgba(0,229,255,0.06)]"
									: "bg-black/20 border border-cream/[0.06] hover:border-cream/15"
							}`}
						>
							<Icon
								className={`w-4 h-4 shrink-0 ${selected ? "text-neon-cyan/70" : "text-cream/25"}`}
							/>
							<div className="flex-1">
								<div
									className={`font-mono-retro text-xs tracking-wide ${selected ? "text-neon-cyan/85" : "text-cream/40"}`}
								>
									{option.label}
								</div>
								<div className="font-mono-retro text-[10px] text-cream/20 mt-0.5">
									{option.description}
								</div>
							</div>
							<div
								className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
									selected
										? "border-neon-cyan/50 bg-neon-cyan/15"
										: "border-cream/15"
								}`}
							>
								{selected && (
									<div className="w-2 h-2 rounded-full bg-neon-cyan/80" />
								)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/watched/visibility-selector.tsx
git commit -m "feat: add VisibilitySelector component"
```

---

### Task 3: Wire Visibility into Review Modal

**Files:**
- Modify: `src/components/watched/review-modal.tsx`

- [ ] **Step 1: Add visibility state and import**

At the top of `review-modal.tsx`, add the import:

```typescript
import { VisibilitySelector, type Visibility } from "./visibility-selector";
```

In the component, add state alongside the existing state declarations (after line 70):

```typescript
const [visibility, setVisibility] = useState<Visibility | null>(null);
```

- [ ] **Step 2: Load visibility in edit mode**

Update the `WatchEventModalProps` interface's `editEvent` to include visibility:

```typescript
editEvent?: {
	id: string;
	rating: number | null;
	note: string | null;
	watchedAt: string;
	companions: Companion[];
	visibility: Visibility;
};
```

In the `useEffect` that loads edit state (around line 73), add inside the `if (editEvent)` block:

```typescript
setVisibility(editEvent.visibility);
```

And in the `else` (reset) block:

```typescript
setVisibility(null);
```

- [ ] **Step 3: Reset visibility when companions change**

After the existing `useEffect`, add a new effect to reset visibility when Companion is selected but companions are removed:

```typescript
useEffect(() => {
	if (visibility === "companion" && companions.length === 0) {
		setVisibility(null);
	}
}, [companions, visibility]);
```

- [ ] **Step 4: Add the selector to the modal UI**

In the JSX, just before the "Save & Done" button (before the `<button>` at around line 359), add:

```tsx
<VisibilitySelector
	value={visibility}
	onChange={setVisibility}
	hasCompanions={companions.length > 0}
/>
```

- [ ] **Step 5: Send visibility in create/update mutations**

In `handleSave`, update the create call to include visibility:

```typescript
createEvent.mutate({
	tmdbId,
	mediaType,
	rating: rating ?? undefined,
	note: note.trim() || undefined,
	watchedAt: watchedAtISO,
	companions,
	titleName,
	visibility: visibility ?? "public",
	scope,
	scopeSeasonNumber,
	scopeEpisodeNumber,
});
```

Update the edit call to include visibility:

```typescript
updateEvent.mutate({
	id: editEvent.id,
	rating: rating ?? null,
	note: note.trim() || null,
	watchedAt: watchedAtISO ?? null,
	companions,
	titleName,
	visibility: visibility ?? undefined,
});
```

- [ ] **Step 6: Disable save button until visibility is chosen**

Find the save button's `disabled` prop (currently `disabled={isPending}`). Change to:

```typescript
disabled={isPending || visibility === null}
```

- [ ] **Step 7: Update handleClose to reset visibility**

In `handleClose`, add `setVisibility(null)` alongside the other resets.

- [ ] **Step 8: Default visibility to "public" for handleRemindMe**

In `handleRemindMe`, add `visibility: "public"` to the create mutation input:

```typescript
createEvent.mutate(
	{
		tmdbId,
		mediaType,
		watchedAt: watchedAtISO,
		companions,
		titleName,
		remindMe: true,
		visibility: "public",
	},
	...
);
```

- [ ] **Step 9: Commit**

```bash
git add src/components/watched/review-modal.tsx
git commit -m "feat: wire visibility selector into review modal"
```

---

### Task 4: Backend — Accept Visibility in Create/Update Mutations

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts`

- [ ] **Step 1: Add visibility to the create mutation input schema**

In the `create` mutation's `.input(z.object({...}))`, add:

```typescript
visibility: z.enum(["public", "companion", "private"]).optional().default("public"),
```

- [ ] **Step 2: Set visibility in the create insert**

In the create mutation's `db.insert(watchEvent).values({...})` call, add:

```typescript
visibility: input.visibility,
```

- [ ] **Step 3: Add visibility to the update mutation input schema**

In the `update` mutation's `.input(z.object({...}))`, add:

```typescript
visibility: z.enum(["public", "companion", "private"]).optional(),
```

- [ ] **Step 4: Set visibility in the update query**

In the update mutation's `db.update(watchEvent).set({...})` call, add `visibility` to the set object. Only set it if provided — follow the existing pattern of conditionally including fields. In the `set` object:

```typescript
...(input.visibility !== undefined && { visibility: input.visibility }),
```

- [ ] **Step 5: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat: accept visibility field in create/update watch event mutations"
```

---

### Task 5: Backend — Filter Review Content in Feed Query

**Files:**
- Modify: `src/integrations/trpc/routers/watch-event.ts`

- [ ] **Step 1: Strip review content in getFeed based on visibility**

In the `getFeed` query, after fetching `watchEvents` (around line 422), add a mapping step that strips `rating` and `note` for unauthorized viewers. Add this before the watch events are merged into feed items:

```typescript
const filteredWatchEvents = watchEvents.map((event) => {
	if (event.userId === ctx.userId) return event;
	if (event.visibility === "public") return event;
	if (event.visibility === "companion") {
		const isCompanion = event.companions.some(
			(c) => c.friendId === ctx.userId,
		);
		if (isCompanion) return event;
	}
	return { ...event, rating: null, note: null };
});
```

Then use `filteredWatchEvents` instead of `watchEvents` when building the feed items array.

- [ ] **Step 2: Commit**

```bash
git add src/integrations/trpc/routers/watch-event.ts
git commit -m "feat: filter review content in feed by visibility"
```

---

### Task 6: Backend — Update Notification Check in Watched Router

**Files:**
- Modify: `src/integrations/trpc/routers/watched.ts`

- [ ] **Step 1: Replace reviewPublic check with visibility check**

In the `updateReview` mutation (around line 74), change:

```typescript
if (!hadReview && hasReview && existing.reviewPublic) {
```

To:

```typescript
if (!hadReview && hasReview && existing.visibility === "public") {
```

- [ ] **Step 2: Commit**

```bash
git add src/integrations/trpc/routers/watched.ts
git commit -m "fix: update notification check to use visibility column"
```

---

### Task 7: Feed Page — Pass Visibility to Edit Modal

**Files:**
- Modify: `src/routes/app/feed.tsx`

- [ ] **Step 1: Update editModal state type**

In the `editModal` state type (around line 22), add `visibility` to the event shape:

```typescript
event?: {
	id: string;
	rating: number | null;
	note: string | null;
	watchedAt: string;
	companions: Companion[];
	visibility: "public" | "companion" | "private";
};
```

- [ ] **Step 2: Pass visibility in the onEdit callback**

Find where `onEdit` is called to set the edit modal (the callback passed to `WatchEventCard`). Include `visibility` from the event data:

```typescript
visibility: event.visibility ?? "public",
```

- [ ] **Step 3: Verify other places that open the ReviewModal in edit mode**

Search the codebase for other places that render `<ReviewModal` with `editEvent` and ensure they also pass `visibility`. Check `src/routes/app/title.$id.tsx` or similar title detail pages.

- [ ] **Step 4: Commit**

```bash
git add src/routes/app/feed.tsx
git commit -m "feat: pass visibility through edit modal on feed page"
```

---

### Task 8: Integration Check — Other Edit Flows

**Files:**
- Search and modify: any other files that open ReviewModal with `editEvent`

- [ ] **Step 1: Find all ReviewModal usages**

Run: `grep -rn "editEvent" src/`

For each place that constructs an `editEvent` object, add `visibility` from the watch event data. Common locations:
- Title detail pages (`src/routes/app/title.$id.tsx` or similar)
- Watch history views

- [ ] **Step 2: Update each location**

For each file found, add `visibility: event.visibility ?? "public"` to the editEvent object.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: pass visibility through all ReviewModal edit flows"
```

---

### Task 9: Verify End-to-End

- [ ] **Step 1: Start the dev server**

Run: `bun dev`

- [ ] **Step 2: Manual smoke test**

1. Log a new watch event — confirm the visibility selector appears above "Save & Done"
2. Verify save is disabled until visibility is selected
3. Add a companion — confirm the "Companion" option appears
4. Remove all companions — confirm "Companion" disappears and selection resets if it was selected
5. Save with "Private" — check the feed to confirm rating/note are hidden from other users but the watch event still appears
6. Edit the event — confirm the saved visibility loads correctly

- [ ] **Step 3: Commit any fixes**

If any issues arise during testing, fix and commit them.
