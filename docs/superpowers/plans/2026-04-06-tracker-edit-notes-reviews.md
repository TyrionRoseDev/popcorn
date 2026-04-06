# Tracker Edit Notes & Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit buttons (pencil icon) to notes and reviews in the tracker detail page's "Notes & Reviews" section, opening the existing modals pre-filled for editing.

**Architecture:** The `NotesAndReviewsSection` in `tracker.$tmdbId.tsx` already has delete buttons. We add pencil icons alongside them. For reviews (watch events), we open the existing `ReviewModal` with its `editEvent` prop. For notes (journal entries), we create a lightweight `EditNoteModal` that pre-fills the note text and visibility toggle, calling `journalEntry.update`. The `NotesAndReviewsSection` props need expanding to include `visibility` and `companions` data for watch events.

**Tech Stack:** React, tRPC, TanStack Query, Lucide icons, existing Dialog/Switch UI components

---

### Task 1: Expand `NotesAndReviewsSection` watch event type to include edit-required fields

The `NotesAndReviewsSection` currently receives a subset of watch event fields that doesn't include `visibility` or `companions`. The `ReviewModal` `editEvent` prop needs `{ id, rating, note, watchedAt, companions, visibility }`.

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx:1289-1311` (NotesAndReviewsSectionProps interface)
- Modify: `src/routes/app/tracker.$tmdbId.tsx:1125-1129` (where NotesAndReviewsSection is rendered)

- [ ] **Step 1: Update the `NotesAndReviewsSectionProps` interface**

In `src/routes/app/tracker.$tmdbId.tsx`, update the `watchEvents` type in `NotesAndReviewsSectionProps` to include `visibility` and `companions`:

```typescript
watchEvents: Array<{
	id: string;
	rating: number | null;
	note: string | null;
	scope: string | null;
	scopeSeasonNumber: number | null;
	scopeEpisodeNumber: number | null;
	watchedAt: Date | null;
	createdAt: Date;
	watchNumber: number;
	visibility: string | null;
	companions: Array<{ friendId: string | null; name: string }>;
}>;
```

- [ ] **Step 2: Verify the data is already available from `getForTitle`**

The query `trpc.watchEvent.getForTitle` already fetches `with: { companions: true }`, so `existingWatchEvents` already contains `visibility` and `companions`. The filter on line 1127-1129 just narrows to events with a rating or note — no query changes needed.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/tracker.\$tmdbId.tsx
git commit -m "feat: expand NotesAndReviewsSection watchEvent type for edit support"
```

---

### Task 2: Create `EditNoteModal` component

A lightweight modal for editing an existing journal entry. Pre-fills note text and visibility toggle. Calls `journalEntry.update`.

