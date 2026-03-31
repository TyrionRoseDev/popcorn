import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { RecommendModal } from "./recommend-modal";
import { StarRating } from "./star-rating";

interface ReviewModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	watchEventId: string | null;
	titleName: string;
	year?: string;
	tmdbId: number;
	mediaType: "movie" | "tv";
	defaultWatchedAt?: Date;
	isReminder?: boolean;
}

export function ReviewModal({
	open,
	onOpenChange,
	watchEventId,
	titleName,
	year,
	tmdbId,
	mediaType,
	defaultWatchedAt,
	isReminder = false,
}: ReviewModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [rating, setRating] = useState<number | null>(null);
	const [reviewText, setReviewText] = useState("");
	const [watchedAt, setWatchedAt] = useState(defaultWatchedAt ?? new Date());
	const [recommendOpen, setRecommendOpen] = useState(false);

	const updateReview = useMutation(
		trpc.watched.updateReview.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.watched.getForTitle.queryFilter({ tmdbId, mediaType }),
				);
				queryClient.invalidateQueries(
					trpc.watched.getCount.queryFilter({ tmdbId, mediaType }),
				);
				handleClose();
			},
		}),
	);

	const setReminder = useMutation(
		trpc.watched.setReminder.mutationOptions({
			onSuccess: () => handleClose(),
		}),
	);

	function handleClose() {
		setRating(null);
		setReviewText("");
		onOpenChange(false);
	}

	function handleSave() {
		if (!watchEventId) return;
		updateReview.mutate({
			watchEventId,
			rating,
			reviewText: reviewText.trim() || null,
			watchedAt: watchedAt.toISOString(),
		});
	}

	function handleSkip() {
		handleClose();
	}

	function handleRemindLater() {
		if (!watchEventId) return;
		setReminder.mutate({ watchEventId });
	}

	const dateStr = watchedAt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const timeStr = watchedAt.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogPortal>
					<DialogOverlay />
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-[360px] flex flex-col items-center">
							{/* Marquee header */}
							<div className="w-[calc(100%-16px)] border-2 border-neon-amber/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(255,184,0,0.08)]">
								<div className="flex justify-center gap-3 mb-1.5">
									{Array.from({ length: 8 }).map((_, i) => (
										<div
											key={`dot-${i.toString()}`}
											className="w-1.5 h-1.5 rounded-full bg-neon-amber shadow-[0_0_4px_1px_rgba(255,184,0,0.6)] animate-[chase_1.2s_infinite]"
											style={{ animationDelay: `${i * 0.15}s` }}
										/>
									))}
								</div>
								<div className="font-display text-2xl text-cream tracking-wide">
									Watched
								</div>
								<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-amber/55 mt-0.5">
									{titleName} {year ? `· ${year}` : ""}
								</div>
							</div>

							{/* Modal card */}
							<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
								{/* Top edge glow */}
								<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />
								{/* Inner light wash */}
								<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

								<div className="p-5 flex flex-col gap-5 relative">
									{/* Stars */}
									<StarRating value={rating} onChange={setRating} />

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Review text */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Your Review
										</div>
										<textarea
											value={reviewText}
											onChange={(e) => setReviewText(e.target.value)}
											placeholder="Share your thoughts…"
											className="w-full bg-black/30 border border-cream/[0.06] rounded-md px-3.5 py-3 min-h-16 font-sans text-sm text-cream placeholder:text-cream/25 placeholder:italic leading-relaxed shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] focus:outline-none focus:border-neon-cyan/20 resize-none transition-colors duration-200"
										/>
									</div>

									{/* Date & Time */}
									<div>
										<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
											Watched On
										</div>
										<label className="flex items-center gap-4 bg-black/25 border border-cream/[0.06] rounded-md px-3.5 py-2.5 cursor-pointer hover:border-neon-cyan/20 transition-colors duration-200 relative">
											<span className="text-base opacity-40">📅</span>
											<div className="flex-1 flex flex-col gap-px">
												<div className="font-mono-retro text-[9px] tracking-[2px] uppercase text-cream/25">
													Date & Time
												</div>
												<div className="font-mono-retro text-sm text-cream tracking-wide">
													{dateStr} · {timeStr}
												</div>
											</div>
											<input
												type="datetime-local"
												value={watchedAt.toISOString().slice(0, 16)}
												onChange={(e) => {
													if (e.target.value) {
														setWatchedAt(new Date(e.target.value));
													}
												}}
												className="absolute inset-0 opacity-0 cursor-pointer"
											/>
											<span className="font-mono-retro text-[9px] tracking-[1px] text-neon-cyan/45">
												change
											</span>
										</label>
									</div>

									<div className="h-px bg-gradient-to-r from-transparent via-cream/[0.06] to-transparent" />

									{/* Recommend to friend */}
									{!isReminder && (
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
									)}

									{/* Save button */}
									<button
										type="button"
										onClick={handleSave}
										disabled={updateReview.isPending}
										className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50"
									>
										Save & Done
									</button>

									{/* Secondary actions */}
									<div className="flex justify-center items-center gap-6">
										<button
											type="button"
											onClick={handleSkip}
											className="font-mono-retro text-[10px] tracking-[2px] uppercase text-cream/25 hover:text-cream/50 transition-colors duration-200 py-1.5"
										>
											skip
										</button>
										{!isReminder && (
											<>
												<span className="text-cream/10 text-xs">·</span>
												<button
													type="button"
													onClick={handleRemindLater}
													disabled={setReminder.isPending}
													className="font-mono-retro text-[10px] tracking-[2px] uppercase text-neon-amber/40 hover:text-neon-amber/70 transition-colors duration-200 py-1.5 disabled:opacity-50"
												>
													remind me later
												</button>
											</>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</DialogPortal>
			</Dialog>
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
