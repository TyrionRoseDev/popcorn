# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the settings page with grouped sections, inline taste profile preview, Lucide pencil edit affordances, and a data export feature.

**Architecture:** The settings page (`/app/settings`) is rewritten as grouped section cards (Account, Taste Profile, Data & Privacy, Danger Zone) with a profile summary header. Three new dialog components handle taste profile editing. A new tRPC query fetches the user's genres, and new mutations handle individual field updates. A data export tRPC endpoint serializes user data as a downloadable JSON file.

**Tech Stack:** React, TanStack Router, tRPC + Zod, Drizzle ORM, Radix Dialog, Lucide React, Tailwind CSS, TMDB API

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/routes/app/settings.tsx` | Rewrite | Settings page layout with grouped sections |
| `src/components/settings/edit-genres-dialog.tsx` | Create | Multi-select genre picker dialog (3-5 genres) |
| `src/components/settings/edit-favourite-film-dialog.tsx` | Create | Search-and-select film dialog |
| `src/components/settings/edit-bio-dialog.tsx` | Create | Bio text input dialog (100 char limit) |
| `src/integrations/trpc/routers/taste-profile.ts` | Modify | Add `getUserGenres`, `updateGenres`, `updateFavouriteFilm`, `updateBio` endpoints |
| `src/integrations/trpc/routers/user.ts` | Create | `exportData` endpoint |
| `src/integrations/trpc/router.ts` | Modify | Register `userRouter` |
| `src/lib/auth.ts` | Modify | Add `bio`, `favouriteFilmTmdbId`, `favouriteGenreId` to `additionalFields` so they appear on the session user |

---

### Task 1: Add tRPC Endpoints for Taste Profile Editing

**Files:**
- Modify: `src/integrations/trpc/routers/taste-profile.ts`

- [ ] **Step 1: Add `getUserGenres` query**

Add this query to the `tasteProfileRouter` object in `src/integrations/trpc/routers/taste-profile.ts`, after the existing `search` procedure:

```typescript
getUserGenres: protectedProcedure.query(async ({ ctx }) => {
	const genres = await db
		.select({ genreId: userGenre.genreId })
		.from(userGenre)
		.where(eq(userGenre.userId, ctx.userId));
	return genres.map((g) => g.genreId);
}),
```

- [ ] **Step 2: Add `updateGenres` mutation**

Add this mutation after the new `getUserGenres` query:

```typescript
updateGenres: protectedProcedure
	.input(z.object({ genreIds: z.array(z.number()).min(3).max(5) }))
	.mutation(async ({ input, ctx }) => {
		await db.transaction(async (tx) => {
			await tx.delete(userGenre).where(eq(userGenre.userId, ctx.userId));
			await tx.insert(userGenre).values(
				input.genreIds.map((genreId) => ({
					userId: ctx.userId,
					genreId,
				})),
			);
		});
		return { success: true };
	}),
```

- [ ] **Step 3: Add `updateFavouriteFilm` mutation**

```typescript
updateFavouriteFilm: protectedProcedure
	.input(z.object({ tmdbId: z.number().nullable() }))
	.mutation(async ({ input, ctx }) => {
		await db
			.update(user)
			.set({ favouriteFilmTmdbId: input.tmdbId })
			.where(eq(user.id, ctx.userId));
		return { success: true };
	}),
```

- [ ] **Step 4: Add `updateBio` mutation**

```typescript
updateBio: protectedProcedure
	.input(z.object({ bio: z.string().max(100).nullable() }))
	.mutation(async ({ input, ctx }) => {
		await db
			.update(user)
			.set({ bio: input.bio })
			.where(eq(user.id, ctx.userId));
		return { success: true };
	}),
```

- [ ] **Step 5: Verify the server starts without errors**

Run: `bun run dev`
Expected: Server starts, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/integrations/trpc/routers/taste-profile.ts
git commit -m "feat: add tRPC endpoints for taste profile editing"
```

---

### Task 2: Create Edit Genres Dialog

