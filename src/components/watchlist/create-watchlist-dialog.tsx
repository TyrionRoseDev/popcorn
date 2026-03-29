import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";

interface CreateWatchlistDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateWatchlistDialog({
	open,
	onOpenChange,
}: CreateWatchlistDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [isPublic, setIsPublic] = useState(false);

	const createMutation = useMutation(
		trpc.watchlist.create.mutationOptions({
			onSuccess: (newWatchlist) => {
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
				queryClient.invalidateQueries(
					trpc.watchlist.getForDropdown.queryFilter(),
				);
				toast.success(`Created "${newWatchlist.name}"`);
				setName("");
				setIsPublic(false);
				onOpenChange(false);
			},
		}),
	);

	function handleCreate() {
		const trimmed = name.trim();
		if (!trimmed) return;
		createMutation.mutate({ name: trimmed, isPublic });
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleCreate();
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					setName("");
					setIsPublic(false);
				}
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Create New Watchlist
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Give your watchlist a name and choose its visibility.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					{/* Name input */}
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="e.g. Friday Night Horror"
						disabled={createMutation.isPending}
						autoFocus
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-amber/40 focus:outline-none disabled:opacity-50"
					/>

					{/* Public/Private toggle */}
					<button
						type="button"
						onClick={() => setIsPublic((prev) => !prev)}
						className="flex items-center gap-2.5 rounded-lg border border-cream/8 bg-cream/4 px-3.5 py-2.5 text-sm text-cream/60 transition-colors hover:text-cream/80 hover:border-cream/15"
					>
						{isPublic ? (
							<>
								<Eye className="h-4 w-4 text-neon-cyan" />
								<span>
									Public{" "}
									<span className="text-cream/30">&mdash; anyone can view</span>
								</span>
							</>
						) : (
							<>
								<EyeOff className="h-4 w-4 text-cream/40" />
								<span>
									Private{" "}
									<span className="text-cream/30">&mdash; members only</span>
								</span>
							</>
						)}
					</button>
				</div>

				<DialogFooter>
					{/* Cancel */}
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						disabled={createMutation.isPending}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>

					{/* Create */}
					<button
						type="button"
						onClick={handleCreate}
						disabled={!name.trim() || createMutation.isPending}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-amber/45 bg-neon-amber/10 px-5 py-2 text-sm font-bold text-neon-amber transition-colors hover:bg-neon-amber/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{createMutation.isPending ? "Creating..." : "Create"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