**Files:**
- Create: `src/components/tracker/edit-note-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { Switch } from "#/components/ui/switch";
import { useTRPC } from "#/integrations/trpc/react";

interface EditNoteModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	entry: {
		id: string;
		note: string;
		isPublic: boolean;
		scope: string;
		seasonNumber: number | null;
		episodeNumber: number | null;
	} | null;
}

function scopeLabel(
	scope: string,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	return "General";
}

export function EditNoteModal({
	open,
	onOpenChange,
	entry,
}: EditNoteModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [note, setNote] = useState("");
	const [isPublic, setIsPublic] = useState(false);

	useEffect(() => {
		if (open && entry) {
			setNote(entry.note);
			setIsPublic(entry.isPublic);
		}
	}, [open, entry]);

	const updateEntry = useMutation(
		trpc.journalEntry.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.journalEntry.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.journalEntry.getAll.queryFilter(),
				);
				toast.success("Note updated");
				onOpenChange(false);
			},
			onError: () => {
				toast.error("Failed to update note");
			},
		}),
	);

	function handleSave() {
		if (!entry || !note.trim()) return;
		updateEntry.mutate({
			id: entry.id,
			note: note.trim(),
			isPublic,
		});
	}

	if (!entry) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-[380px] border-none bg-transparent p-0 gap-0 shadow-none"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">Edit Note</DialogTitle>
				<div className="w-full max-w-[380px] flex flex-col items-center">
					{/* Marquee header */}
					<div className="w-[calc(100%-16px)] border-2 border-neon-cyan/20 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.06)] relative">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
						>
							<X className="w-4 h-4" />
						</button>
						<div className="font-display text-xl text-cream tracking-wide">
							Edit Note
						</div>
						<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/40 mt-0.5">
							{scopeLabel(entry.scope, entry.seasonNumber, entry.episodeNumber)}
						</div>
					</div>

					{/* Modal card */}
					<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
						<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.3)]" />
						<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

						<div className="p-5 flex flex-col gap-4 relative">
							{/* Scope badge */}
							<div className="flex items-center justify-center">
								<span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neon-cyan/[0.06] border border-neon-cyan/15 font-mono-retro text-[10px] tracking-wider text-neon-cyan/60">
									{scopeLabel(entry.scope, entry.seasonNumber, entry.episodeNumber)}
								</span>
							</div>

							{/* Note textarea */}
							<div>
								<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
									Your Note
								</div>
								<textarea
									value={note}
									onChange={(e) => setNote(e.target.value.slice(0, 2000))}
									placeholder="Share your thoughts..."
									className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-3 min-h-[120px] font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-cyan/20 resize-none transition-colors duration-200"
								/>
								<div className="flex justify-end mt-1">
									<span className="font-mono-retro text-[9px] text-cream/20">
										{note.length}/2000
									</span>
								</div>
							</div>

							{/* Public/private toggle */}
							<div className="flex items-center justify-between px-1">
								<div className="flex items-center gap-2">
									{isPublic ? (
										<Globe className="w-3.5 h-3.5 text-neon-cyan/50" />
									) : (
										<Lock className="w-3.5 h-3.5 text-cream/25" />
									)}
									<span className="font-mono-retro text-[10px] tracking-wider text-cream/40">
										{isPublic ? "Public" : "Private"}
									</span>
								</div>
								<Switch
									checked={isPublic}
									onCheckedChange={setIsPublic}
									size="sm"
									className="data-[state=checked]:bg-neon-cyan/40"
								/>
							</div>

							<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

							{/* Save button */}
							<button
								type="button"
								onClick={handleSave}
								disabled={!note.trim() || updateEntry.isPending}
								className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
							>
								{updateEntry.isPending ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tracker/edit-note-modal.tsx
git commit -m "feat: add EditNoteModal component for editing journal entries"
```

---

### Task 3: Add edit buttons and wire up modals in `NotesAndReviewsSection`

Add pencil icons next to trash icons for both notes and reviews. Wire up `EditNoteModal` for notes and `ReviewModal` (with `editEvent` prop) for reviews.

**Files:**
- Modify: `src/routes/app/tracker.$tmdbId.tsx:1-22` (imports)
- Modify: `src/routes/app/tracker.$tmdbId.tsx:1344-1564` (NotesAndReviewsSection component)

- [ ] **Step 1: Add imports**

Add to the imports at the top of `src/routes/app/tracker.$tmdbId.tsx`:

```typescript
import { Pencil } from "lucide-react";  // add to existing lucide import
import { EditNoteModal } from "#/components/tracker/edit-note-modal";
import { ReviewModal as ReviewModalImport } from "#/components/watched/review-modal";
```

Note: `ReviewModal` is already imported at line 20. It will be used inside `NotesAndReviewsSection`.

- [ ] **Step 2: Add state and edit handlers to `NotesAndReviewsSection`**

Inside the `NotesAndReviewsSection` function, after the existing delete mutations (around line 1383), add state for editing:

```typescript
// Edit state
const [editingNote, setEditingNote] = useState<{
	id: string;
	note: string;
	isPublic: boolean;
	scope: string;
	seasonNumber: number | null;
	episodeNumber: number | null;
} | null>(null);

const [editingReview, setEditingReview] = useState<{
	id: string;
	rating: number | null;
	note: string | null;
	watchedAt: Date | null;
	companions: Array<{ friendId: string | null; name: string }>;
	visibility: string | null;
} | null>(null);
```

