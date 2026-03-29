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

interface ChangeEmailDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentEmail: string;
}

export function ChangeEmailDialog({
	open,
	onOpenChange,
	currentEmail,
}: ChangeEmailDialogProps) {
	const [newEmail, setNewEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setNewEmail("");
			setError("");
			setSent(false);
		}
		onOpenChange(nextOpen);
	}

	async function handleSave() {
		setError("");
		setLoading(true);
		try {
			const { error: changeError } = await authClient.changeEmail({
				newEmail,
				callbackURL: "/app/settings",
			});
			if (changeError) {
				setError(changeError.message ?? "Failed to send verification email");
			} else {
				setSent(true);
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

	const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
	const isSameEmail = newEmail.toLowerCase() === currentEmail.toLowerCase();

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Email Address
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						{sent
							? "Check your inbox to verify the change."
							: `Currently ${currentEmail}`}
					</DialogDescription>
				</DialogHeader>

				{sent ? (
					<div className="py-4 text-center">
						<p className="text-sm text-cream/60">
							We sent a verification link to{" "}
							<span className="font-medium text-neon-cyan">{newEmail}</span>.
							Click the link to confirm your new email.
						</p>
					</div>
				) : (
					<>
						<div className="flex flex-col gap-3 py-2">
							{error && <p className="text-sm text-neon-pink">{error}</p>}

							<input
								type="email"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="New email address"
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
								disabled={!isValidEmail || isSameEmail || loading}
								className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/45 bg-neon-cyan/10 px-5 py-2 text-sm font-bold text-neon-cyan transition-colors hover:bg-neon-cyan/18 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								{loading ? "Sending..." : "Send Verification"}
							</button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
