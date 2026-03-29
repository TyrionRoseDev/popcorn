import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";

interface DeleteAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
	open,
	onOpenChange,
}: DeleteAccountDialogProps) {
	const navigate = useNavigate();
	const [confirmation, setConfirmation] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setConfirmation("");
			setError("");
		}
		onOpenChange(nextOpen);
	}

	async function handleDelete() {
		setError("");
		setLoading(true);
		try {
			const { error: deleteError } = await authClient.deleteUser();
			if (deleteError) {
				setError(deleteError.message ?? "Failed to delete account");
				setLoading(false);
			} else {
				navigate({ to: "/" });
			}
		} catch {
			setError("Something went wrong");
			setLoading(false);
		}
	}

	const isConfirmed = confirmation === "DELETE";

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-neon-pink">
						Delete Account
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						This action is permanent and cannot be undone. All your data
						including watchlists, swipe history, and preferences will be
						deleted.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<label className="flex flex-col gap-2">
						<span className="text-xs text-cream/40">
							Type{" "}
							<span className="font-mono font-bold text-cream/60">DELETE</span>{" "}
							to confirm
						</span>
						<input
							type="text"
							value={confirmation}
							onChange={(e) => setConfirmation(e.target.value)}
							placeholder="DELETE"
							autoFocus
							disabled={loading}
							className="w-full rounded-lg border border-neon-pink/20 bg-neon-pink/5 px-3.5 py-3 text-sm text-cream placeholder:text-cream/20 focus:border-neon-pink/40 focus:outline-none disabled:opacity-50"
						/>
					</label>
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => handleClose(false)}
						disabled={loading}
						className="rounded-lg px-4 py-2 text-sm text-cream/50 transition-colors hover:text-cream/80 hover:bg-cream/5 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleDelete}
						disabled={!isConfirmed || loading}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-pink/45 bg-neon-pink/10 px-5 py-2 text-sm font-bold text-neon-pink transition-colors hover:bg-neon-pink/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{loading ? "Deleting..." : "Delete Account"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