- [ ] **Step 3: Add pencil button next to trash button for notes**

In the note item rendering (around line 1487-1493), replace the single trash button with a two-button group:

Change the existing delete button area from:
```tsx
<button
	type="button"
	onClick={() => handleDeleteNote(entry.id)}
	className="p-1 text-cream/10 opacity-0 group-hover:opacity-100 hover:text-red-400/60 transition-all duration-200"
>
	<Trash2 className="w-3 h-3" />
</button>
```

To:
```tsx
<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
	<button
		type="button"
		onClick={() =>
			setEditingNote({
				id: entry.id,
				note: entry.note,
				isPublic: entry.isPublic ?? false,
				scope: entry.scope,
				seasonNumber: entry.seasonNumber,
				episodeNumber: entry.episodeNumber,
			})
		}
		className="p-1 text-cream/10 hover:text-neon-cyan/60 transition-all duration-200"
	>
		<Pencil className="w-3 h-3" />
	</button>
	<button
		type="button"
		onClick={() => handleDeleteNote(entry.id)}
		className="p-1 text-cream/10 hover:text-red-400/60 transition-all duration-200"
	>
		<Trash2 className="w-3 h-3" />
	</button>
</div>
```

- [ ] **Step 4: Add pencil button next to trash button for reviews**

In the review item rendering (around line 1544-1550), apply the same pattern:

Change the existing delete button area from:
```tsx
<button
	type="button"
	onClick={() => handleDeleteReview(event.id)}
	className="p-1 text-cream/10 opacity-0 group-hover:opacity-100 hover:text-red-400/60 transition-all duration-200"
>
	<Trash2 className="w-3 h-3" />
</button>
```

To:
```tsx
<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
	<button
		type="button"
		onClick={() =>
			setEditingReview({
				id: event.id,
				rating: event.rating,
				note: event.note,
				watchedAt: event.watchedAt,
				companions: event.companions,
				visibility: event.visibility,
			})
		}
		className="p-1 text-cream/10 hover:text-neon-cyan/60 transition-all duration-200"
	>
		<Pencil className="w-3 h-3" />
	</button>
	<button
		type="button"
		onClick={() => handleDeleteReview(event.id)}
		className="p-1 text-cream/10 hover:text-red-400/60 transition-all duration-200"
	>
		<Trash2 className="w-3 h-3" />
	</button>
</div>
```

- [ ] **Step 5: Render the modals at the bottom of `NotesAndReviewsSection`**

At the end of the `NotesAndReviewsSection` return, just before the closing `</div>`, add:

```tsx
{/* Edit note modal */}
<EditNoteModal
	open={editingNote !== null}
	onOpenChange={(open) => {
		if (!open) setEditingNote(null);
	}}
	entry={editingNote}
/>

{/* Edit review modal */}
<ReviewModal
	open={editingReview !== null}
	onOpenChange={(open) => {
		if (!open) setEditingReview(null);
	}}
	titleName=""
	tmdbId={0}
	mediaType="tv"
	editEvent={
		editingReview
			? {
					id: editingReview.id,
					rating: editingReview.rating,
					note: editingReview.note,
					watchedAt: editingReview.watchedAt?.toISOString() ?? null,
					companions: editingReview.companions.map((c) => ({
						friendId: c.friendId ?? undefined,
						name: c.name,
					})),
					visibility: (editingReview.visibility as "public" | "companion" | "private") ?? "public",
				}
			: undefined
	}
/>
```

Note: `titleName` and `tmdbId` on `ReviewModal` are only used for creating new events. In edit mode, the `editEvent` prop drives the modal. The title name display in the header still shows from `editEvent` data via the `updateEvent` mutation which takes `titleName` as input — but since the update mutation already receives `titleName` from the caller, we need to pass `titleName` properly. Let me check...

