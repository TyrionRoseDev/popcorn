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
				queryClient.invalidateQueries(trpc.journalEntry.getAll.queryFilter());
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
									{scopeLabel(
										entry.scope,
										entry.seasonNumber,
										entry.episodeNumber,
									)}
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
