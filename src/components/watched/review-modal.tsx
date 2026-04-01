import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { RecommendModal } from "./recommend-modal";
import { StarRating } from "./star-rating";
import type { Companion } from "./watched-with-modal";
import { WatchedWithModal } from "./watched-with-modal";

interface WatchEventModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	year?: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	/** If provided, modal is in edit mode */
	editEvent?: {
		id: string;
		rating: number | null;
		note: string | null;
		watchedAt: string;
		companions: Companion[];
	};
}

function toLocalDatetime(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReviewModal({
	open,
	onOpenChange,
	titleName,
	year,
	tmdbId,
	mediaType,
	editEvent,
}: WatchEventModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [rating, setRating] = useState<number | null>(null);
	const [note, setNote] = useState("");
	const [watchedAt, setWatchedAt] = useState("");
	const [companions, setCompanions] = useState<Companion[]>([]);
	const [watchedWithOpen, setWatchedWithOpen] = useState(false);
	const [recommendOpen, setRecommendOpen] = useState(false);

	useEffect(() => {
		if (open) {
			if (editEvent) {
				setRating(editEvent.rating);
				setNote(editEvent.note ?? "");
				setWatchedAt(editEvent.watchedAt.slice(0, 16));
				setCompanions(editEvent.companions);
			} else {
				setRating(null);
				setNote("");
				setWatchedAt(toLocalDatetime(new Date()));
				setCompanions([]);
			}
		}
	}, [open, editEvent]);

	function invalidateQueries() {
		queryClient.invalidateQueries(trpc.watchEvent.getForTitle.queryFilter());
		queryClient.invalidateQueries(trpc.watchEvent.getUserEvents.queryFilter());
		queryClient.invalidateQueries(
			trpc.watchEvent.getLatestRating.queryFilter(),
		);
		queryClient.invalidateQueries(trpc.watchEvent.getFeed.queryFilter());
		queryClient.invalidateQueries(trpc.friend.genreStats.queryFilter());
		queryClient.invalidateQueries(trpc.friend.watchActivity.queryFilter());
		queryClient.invalidateQueries(trpc.friend.profile.queryFilter());
	}

	const createEvent = useMutation(
		trpc.watchEvent.create.mutationOptions({
			onSuccess: () => {
				invalidateQueries();
				handleClose();
			},
		}),
	);

	const updateEvent = useMutation(
		trpc.watchEvent.update.mutationOptions({
			onSuccess: () => {
				invalidateQueries();
				handleClose();
			},
		}),
	);

	function handleClose() {
		setRating(null);
		setNote("");
		setCompanions([]);
		onOpenChange(false);
	}

	function handleSave() {
		const watchedAtISO = watchedAt
			? new Date(watchedAt).toISOString()
			: undefined;

		if (editEvent) {
			updateEvent.mutate({
				id: editEvent.id,
				rating: rating ?? null,
				note: note.trim() || null,
				watchedAt: watchedAtISO,
				companions,
				titleName,
			});
		} else {
			createEvent.mutate({
				tmdbId,
				mediaType,
				rating: rating ?? undefined,
				note: note.trim() || undefined,
				watchedAt: watchedAtISO,
				companions,
				titleName,
			});
		}
	}

	const isPending = createEvent.isPending || updateEvent.isPending;

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogPortal>
					<DialogOverlay />
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-[360px] flex flex-col items-center">
							{/* Marquee header */}
							<div className="w-[calc(100%-16px)] border-2 border-neon-amber/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,184,0,0.08)] relative">
								<button
									type="button"
									onClick={handleClose}
									className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
								>
									<X className="w-4 h-4" />
								</button>
								<div className="flex justify-center gap-3 mb-1.5">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={`dot-${i.toString()}`}
											className="w-1.5 h-1.5 rounded-full bg-neon-amber shadow-[0_0_4px_1px_rgba(255,184,0,0.6)] animate-[chase_1.2s_infinite]"
											style={{
												animationDelay: `${i * 0.15}s`,
											}}
										/>
									))}
								</div>
								<div className="font-display text-2xl text-cream tracking-wide">
									{editEvent ? "Edit" : "Watched"}
								</div>
								<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-amber/55 mt-0.5">
									{titleName} {year ? `· ${year}` : ""}
								</div>
							</div>

							{/* Modal card */}
							<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
								<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />
								<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

								<div className="p-5 flex flex-col gap-5 relative">
									{/* Stars */}
									<StarRating value={rating} onChange={setRating} />

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Note */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Your Review
										</div>
										<textarea
											value={note}
											onChange={(e) => setNote(e.target.value)}
											placeholder="Share your thoughts…"
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-3 min-h-16 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-cyan/20 resize-none transition-colors duration-200"
										/>
									</div>

									{/* Date & time */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Watched On
										</div>
										<input
											type="datetime-local"
											value={watchedAt}
											onChange={(e) => setWatchedAt(e.target.value)}
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-2.5 font-mono-retro text-sm text-cream focus:outline-none focus:border-neon-cyan/20 transition-colors duration-200 [color-scheme:dark]"
										/>
									</div>

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Recommend to friend */}
									<button
										type="button"
										onClick={() => setRecommendOpen(true)}
										className="flex items-center gap-3 px-3.5 py-2.5 bg-neon-pink/[0.04] border border-neon-pink/15 rounded-md cursor-pointer hover:border-neon-pink/30 hover:shadow-[0_0_16px_rgba(255,45,120,0.08)] transition-all duration-200"
									>
										<div className="w-7 h-7 rounded-full bg-neon-pink/10 border border-neon-pink/20 flex items-center justify-center text-sm shrink-0">
											📽️
										</div>
										<span className="flex-1 text-left text-sm font-semibold text-neon-pink/75">
											Recommend to a friend
										</span>
										<span className="text-base text-neon-pink/30">›</span>
									</button>

									{/* Watched with */}
									<button
										type="button"
										onClick={() => setWatchedWithOpen(true)}
										className="flex items-center gap-3 px-3.5 py-2.5 bg-neon-cyan/[0.04] border border-neon-cyan/15 rounded-md cursor-pointer hover:border-neon-cyan/30 hover:shadow-[0_0_16px_rgba(0,229,255,0.08)] transition-all duration-200"
									>
										<div className="w-7 h-7 rounded-full bg-neon-cyan/10 border border-neon-cyan/20 flex items-center justify-center text-sm shrink-0">
											👥
										</div>
										<span className="flex-1 text-left text-sm font-semibold text-neon-cyan/75">
											{companions.length > 0
												? `Watched with ${companions.map((c) => c.name).join(", ")}`
												: "Watched with…"}
										</span>
										<span className="text-base text-neon-cyan/30">›</span>
									</button>

									{/* Save button */}
									<button
										type="button"
										onClick={handleSave}
										disabled={isPending}
										className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50"
									>
										{editEvent ? "Save Changes" : "Save & Done"}
									</button>

									{/* Skip (create mode only) */}
									{!editEvent && (
										<div className="flex justify-center items-center gap-6">
											<button
												type="button"
												onClick={handleClose}
												className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/25 hover:text-cream/50 transition-colors duration-200 py-1.5"
											>
												skip
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</DialogPortal>
			</Dialog>
			<WatchedWithModal
				open={watchedWithOpen}
				onOpenChange={setWatchedWithOpen}
				value={companions}
				onChange={setCompanions}
			/>
			<RecommendModal
				open={recommendOpen}
				onOpenChange={setRecommendOpen}
				tmdbId={tmdbId}
				mediaType={mediaType}
				titleName={titleName}
			/>
		</>
	);
}
