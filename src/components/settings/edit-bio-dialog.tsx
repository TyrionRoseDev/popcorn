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
							onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
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