Actually, looking at `ReviewModal.handleSave()` line 154: `updateEvent.mutate({ id, rating, note, watchedAt, companions, titleName, visibility })` — it uses the `titleName` prop. So we do need to pass the correct title name. We need to thread `titleName` and `tmdbId` into `NotesAndReviewsSection`.

- [ ] **Step 6: Thread `titleName` and `tmdbId` into `NotesAndReviewsSection`**

Update `NotesAndReviewsSectionProps` to include:
```typescript
interface NotesAndReviewsSectionProps {
	tmdbId: number;
	titleName: string;
	journalEntries: Array<{...}>;
	watchEvents: Array<{...}>;
}
```

Update the component call site (around line 1125):
```tsx
<NotesAndReviewsSection
	tmdbId={tmdbId}
	titleName={titleData.title}
	journalEntries={journalEntries ?? []}
	watchEvents={(existingWatchEvents ?? []).filter(
		(e) => e.rating != null || e.note,
	)}
/>
```

Update the function signature:
```typescript
function NotesAndReviewsSection({
	tmdbId,
	titleName,
	journalEntries,
	watchEvents,
}: NotesAndReviewsSectionProps) {
```

And fix the ReviewModal render to use these:
```tsx
<ReviewModal
	open={editingReview !== null}
	onOpenChange={(open) => {
		if (!open) setEditingReview(null);
	}}
	titleName={titleName}
	tmdbId={tmdbId}
	mediaType="tv"
	editEvent={
		editingReview
			? {
					id: editingReview.id,
					rating: editingReview.rating,
					note: editingReview.note,
					watchedAt: editingReview.watchedAt?.toISOString() ?? null,
					companions: editingReview.companions.map((c) => ({
						friendId: c.friendId ?? undefined,
						name: c.name,
					})),
					visibility: (editingReview.visibility as "public" | "companion" | "private") ?? "public",
				}
			: undefined
	}
/>
```

- [ ] **Step 7: Add `Pencil` to the lucide-react import and import `EditNoteModal`**

In the imports at the top of `tracker.$tmdbId.tsx`, add `Pencil` to the lucide-react import (alongside existing icons like `Pen`, `Trash2`, etc.) and add the `EditNoteModal` import:

```typescript
import { EditNoteModal } from "#/components/tracker/edit-note-modal";
```

The file already imports `ReviewModal` from `#/components/watched/review-modal` on line 20.

- [ ] **Step 8: Also add `isPublic` to the journal entries type in `NotesAndReviewsSectionProps`**

The `journalEntries` array type needs `isPublic` for the edit modal. Update it:

```typescript
journalEntries: Array<{
	id: string;
	scope: string;
	seasonNumber: number | null;
	episodeNumber: number | null;
	note: string;
	isPublic: boolean;
	createdAt: Date;
	watchNumber: number;
}>;
```

(This field is already returned by `journalEntry.getForShow` — no backend changes needed.)

- [ ] **Step 9: Commit**

```bash
git add src/routes/app/tracker.\$tmdbId.tsx
git commit -m "feat: add edit buttons for notes and reviews in tracker detail"
```

---

### Task 4: Verify and fix build

- [ ] **Step 1: Run type check**

```bash
cd /Users/tyrion/Dev/popcorn && bunx tsc --noEmit
```

Fix any type errors — likely candidates:
- `isPublic` on journal entries might already be in the type or might need adding
- The `companions` field shape coming from `getForTitle` might use `friendId: string | null` vs the `Companion` type expecting `friendId?: string`

- [ ] **Step 2: Run dev server and test manually**

```bash
bun run dev
```

Navigate to a tracker show page, scroll to Notes & Reviews section, and verify:
1. Pencil icons appear on hover next to trash icons for both notes and reviews
2. Clicking pencil on a note opens EditNoteModal with pre-filled text and visibility
3. Saving a note edit updates the list
4. Clicking pencil on a review opens ReviewModal with pre-filled rating, note, date, companions, visibility
5. Saving a review edit updates the list

- [ ] **Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve type issues for tracker edit feature"
```
