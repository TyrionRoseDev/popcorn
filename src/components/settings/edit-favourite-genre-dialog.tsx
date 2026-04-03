import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface EditFavouriteGenreDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentGenreId: number | null | undefined;
}

export function EditFavouriteGenreDialog({
	open,
	onOpenChange,
	currentGenreId,
}: EditFavouriteGenreDialogProps) {
	const [selectedId, setSelectedId] = useState<number | null>(
		currentGenreId ?? null,
	);
	const [error, setError] = useState("");
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const genresQuery = useQuery(trpc.tasteProfile.getGenres.queryOptions());
	const genres = genresQuery.data ?? [];

	const updateGenre = useMutation(
		trpc.tasteProfile.updateFavouriteGenre.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries();
				onOpenChange(false);
			},
			onError: () => setError("Something went wrong"),
		}),
	);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setSelectedId(currentGenreId ?? null);
			setError("");
		}
		onOpenChange(nextOpen);
	}

	function handleSave() {
		setError("");
		updateGenre.mutate({ genreId: selectedId });
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Favourite Genre
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Pick the one genre you love most.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<div className="grid grid-cols-3 gap-2">
						{genres.map((genre) => {
							const isSelected = selectedId === genre.id;
							return (
								<button
									key={genre.id}
									type="button"
									onClick={() =>
										setSelectedId((prev) =>
											prev === genre.id ? null : genre.id,
										)
									}
									disabled={updateGenre.isPending}
									className={`rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 ${
										isSelected
											? "border-neon-pink/60 bg-neon-pink/15 text-neon-pink shadow-[0_0_12px_rgba(255,45,120,0.2)]"
											: "border-cream/12 bg-cream/5 text-cream/70 hover:border-cream/25 hover:text-cream"
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
						disabled={updateGenre.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={updateGenre.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{updateGenre.isPending ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
