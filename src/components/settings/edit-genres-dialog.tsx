import { useMutation, useQueryClient } from "@tanstack/react-query";
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
									disabled={!isSelected && selected.size >= MAX_GENRES}
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
