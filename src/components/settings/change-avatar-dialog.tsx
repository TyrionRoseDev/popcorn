import { generateReactHelpers } from "@uploadthing/react";
import heic2any from "heic2any";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { authClient } from "#/lib/auth-client";
import type { UploadRouter } from "#/lib/uploadthing";

const { useUploadThing } = generateReactHelpers<UploadRouter>({
	url: "/api/uploadthing",
});

interface ChangeAvatarDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentAvatarUrl: string | null | undefined;
	fallbackInitial: string;
}

export function ChangeAvatarDialog({
	open,
	onOpenChange,
	currentAvatarUrl,
	fallbackInitial,
}: ChangeAvatarDialogProps) {
	const [preview, setPreview] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const { startUpload, isUploading } = useUploadThing("avatarUploader", {
		onClientUploadComplete: async (res) => {
			if (res?.[0]) {
				setIsSaving(true);
				try {
					const { error: updateError } = await authClient.updateUser({
						avatarUrl: res[0].ufsUrl,
					});
					if (updateError) {
						setError(updateError.message ?? "Failed to save avatar");
					} else {
						onOpenChange(false);
					}
				} finally {
					setIsSaving(false);
				}
			}
		},
		onUploadError: (err) => {
			setError(err.message);
		},
	});

	function handleClose(nextOpen: boolean) {
		if (!nextOpen) {
			setPreview(null);
			setError("");
		}
		onOpenChange(nextOpen);
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		let file = e.target.files?.[0];
		if (!file) return;
		setError("");

		// Convert HEIC/HEIF (iPhone photos) to JPEG since browsers can't display them
		if (
			file.type === "image/heic" ||
			file.type === "image/heif" ||
			file.name.toLowerCase().endsWith(".heic") ||
			file.name.toLowerCase().endsWith(".heif")
		) {
			try {
				const blob = await heic2any({
					blob: file,
					toType: "image/jpeg",
					quality: 0.9,
				});
				file = new File(
					[blob as Blob],
					file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
					{ type: "image/jpeg" },
				);
			} catch {
				setError("Could not process this image. Try a JPEG or PNG instead.");
				return;
			}
		}

		setPreview(URL.createObjectURL(file));

		await startUpload([file]);
	}

	const busy = isUploading || isSaving;
	const displaySrc = preview || currentAvatarUrl;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="bg-drive-in-card border border-drive-in-border rounded-xl max-w-sm">
				<DialogHeader>
					<DialogTitle className="font-display text-cream">
						Profile Picture
					</DialogTitle>
					<DialogDescription className="text-cream/40">
						Upload a new profile picture.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center gap-4 py-4">
					{error && <p className="text-sm text-neon-pink">{error}</p>}

					<label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-cream/20 transition-colors hover:border-neon-cyan/40">
						{displaySrc ? (
							<img
								src={displaySrc}
								alt="Avatar preview"
								className="h-full w-full object-cover"
							/>
						) : (
							<span className="flex h-full w-full items-center justify-center bg-cream/10 text-2xl text-cream/30 group-hover:text-neon-cyan/60">
								{fallbackInitial}
							</span>
						)}
						<input
							type="file"
							accept="image/*"
							onChange={handleFileChange}
							disabled={busy}
							className="hidden"
						/>
						{/* Hover overlay */}
						<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
							<span className="text-xs font-medium text-cream">Change</span>
						</div>
					</label>

					{busy && (
						<p className="text-xs text-neon-cyan/60">
							{isSaving ? "Saving..." : "Uploading..."}
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
