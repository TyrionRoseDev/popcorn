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

interface ChangeUsernameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentUsername: string | null | undefined;
}

export function ChangeUsernameDialog({
	open,
	onOpenChange,
	currentUsername,
}: ChangeUsernameDialogProps) {
	const [username, setUsername] = useState(currentUsername ?? "");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setUsername(currentUsername ?? "");
			setError("");
		}
		onOpenChange(nextOpen);
	}

	async function handleSave() {
		setError("");
		setLoading(true);
		try {
			const { error: updateError } = await authClient.updateUser({ username });
			if (updateError) {
				setError(updateError.message ?? "Username may be taken");
			} else {
				onOpenChange(false);
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
	}

	const isValid = username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
	const isUnchanged = username === (currentUsername ?? "");

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Username
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						3-24 characters, letters, numbers, and underscores only.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-3 py-2">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<input
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						onKeyDown={handleKeyDown}
						minLength={3}
						maxLength={24}
						pattern="^[a-zA-Z0-9_]+$"
						autoFocus
						disabled={loading}
						className="w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none disabled:opacity-50"
					/>
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
						onClick={handleSave}
						disabled={!isValid || isUnchanged || loading}
						className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
					>
						{loading ? "Saving..." : "Save"}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
