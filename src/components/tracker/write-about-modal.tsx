import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	BookOpen,
	ChevronRight,
	Globe,
	Lock,
	Star,
	X,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";
import { Switch } from "#/components/ui/switch";
import { ReviewModal } from "#/components/watched/review-modal";
import { useTRPC } from "#/integrations/trpc/react";

type Scope = "episode" | "season" | "show";
type EntryType = "note" | "review";
type Step =
	| "choose-type"
	| "choose-scope"
	| "pick-season"
	| "pick-episode"
	| "write-note"
	| "completion-check";

interface WriteAboutModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	tmdbId: number;
	titleName: string;
	year: string;
	mediaType: "tv";
	seasonList: Array<{
		seasonNumber: number;
		episodeCount: number;
		name: string;
	}>;
	watchedEpisodes: Array<{ seasonNumber: number; episodeNumber: number }>;
}

function scopeLabel(
	scope: Scope,
	seasonNumber?: number,
	episodeNumber?: number,
	entryType?: EntryType | null,
): string {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	return entryType === "note" ? "General" : "Full Show";
}

function scopeTitleSuffix(
	scope: Scope,
	seasonNumber?: number,
	episodeNumber?: number,
): string {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return ` — S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return ` — Season ${seasonNumber}`;
	}
	return "";
}

export function WriteAboutModal({
	open,
	onOpenChange,
	tmdbId,
	titleName,
	year,
	seasonList,
	watchedEpisodes,
}: WriteAboutModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [step, setStep] = useState<Step>("choose-type");
	const [entryType, setEntryType] = useState<EntryType | null>(null);
	const [scope, setScope] = useState<Scope | null>(null);
	const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
	const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
	const [note, setNote] = useState("");
	const [isPublic, setIsPublic] = useState(false);
	const [reviewOpen, setReviewOpen] = useState(false);

	// Reset state when modal opens/closes
	useEffect(() => {
		if (open) {
			setStep("choose-type");
			setEntryType(null);
			setScope(null);
			setSelectedSeason(null);
			setSelectedEpisode(null);
			setNote("");
			setIsPublic(false);
			setReviewOpen(false);
		}
	}, [open]);

	const watchedSet = useMemo(() => {
		const set = new Set<string>();
		for (const ep of watchedEpisodes) {
			set.add(`S${ep.seasonNumber}E${ep.episodeNumber}`);
		}
		return set;
	}, [watchedEpisodes]);

	// Check completion for given scope
	const checkCompletion = useCallback(
		(
			s: Scope,
			sn?: number,
			en?: number,
		): {
			complete: boolean;
			missing: Array<{ seasonNumber: number; episodeNumber: number }>;
		} => {
			const missing: Array<{ seasonNumber: number; episodeNumber: number }> =
				[];

			if (s === "episode" && sn != null && en != null) {
				if (!watchedSet.has(`S${sn}E${en}`)) {
					missing.push({ seasonNumber: sn, episodeNumber: en });
				}
			} else if (s === "season" && sn != null) {
				const season = seasonList.find((sl) => sl.seasonNumber === sn);
				if (season) {
					for (let ep = 1; ep <= season.episodeCount; ep++) {
						if (!watchedSet.has(`S${sn}E${ep}`)) {
							missing.push({ seasonNumber: sn, episodeNumber: ep });
						}
					}
				}
			} else if (s === "show") {
				for (const season of seasonList) {
					for (let ep = 1; ep <= season.episodeCount; ep++) {
						if (!watchedSet.has(`S${season.seasonNumber}E${ep}`)) {
							missing.push({
								seasonNumber: season.seasonNumber,
								episodeNumber: ep,
							});
						}
					}
				}
			}

			return { complete: missing.length === 0, missing };
		},
		[watchedSet, seasonList],
	);

	const createJournalEntry = useMutation(
		trpc.journalEntry.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.journalEntry.getForShow.queryFilter(),
				);
				toast.success("Note saved");
				onOpenChange(false);
			},
			onError: () => {
				toast.error("Failed to save note");
			},
		}),
	);

	const markEpisodes = useMutation(
		trpc.episodeTracker.markEpisodes.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.episodeTracker.getForShow.queryFilter(),
				);
				queryClient.invalidateQueries(
					trpc.episodeTracker.getTrackedShows.queryFilter(),
				);
			},
			onError: () => {
				toast.error("Failed to mark episodes");
			},
		}),
	);

	function handleChooseType(type: EntryType) {
		setEntryType(type);
		setStep("choose-scope");
	}

	function handleChooseScope(s: Scope) {
		setScope(s);
		if (s === "show") {
			if (entryType === "note") {
				setStep("write-note");
			} else {
				// Review: check completion
				const { complete } = checkCompletion(s);
				if (!complete) {
					setStep("completion-check");
				} else {
					openReviewModal();
				}
			}
		} else if (s === "season" || s === "episode") {
			setStep("pick-season");
		}
	}

	function handlePickSeason(sn: number) {
		setSelectedSeason(sn);
		if (scope === "season") {
			if (entryType === "note") {
				setStep("write-note");
			} else {
				const { complete } = checkCompletion("season", sn);
				if (!complete) {
					setStep("completion-check");
				} else {
					openReviewModal();
				}
			}
		} else {
			// episode scope — pick episode next
			setStep("pick-episode");
		}
	}

	function handlePickEpisode(en: number) {
		setSelectedEpisode(en);
		if (entryType === "note") {
			setStep("write-note");
		} else {
			const { complete } = checkCompletion("episode", selectedSeason!, en);
			if (!complete) {
				setStep("completion-check");
			} else {
				openReviewModal();
			}
		}
	}

	function openReviewModal() {
		onOpenChange(false);
		// Small delay to let the write-about modal close before opening review
		setTimeout(() => setReviewOpen(true), 150);
	}

	function handleMarkAsComplete() {
		const { missing } = checkCompletion(
			scope!,
			selectedSeason ?? undefined,
			selectedEpisode ?? undefined,
		);
		if (missing.length > 0) {
			markEpisodes.mutate(
				{
					tmdbId,
					episodes: missing.map((ep) => ({
						seasonNumber: ep.seasonNumber,
						episodeNumber: ep.episodeNumber,
						runtime: 0,
					})),
				},
				{
					onSuccess: () => {
						toast.success(
							`Marked ${missing.length} episode${missing.length > 1 ? "s" : ""} as watched`,
						);
						openReviewModal();
					},
				},
			);
		}
	}

	function handleContinueAnyway() {
		openReviewModal();
	}

	function handleSubmitNote() {
		if (!note.trim() || !scope) return;
		createJournalEntry.mutate({
			tmdbId,
			titleName,
			scope,
			seasonNumber: selectedSeason ?? undefined,
			episodeNumber: selectedEpisode ?? undefined,
			note: note.trim(),
			isPublic,
		});
	}

	function handleBack() {
		if (step === "choose-scope") {
			setStep("choose-type");
			setEntryType(null);
		} else if (step === "pick-season") {
			setStep("choose-scope");
			setSelectedSeason(null);
		} else if (step === "pick-episode") {
			setStep("pick-season");
			setSelectedEpisode(null);
		} else if (step === "write-note") {
			if (scope === "show") {
				setStep("choose-scope");
			} else if (scope === "episode" && selectedEpisode != null) {
				setStep("pick-episode");
			} else if (scope === "season") {
				setStep("pick-season");
			}
		} else if (step === "completion-check") {
			if (scope === "show") {
				setStep("choose-scope");
			} else if (scope === "episode" && selectedEpisode != null) {
				setStep("pick-episode");
			} else if (scope === "season") {
				setStep("pick-season");
			}
		}
	}

	function handleClose() {
		onOpenChange(false);
	}

	// Step index for progress dots
	const stepIndex =
		step === "choose-type"
			? 0
			: step === "choose-scope"
				? 1
				: step === "pick-season" || step === "pick-episode"
					? 2
					: 3;
	const totalSteps = 4;

	const selectedSeasonData =
		selectedSeason != null
			? seasonList.find((s) => s.seasonNumber === selectedSeason)
			: null;

	const reviewTitleName = `${titleName}${scopeTitleSuffix(scope ?? "show", selectedSeason ?? undefined, selectedEpisode ?? undefined)}`;

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogPortal>
					<DialogOverlay />
					<DialogPrimitive.Content
						asChild
						aria-describedby={undefined}
						aria-label={`Write about ${titleName}`}
					>
						<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
							<div className="w-full max-w-[380px] flex flex-col items-center">
								{/* Marquee header */}
								<div className="w-[calc(100%-16px)] border-2 border-neon-cyan/20 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.06)] relative">
									{step !== "choose-type" && (
										<button
											type="button"
											onClick={handleBack}
											className="absolute top-2.5 left-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
										>
											<ArrowLeft className="w-4 h-4" />
										</button>
									)}
									<button
										type="button"
										onClick={handleClose}
										className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
									>
										<X className="w-4 h-4" />
									</button>

									{/* Progress dots */}
									<div className="flex justify-center gap-2 mb-1.5">
										{Array.from({ length: totalSteps }).map((_, i) => (
											<div
												key={`step-${i.toString()}`}
												className="w-1.5 h-1.5 rounded-full transition-all duration-300"
												style={{
													background:
														i <= stepIndex
															? "rgba(0,229,255,0.8)"
															: "rgba(255,255,240,0.1)",
													boxShadow:
														i <= stepIndex
															? "0 0 6px rgba(0,229,255,0.5)"
															: "none",
												}}
											/>
										))}
									</div>

									<div className="font-display text-xl text-cream tracking-wide">
										Write About This
									</div>
									<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/40 mt-0.5">
										{titleName} {year ? `\u00B7 ${year}` : ""}
									</div>
								</div>

								{/* Modal card */}
								<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
									<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.3)]" />
									<div className="absolute top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-cream/[0.015] to-transparent pointer-events-none" />

									<div className="p-5 flex flex-col gap-4 relative">
										{/* Step 1: Choose type */}
										{step === "choose-type" && (
											<>
												<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 text-center mb-1">
													What would you like to write?
												</div>
												<div className="flex gap-3">
													<button
														type="button"
														onClick={() => handleChooseType("note")}
														className="flex-1 flex flex-col items-center gap-3 p-5 rounded-lg border border-cream/[0.06] bg-black/20 cursor-pointer transition-all duration-200 hover:border-neon-cyan/25 hover:bg-neon-cyan/[0.03] hover:shadow-[0_0_20px_rgba(0,229,255,0.06)] group"
													>
														<div className="w-12 h-12 rounded-full bg-neon-cyan/[0.06] border border-neon-cyan/15 flex items-center justify-center transition-all duration-200 group-hover:bg-neon-cyan/10 group-hover:border-neon-cyan/30 group-hover:shadow-[0_0_12px_rgba(0,229,255,0.15)]">
															<BookOpen className="w-5 h-5 text-neon-cyan/60 group-hover:text-neon-cyan/90 transition-colors" />
														</div>
														<div>
															<div className="font-display text-sm text-cream/80 tracking-wide group-hover:text-cream">
																Note
															</div>
															<div className="font-mono-retro text-[9px] text-cream/25 tracking-wide mt-0.5">
																Journal your thoughts
															</div>
														</div>
													</button>

													<button
														type="button"
														onClick={() => handleChooseType("review")}
														className="flex-1 flex flex-col items-center gap-3 p-5 rounded-lg border border-cream/[0.06] bg-black/20 cursor-pointer transition-all duration-200 hover:border-neon-amber/25 hover:bg-neon-amber/[0.03] hover:shadow-[0_0_20px_rgba(255,184,0,0.06)] group"
													>
														<div className="w-12 h-12 rounded-full bg-neon-amber/[0.06] border border-neon-amber/15 flex items-center justify-center transition-all duration-200 group-hover:bg-neon-amber/10 group-hover:border-neon-amber/30 group-hover:shadow-[0_0_12px_rgba(255,184,0,0.15)]">
															<Star className="w-5 h-5 text-neon-amber/60 group-hover:text-neon-amber/90 transition-colors" />
														</div>
														<div>
															<div className="font-display text-sm text-cream/80 tracking-wide group-hover:text-cream">
																Review
															</div>
															<div className="font-mono-retro text-[9px] text-cream/25 tracking-wide mt-0.5">
																Rate &amp; review
															</div>
														</div>
													</button>
												</div>
											</>
										)}

										{/* Step 2: Choose scope */}
										{step === "choose-scope" && (
											<>
												<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 text-center mb-1">
													What are you writing about?
												</div>
												<div className="flex flex-col gap-2">
													<ScopeOption
														label="Specific Episode"
														sublabel="A single episode"
														onClick={() => handleChooseScope("episode")}
														accentColor="neon-cyan"
													/>
													<ScopeOption
														label="Full Season"
														sublabel="An entire season"
														onClick={() => handleChooseScope("season")}
														accentColor="neon-cyan"
													/>
													<ScopeOption
														label={
															entryType === "note" ? "General" : "Full Show"
														}
														sublabel={
															entryType === "note"
																? "About the show in general"
																: "The whole series"
														}
														onClick={() => handleChooseScope("show")}
														accentColor="neon-cyan"
													/>
												</div>
											</>
										)}

										{/* Pick season */}
										{step === "pick-season" && (
											<>
												<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 text-center mb-1">
													Pick a season
												</div>
												<div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto scrollbar-hide">
													{seasonList.map((season) => (
														<button
															key={season.seasonNumber}
															type="button"
															onClick={() =>
																handlePickSeason(season.seasonNumber)
															}
															className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-md border border-cream/[0.06] bg-black/20 cursor-pointer transition-all duration-200 hover:border-neon-cyan/20 hover:bg-neon-cyan/[0.03] group"
														>
															<div className="flex items-center gap-3 min-w-0">
																<span className="font-mono-retro text-[11px] text-neon-cyan/50 tracking-wide shrink-0 group-hover:text-neon-cyan/80 transition-colors">
																	S{season.seasonNumber}
																</span>
																<span className="text-sm text-cream/70 truncate group-hover:text-cream/90 transition-colors">
																	{season.name}
																</span>
															</div>
															<div className="flex items-center gap-2 shrink-0">
																<span className="font-mono-retro text-[10px] text-cream/20">
																	{season.episodeCount} ep
																</span>
																<ChevronRight className="w-3.5 h-3.5 text-cream/15 group-hover:text-cream/40 transition-colors" />
															</div>
														</button>
													))}
												</div>
											</>
										)}

										{/* Pick episode */}
										{step === "pick-episode" && selectedSeasonData && (
											<>
												<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 text-center mb-1">
													Pick an episode from {selectedSeasonData.name}
												</div>
												<div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto scrollbar-hide">
													{Array.from(
														{ length: selectedSeasonData.episodeCount },
														(_, i) => i + 1,
													).map((ep) => {
														const isWatched = watchedSet.has(
															`S${selectedSeason}E${ep}`,
														);
														return (
															<button
																key={ep}
																type="button"
																onClick={() => handlePickEpisode(ep)}
																className={`relative flex items-center justify-center h-10 rounded-md border cursor-pointer transition-all duration-200 hover:scale-105 ${
																	isWatched
																		? "border-neon-cyan/20 bg-neon-cyan/[0.06] hover:border-neon-cyan/35"
																		: "border-cream/[0.06] bg-black/20 hover:border-cream/15"
																}`}
															>
																<span
																	className={`font-mono-retro text-xs tracking-wide ${
																		isWatched
																			? "text-neon-cyan/70"
																			: "text-cream/40"
																	}`}
																>
																	E{ep}
																</span>
																{isWatched && (
																	<div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-neon-cyan/60" />
																)}
															</button>
														);
													})}
												</div>
											</>
										)}

										{/* Write note */}
										{step === "write-note" && (
											<>
												{/* Scope badge */}
												<div className="flex items-center justify-center">
													<span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neon-cyan/[0.06] border border-neon-cyan/15 font-mono-retro text-[10px] tracking-wider text-neon-cyan/60">
														{scopeLabel(
															scope!,
															selectedSeason ?? undefined,
															selectedEpisode ?? undefined,
															entryType,
														)}
													</span>
												</div>

												<div>
													<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-2">
														Your Note
													</div>
													<textarea
														value={note}
														onChange={(e) =>
															setNote(e.target.value.slice(0, 2000))
														}
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

												{/* Submit */}
												<button
													type="button"
													onClick={handleSubmitNote}
													disabled={
														!note.trim() || createJournalEntry.isPending
													}
													className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
												>
													{createJournalEntry.isPending
														? "Saving..."
														: "Save Note"}
												</button>
											</>
										)}

										{/* Completion check (review flow) */}
										{step === "completion-check" && (
											<>
												<div className="flex flex-col items-center gap-3 py-2">
													<div className="w-12 h-12 rounded-full bg-neon-amber/[0.08] border border-neon-amber/20 flex items-center justify-center">
														<AlertTriangle className="w-5 h-5 text-neon-amber/70" />
													</div>
													<div className="text-center">
														<div className="font-display text-sm text-cream/80 tracking-wide mb-1">
															Not all episodes watched
														</div>
														<div className="font-mono-retro text-[10px] text-cream/30 tracking-wide leading-relaxed max-w-[280px]">
															{(() => {
																const { missing } = checkCompletion(
																	scope!,
																	selectedSeason ?? undefined,
																	selectedEpisode ?? undefined,
																);
																return `${missing.length} episode${missing.length > 1 ? "s" : ""} in ${scopeLabel(scope!, selectedSeason ?? undefined, selectedEpisode ?? undefined, entryType)} haven't been marked as watched yet.`;
															})()}
														</div>
													</div>
												</div>

												<div className="flex flex-col gap-2">
													<button
														type="button"
														onClick={handleMarkAsComplete}
														disabled={markEpisodes.isPending}
														className="w-full py-2.5 px-4 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-sm tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-40"
													>
														{markEpisodes.isPending
															? "Marking..."
															: "Mark as Complete"}
													</button>
													<button
														type="button"
														onClick={handleContinueAnyway}
														disabled={markEpisodes.isPending}
														className="w-full py-2.5 px-4 border border-cream/[0.08] rounded-lg font-mono-retro text-[11px] tracking-wider uppercase text-cream/40 text-center cursor-pointer hover:border-cream/15 hover:text-cream/60 transition-all duration-200"
													>
														Continue Anyway
													</button>
												</div>
											</>
										)}
									</div>
								</div>
							</div>
						</div>
					</DialogPrimitive.Content>
				</DialogPortal>
			</Dialog>

			{/* Review modal opened after scope selection */}
			<ReviewModal
				open={reviewOpen}
				onOpenChange={setReviewOpen}
				titleName={reviewTitleName}
				year={year || undefined}
				tmdbId={tmdbId}
				mediaType="tv"
				scope={scope ?? undefined}
				scopeSeasonNumber={selectedSeason ?? undefined}
				scopeEpisodeNumber={selectedEpisode ?? undefined}
				onEventCreated={() => {
					setReviewOpen(false);
				}}
			/>
		</>
	);
}

function ScopeOption({
	label,
	sublabel,
	onClick,
}: {
	label: string;
	sublabel: string;
	onClick: () => void;
	accentColor: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-md border border-cream/[0.06] bg-black/20 cursor-pointer transition-all duration-200 hover:border-neon-cyan/20 hover:bg-neon-cyan/[0.03] group"
		>
			<div>
				<div className="text-sm text-cream/70 text-left group-hover:text-cream/90 transition-colors">
					{label}
				</div>
				<div className="font-mono-retro text-[9px] text-cream/25 tracking-wide mt-0.5">
					{sublabel}
				</div>
			</div>
			<ChevronRight className="w-4 h-4 text-cream/15 group-hover:text-cream/40 transition-colors shrink-0" />
		</button>
	);
}