**Files:**
- Create: `src/components/settings/edit-genres-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/components/settings/edit-genres-dialog.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { UNIFIED_GENRES } from "#/lib/genre-map";
import { useMutation } from "@tanstack/react-query";

const MIN_GENRES = 3;
const MAX_GENRES = 5;

interface EditGenresDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentGenreIds: number[];
}

export function EditGenresDialog({
	open,
	onOpenChange,
	currentGenreIds,
}: EditGenresDialogProps) {
	const [selected, setSelected] = useState<Set<number>>(
		() => new Set(currentGenreIds),
	);
	const [error, setError] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const updateGenres = useMutation(
		trpc.tasteProfile.updateGenres.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.tasteProfile.getUserGenres.queryKey(),
				});
				onOpenChange(false);
			},
			onError: () => setError("Something went wrong"),
		}),
	);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setSelected(new Set(currentGenreIds));
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function toggleGenre(id: number) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else if (next.size < MAX_GENRES) {
				next.add(id);
			}
			return next;
		});
	}

	function handleSave() {
		setError("");
		updateGenres.mutate({ genreIds: [...selected] });
	}

	const isValid = selected.size >= MIN_GENRES && selected.size <= MAX_GENRES;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Favorite Genres
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Pick {MIN_GENRES}-{MAX_GENRES} genres. {selected.size} selected.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<div className="flex flex-wrap gap-2">
						{UNIFIED_GENRES.map((genre) => {
							const isSelected = selected.has(genre.id);
							return (
								<button
									key={genre.id}
									type="button"
									onClick={() => toggleGenre(genre.id)}
									disabled={
										!isSelected &&
										selected.size >= MAX_GENRES
									}
									className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
										isSelected
											? "border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan"
											: "border-cream/10 bg-cream/5 text-cream/50 hover:bg-cream/8 disabled:opacity-30 disabled:cursor-not-allowed"
									}`}
								>
									{genre.name}
								</button>
							);
						})}
					</div>
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => handleClose(false)}
						disabled={updateGenres.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!isValid || updateGenres.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{updateGenres.isPending ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `bun run dev`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/edit-genres-dialog.tsx
git commit -m "feat: add EditGenresDialog component"
```

---

### Task 3: Create Edit Favourite Film Dialog

**Files:**
- Create: `src/components/settings/edit-favourite-film-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/components/settings/edit-favourite-film-dialog.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface EditFavouriteFilmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentTmdbId: number | null | undefined;
	currentTitle: string | null;
	currentPosterPath: string | null;
}

export function EditFavouriteFilmDialog({
	open,
	onOpenChange,
	currentTmdbId,
	currentTitle,
	currentPosterPath,
}: EditFavouriteFilmDialogProps) {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [selectedFilm, setSelectedFilm] = useState<{
		tmdbId: number;
		title: string;
		posterPath: string | null;
		year: string;
	} | null>(
		currentTmdbId
			? {
					tmdbId: currentTmdbId,
					title: currentTitle ?? "",
					posterPath: currentPosterPath,
					year: "",
				}
			: null,
	);
	const [error, setError] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	const searchResults = useQuery(
		trpc.tasteProfile.search.queryOptions(
			{ query: debouncedQuery },
			{ enabled: debouncedQuery.length >= 2 },
		),
	);

	const updateFilm = useMutation(
		trpc.tasteProfile.updateFavouriteFilm.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
				onOpenChange(false);
			},
			onError: () => setError("Something went wrong"),
		}),
	);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setQuery("");
			setDebouncedQuery("");
			setSelectedFilm(
				currentTmdbId
					? {
							tmdbId: currentTmdbId,
							title: currentTitle ?? "",
							posterPath: currentPosterPath,
							year: "",
						}
					: null,
			);
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function handleSave() {
		setError("");
		updateFilm.mutate({ tmdbId: selectedFilm?.tmdbId ?? null });
	}

	const movies = (searchResults.data?.items ?? []).filter(
		(item) => item.mediaType === "movie",
	);

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Favorite Film
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Search for a movie to set as your favorite.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					{selectedFilm && (
						<div className="flex items-center gap-3 rounded-lg border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-2">
							{selectedFilm.posterPath && (
								<img
									src={getTmdbImageUrl(selectedFilm.posterPath, "w92")!}
									alt=""
									className="h-12 w-8 rounded object-cover"
								/>
							)}
							<span className="flex-1 text-sm text-cream truncate">
								{selectedFilm.title}
								{selectedFilm.year && (
									<span className="text-cream/40"> ({selectedFilm.year})</span>
								)}
							</span>
							<button
								type="button"
								onClick={() => setSelectedFilm(null)}
								className="text-cream/30 hover:text-cream/60"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					)}

					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search movies..."
							autoFocus
							className="w-full rounded-lg border border-cream/12 bg-cream/6 pl-9 pr-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
						/>
					</div>

					{debouncedQuery.length >= 2 && (
						<div className="max-h-48 overflow-y-auto rounded-lg border border-cream/8">
							{searchResults.isLoading && (
								<div className="px-3 py-4 text-center text-sm text-cream/30">
									Searching...
								</div>
							)}
							{movies.length === 0 && !searchResults.isLoading && (
								<div className="px-3 py-4 text-center text-sm text-cream/30">
									No movies found
								</div>
							)}
							{movies.map((movie) => (
								<button
									key={movie.tmdbId}
									type="button"
									onClick={() => {
										setSelectedFilm({
											tmdbId: movie.tmdbId,
											title: movie.title,
											posterPath: movie.posterPath,
											year: movie.year,
										});
										setQuery("");
										setDebouncedQuery("");
									}}
									className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-cream/5"
								>
									{movie.posterPath ? (
										<img
											src={getTmdbImageUrl(movie.posterPath, "w92")!}
											alt=""
											className="h-10 w-7 rounded object-cover"
										/>
									) : (
										<div className="h-10 w-7 rounded bg-cream/10" />
									)}
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm text-cream">
											{movie.title}
										</div>
										{movie.year && (
											<div className="text-xs text-cream/40">{movie.year}</div>
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => handleClose(false)}
						disabled={updateFilm.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={updateFilm.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{updateFilm.isPending ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `bun run dev`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/edit-favourite-film-dialog.tsx
git commit -m "feat: add EditFavouriteFilmDialog component"
```

---

### Task 4: Create Edit Bio Dialog

**Files:**
- Create: `src/components/settings/edit-bio-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/components/settings/edit-bio-dialog.tsx`:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { useMutation } from "@tanstack/react-query";

const MAX_BIO_LENGTH = 100;

interface EditBioDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentBio: string | null | undefined;
}

export function EditBioDialog({
	open,
	onOpenChange,
	currentBio,
}: EditBioDialogProps) {
	const [bio, setBio] = useState(currentBio ?? "");
	const [error, setError] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const updateBio = useMutation(
		trpc.tasteProfile.updateBio.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
				onOpenChange(false);
			},
			onError: () => setError("Something went wrong"),
		}),
	);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setBio(currentBio ?? "");
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function handleSave() {
		setError("");
		updateBio.mutate({ bio: bio.trim() || null });
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSave();
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">Bio</DialogTitle>
					<DialogDescription className="text-cream/40">
						A short description about yourself.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<div className="relative">
						<textarea
							value={bio}
							onChange={(e) =>
								setBio(e.target.value.slice(0, MAX_BIO_LENGTH))
							}
							onKeyDown={handleKeyDown}
							maxLength={MAX_BIO_LENGTH}
							rows={3}
							autoFocus
							disabled={updateBio.isPending}
							placeholder="Film nerd. Horror enthusiast."
							className="w-full resize-none rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
						/>
						<span className="absolute bottom-2 right-3 text-xs text-cream/30">
							{bio.length}/{MAX_BIO_LENGTH}
						</span>
					</div>
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => handleClose(false)}
						disabled={updateBio.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={updateBio.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{updateBio.isPending ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `bun run dev`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/edit-bio-dialog.tsx
git commit -m "feat: add EditBioDialog component"
```

---

### Task 5: Create Data Export Endpoint

**Files:**
- Create: `src/integrations/trpc/routers/user.ts`
- Modify: `src/integrations/trpc/router.ts`

- [ ] **Step 1: Create the user router with exportData endpoint**

Create `src/integrations/trpc/routers/user.ts`:

```typescript
import type { TRPCRouterRecord } from "@trpc/server";
import { eq, or } from "drizzle-orm";
import { db } from "#/db";
import {
	block,
	friendship,
	user,
	userGenre,
	userTitle,
	watchlist,
	watchlistItem,
	watchlistMember,
} from "#/db/schema";
import { protectedProcedure } from "#/integrations/trpc/init";
import { getUnifiedGenreById } from "#/lib/genre-map";

export const userRouter = {
	exportData: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.userId;

		const [profile] = await db
			.select({
				username: user.username,
				email: user.email,
				bio: user.bio,
				favouriteFilmTmdbId: user.favouriteFilmTmdbId,
				favouriteGenreId: user.favouriteGenreId,
				avatarUrl: user.avatarUrl,
				createdAt: user.createdAt,
			})
			.from(user)
			.where(eq(user.id, userId));

		const genres = await db
			.select({ genreId: userGenre.genreId })
			.from(userGenre)
			.where(eq(userGenre.userId, userId));

		const titles = await db
			.select({
				tmdbId: userTitle.tmdbId,
				mediaType: userTitle.mediaType,
				createdAt: userTitle.createdAt,
			})
			.from(userTitle)
			.where(eq(userTitle.userId, userId));

		const watchlists = await db
			.select({
				id: watchlist.id,
				name: watchlist.name,
				type: watchlist.type,
				isPublic: watchlist.isPublic,
				createdAt: watchlist.createdAt,
			})
			.from(watchlist)
			.where(eq(watchlist.ownerId, userId));

		const watchlistIds = watchlists.map((w) => w.id);
		const items =
			watchlistIds.length > 0
				? await db
						.select({
							watchlistId: watchlistItem.watchlistId,
							tmdbId: watchlistItem.tmdbId,
							mediaType: watchlistItem.mediaType,
							title: watchlistItem.title,
							watched: watchlistItem.watched,
							createdAt: watchlistItem.createdAt,
						})
						.from(watchlistItem)
						.where(
							or(...watchlistIds.map((id) => eq(watchlistItem.watchlistId, id))),
						)
				: [];

		const friends = await db
			.select({
				requesterId: friendship.requesterId,
				addresseeId: friendship.addresseeId,
				status: friendship.status,
				createdAt: friendship.createdAt,
			})
			.from(friendship)
			.where(
				or(
					eq(friendship.requesterId, userId),
					eq(friendship.addresseeId, userId),
				),
			);

		const blocks = await db
			.select({
				blockedId: block.blockedId,
				createdAt: block.createdAt,
			})
			.from(block)
			.where(eq(block.blockerId, userId));

		return {
			exportedAt: new Date().toISOString(),
			profile: {
				...profile,
				favouriteGenreName: profile.favouriteGenreId
					? getUnifiedGenreById(profile.favouriteGenreId)?.name ?? null
					: null,
			},
			genres: genres.map((g) => ({
				genreId: g.genreId,
				name: getUnifiedGenreById(g.genreId)?.name ?? "Unknown",
			})),
			titles,
			watchlists: watchlists.map((w) => ({
				...w,
				items: items.filter((i) => i.watchlistId === w.id),
			})),
			friends: friends.map((f) => ({
				friendUserId:
					f.requesterId === userId ? f.addresseeId : f.requesterId,
				status: f.status,
				createdAt: f.createdAt,
			})),
			blocks,
		};
	}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Register the user router**

In `src/integrations/trpc/router.ts`, add the import and register:

Add import at line 8 (after the other router imports):
```typescript
import { userRouter } from "./routers/user";
```

Add to the `createTRPCRouter` call:
```typescript
user: userRouter,
```

- [ ] **Step 3: Verify the server starts**

Run: `bun run dev`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/trpc/routers/user.ts src/integrations/trpc/router.ts
git commit -m "feat: add data export tRPC endpoint"
```

---

### Task 6: Expose Profile Fields on Session User

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add bio, favouriteFilmTmdbId, and favouriteGenreId to additionalFields**

In `src/lib/auth.ts`, inside the `user.additionalFields` object (after the `onboardingCompleted` field), add:

```typescript
bio: {
	type: "string",
	required: false,
	input: true,
},
favouriteFilmTmdbId: {
	type: "number",
	required: false,
	input: true,
},
favouriteGenreId: {
	type: "number",
	required: false,
	input: true,
},
```

This ensures `user.bio`, `user.favouriteFilmTmdbId`, and `user.favouriteGenreId` are available on the session user object returned by `authClient.useSession()`.

- [ ] **Step 2: Verify the server starts**

Run: `bun run dev`
Expected: No errors. Session user object now includes the new fields.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: expose bio, favouriteFilmTmdbId, favouriteGenreId on session user"
```

---

### Task 7: Rewrite the Settings Page Layout

**Files:**
- Rewrite: `src/routes/app/settings.tsx`

- [ ] **Step 1: Rewrite the settings page**

Replace the entire contents of `src/routes/app/settings.tsx`:

```tsx
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ChevronRight,
	Download,
	Loader2,
	Pencil,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { ChangeAvatarDialog } from "#/components/settings/change-avatar-dialog";
import { ChangeEmailDialog } from "#/components/settings/change-email-dialog";
import { ChangeUsernameDialog } from "#/components/settings/change-username-dialog";
import { DeleteAccountDialog } from "#/components/settings/delete-account-dialog";
import { EditBioDialog } from "#/components/settings/edit-bio-dialog";
import { EditFavouriteFilmDialog } from "#/components/settings/edit-favourite-film-dialog";
import { EditGenresDialog } from "#/components/settings/edit-genres-dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { authClient } from "#/lib/auth-client";
import { getUnifiedGenreById } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

export const Route = createFileRoute("/app/settings")({
	component: SettingsPage,
	head: () => ({
		meta: [{ title: "Settings — Popcorn" }],
	}),
});

function SettingsPage() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Dialog states
	const [avatarOpen, setAvatarOpen] = useState(false);
	const [usernameOpen, setUsernameOpen] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [genresOpen, setGenresOpen] = useState(false);
	const [filmOpen, setFilmOpen] = useState(false);
	const [bioOpen, setBioOpen] = useState(false);

	// Fetch user genres
	const userGenres = useQuery(trpc.tasteProfile.getUserGenres.queryOptions());

	// Fetch favourite film details (for title + poster)
	const filmDetails = useQuery(
		trpc.title.details.queryOptions(
			{ mediaType: "movie", tmdbId: user?.favouriteFilmTmdbId ?? 0 },
			{ enabled: !!user?.favouriteFilmTmdbId },
		),
	);

	// Data export
	const exportData = useMutation(
		trpc.user.exportData.mutationOptions({
			onSuccess: (data) => {
				const json = JSON.stringify(data, null, 2);
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `popcorn-export-${user?.username ?? "user"}-${new Date().toISOString().slice(0, 10)}.json`;
				a.click();
				URL.revokeObjectURL(url);
			},
		}),
	);

	if (!user) return null;

	const genreIds = userGenres.data ?? [];
	const genreNames = genreIds
		.map((id) => getUnifiedGenreById(id)?.name)
		.filter(Boolean);

	return (
		<div className="mx-auto max-w-lg px-4 py-10">
			<h1 className="mb-8 font-display text-2xl text-cream">Settings</h1>

			{/* Profile Summary */}
			<button
				type="button"
				onClick={() => setAvatarOpen(true)}
				className="mb-6 flex w-full items-center gap-3 rounded-xl border border-cream/[0.04] bg-cream/[0.02] px-4 py-3.5 text-left transition-colors hover:bg-cream/[0.04]"
			>
				<div className="relative">
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt=""
							className="h-12 w-12 rounded-full object-cover"
						/>
					) : (
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan">
							<span className="text-lg font-semibold text-white">
								{user.username?.charAt(0).toUpperCase() || "?"}
							</span>
						</div>
					)}
					<div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream">
						<Pencil className="h-2.5 w-2.5 text-drive-in-bg" />
					</div>
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-cream">
						{user.username || "No username"}
					</div>
					<div className="text-xs text-cream/50">{user.email}</div>
				</div>
			</button>

			{/* Account Section */}
			<SectionLabel>Account</SectionLabel>
			<div className="mb-6 overflow-hidden rounded-xl border border-cream/[0.04] bg-cream/[0.02]">
				<SettingsRow onClick={() => setAvatarOpen(true)} last={false}>
					<span className="text-sm text-cream/60">Profile Picture</span>
					<div className="flex items-center gap-2">
						{user.avatarUrl ? (
							<img
								src={user.avatarUrl}
								alt=""
								className="h-6 w-6 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10">
								<span className="text-[10px] text-cream/40">
									{user.username?.charAt(0).toUpperCase() || "?"}
								</span>
							</div>
						)}
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
				<SettingsRow onClick={() => setUsernameOpen(true)} last={false}>
					<span className="text-sm text-cream/60">Username</span>
					<div className="flex items-center gap-2">
						<span className="max-w-[180px] truncate text-sm text-cream/40">
							{user.username || "Not set"}
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
				<SettingsRow onClick={() => setEmailOpen(true)} last>
					<span className="text-sm text-cream/60">Email</span>
					<div className="flex items-center gap-2">
						<span className="max-w-[180px] truncate text-sm text-cream/40">
							{user.email}
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
			</div>

			{/* Taste Profile Section */}
			<SectionLabel>Taste Profile</SectionLabel>
			<div className="mb-6 rounded-xl border border-cream/[0.04] bg-cream/[0.02] p-4">
				{/* Genres */}
				<button
					type="button"
					onClick={() => setGenresOpen(true)}
					className="mb-4 w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Genres
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					<div className="flex flex-wrap gap-1.5">
						{genreNames.length > 0 ? (
							genreNames.map((name) => (
								<span
									key={name}
									className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-medium text-neon-cyan"
								>
									{name}
								</span>
							))
						) : (
							<span className="text-sm text-cream/30">Not set</span>
						)}
					</div>
				</button>

				<div className="mb-4 border-t border-cream/[0.04]" />

				{/* Favourite Film */}
				<button
					type="button"
					onClick={() => setFilmOpen(true)}
					className="mb-4 w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Favorite Film
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					{filmDetails.data ? (
						<div className="flex items-center gap-2">
							{filmDetails.data.posterPath && (
								<img
									src={getTmdbImageUrl(filmDetails.data.posterPath, "w92")!}
									alt=""
									className="h-10 w-7 rounded object-cover"
								/>
							)}
							<span className="text-sm text-cream/70">
								{filmDetails.data.title}
							</span>
						</div>
					) : (
						<span className="text-sm text-cream/30">Not set</span>
					)}
				</button>

				<div className="mb-4 border-t border-cream/[0.04]" />

				{/* Bio */}
				<button
					type="button"
					onClick={() => setBioOpen(true)}
					className="w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Bio
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					{user.bio ? (
						<p className="text-sm italic text-cream/50">"{user.bio}"</p>
					) : (
						<span className="text-sm text-cream/30">Not set</span>
					)}
				</button>
			</div>

			{/* Data & Privacy Section */}
			<SectionLabel>Data & Privacy</SectionLabel>
			<div className="mb-6 overflow-hidden rounded-xl border border-cream/[0.04] bg-cream/[0.02]">
				<SettingsRow
					onClick={() => exportData.mutate()}
					last={false}
				>
					<span className="text-sm text-cream/60">Export Data</span>
					{exportData.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin text-neon-cyan/70" />
					) : (
						<span className="text-xs font-medium text-neon-cyan/70">
							Download
						</span>
					)}
				</SettingsRow>
				<SettingsRow
					onClick={() => {}}
					last
					asLink="/app/settings/blocked"
				>
					<span className="text-sm text-cream/60">Blocked Users</span>
					<ChevronRight className="h-4 w-4 text-cream/20" />
				</SettingsRow>
			</div>

			{/* Danger Zone */}
			<SectionLabel className="text-neon-pink/30">
				Danger Zone
			</SectionLabel>
			<button
				type="button"
				onClick={() => setDeleteOpen(true)}
				className="flex w-full items-center gap-3 rounded-xl border border-neon-pink/15 bg-neon-pink/5 px-4 py-3.5 text-left text-sm text-neon-pink/70 transition-colors hover:bg-neon-pink/10 hover:text-neon-pink"
			>
				<Trash2 className="h-4 w-4" />
				Delete Account
			</button>

			{/* Dialogs */}
			<ChangeAvatarDialog
				open={avatarOpen}
				onOpenChange={setAvatarOpen}
				currentAvatarUrl={user.avatarUrl}
				fallbackInitial={user.username?.charAt(0).toUpperCase() || "?"}
			/>
			<ChangeUsernameDialog
				open={usernameOpen}
				onOpenChange={setUsernameOpen}
				currentUsername={user.username}
			/>
			<ChangeEmailDialog
				open={emailOpen}
				onOpenChange={setEmailOpen}
				currentEmail={user.email}
			/>
			<DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
			<EditGenresDialog
				open={genresOpen}
				onOpenChange={setGenresOpen}
				currentGenreIds={genreIds}
			/>
			<EditFavouriteFilmDialog
				open={filmOpen}
				onOpenChange={setFilmOpen}
				currentTmdbId={user.favouriteFilmTmdbId}
				currentTitle={filmDetails.data?.title ?? null}
				currentPosterPath={filmDetails.data?.posterPath ?? null}
			/>
			<EditBioDialog
				open={bioOpen}
				onOpenChange={setBioOpen}
				currentBio={user.bio}
			/>
		</div>
	);
}

function SectionLabel({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<h2
			className={`mb-2 text-[9px] font-semibold uppercase tracking-wider text-cream/20 ${className}`}
		>
			{children}
		</h2>
	);
}

function SettingsRow({
	children,
	onClick,
	last,
	asLink,
}: {
	children: React.ReactNode;
	onClick: () => void;
	last: boolean;
	asLink?: string;
}) {
	const className = `flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-cream/[0.03] ${
		!last ? "border-b border-cream/[0.04]" : ""
	}`;

	if (asLink) {
		return (
			<Link to={asLink} className={className}>
				{children}
			</Link>
		);
	}

	return (
		<button type="button" onClick={onClick} className={className}>
			{children}
		</button>
	);
}
```

- [ ] **Step 2: Verify the page renders without errors**

Run: `bun run dev`
Navigate to `/app/settings` in the browser.
Expected: The new grouped layout renders with all sections visible.

- [ ] **Step 3: Commit**

```bash
git add src/routes/app/settings.tsx
git commit -m "feat: redesign settings page with grouped sections and inline taste profile"
```

---

### Task 8: Manual Smoke Test and Polish

- [ ] **Step 1: Test all existing dialogs still work**

Navigate to `/app/settings`. Click each Account row and verify:
- Profile Picture → opens avatar upload dialog
- Username → opens username change dialog
- Email → opens email change dialog
- Delete Account → opens delete confirmation dialog

- [ ] **Step 2: Test taste profile editing**

- Click Genres → verify genre picker opens, shows current selections, saves correctly
- Click Favorite Film → verify search works, selection saves correctly
- Click Bio → verify text input works, character counter shows, saves correctly

- [ ] **Step 3: Test data export**

- Click "Download" in Data & Privacy section
- Verify a JSON file downloads with the correct filename format
- Open the JSON and verify it contains profile, genres, watchlists, friends data

- [ ] **Step 4: Test blocked users navigation**

- Click "Blocked Users" → verify it navigates to `/app/settings/blocked`
- Verify the back navigation still works

- [ ] **Step 5: Fix any visual or functional issues found during testing**

Address spacing, alignment, truncation, or interaction issues discovered during manual testing.

- [ ] **Step 6: Final commit**

```bash
git add -u
git commit -m "fix: settings page polish after smoke testing"
```
