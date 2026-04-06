import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";

interface Season {
	seasonNumber: number;
	episodeCount: number;
	name: string;
}

interface SeasonPickerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	seasons: Season[];
	/** Pre-selected season numbers (for editing) */
	initialSelected?: number[];
	onConfirm: (selectedSeasons: number[]) => void;
	isPending?: boolean;
}

export function SeasonPickerModal({
	open,
	onOpenChange,
	titleName,
	seasons,
	initialSelected,
	onConfirm,
	isPending,
}: SeasonPickerModalProps) {
	const [selected, setSelected] = useState<Set<number>>(
		() => new Set(initialSelected ?? []),
	);

	// Reset selection when modal opens
	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) {
			setSelected(new Set(initialSelected ?? []));
		}
		onOpenChange(nextOpen);
	}

	// Filter out season 0 (Specials) from the main list — most users don't watch specials
	const regularSeasons = seasons.filter((s) => s.seasonNumber > 0);
	const allSelected = regularSeasons.every((s) => selected.has(s.seasonNumber));

	function toggleAll() {
		if (allSelected) {
			setSelected(new Set());
		} else {
			setSelected(new Set(regularSeasons.map((s) => s.seasonNumber)));
		}
	}

	function toggleSeason(seasonNumber: number) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(seasonNumber)) {
				next.delete(seasonNumber);
			} else {
				next.add(seasonNumber);
			}
			return next;
		});
	}

	function handleConfirm() {
		if (selected.size === 0) return;
		onConfirm(Array.from(selected).sort((a, b) => a - b));
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-w-[360px] border-none bg-transparent p-0 gap-0 shadow-none"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only">Seasons Watched</DialogTitle>
				<div className="w-full max-w-[360px] flex flex-col items-center">
					{/* Marquee header */}
					<div className="w-[calc(100%-16px)] border-2 border-neon-cyan/30 border-b-0 rounded-t-lg bg-drive-in-card px-5 py-2.5 text-center shadow-[0_0_20px_rgba(0,229,255,0.08)] relative">
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							className="absolute top-2.5 right-3 p-1 text-cream/25 hover:text-cream/60 transition-colors duration-200"
						>
							<X className="w-4 h-4" />
						</button>
						<div className="flex justify-center gap-3 mb-1.5">
							{Array.from({ length: 8 }).map((_, i) => (
								<div
									key={`dot-${i.toString()}`}
									className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_4px_1px_rgba(0,229,255,0.6)] animate-[chase_1.2s_infinite]"
									style={{ animationDelay: `${i * 0.15}s` }}
								/>
							))}
						</div>
						<div className="font-display text-2xl text-cream tracking-wide">
							Seasons Watched
						</div>
						<div className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-cyan/55 mt-0.5 truncate">
							{titleName}
						</div>
					</div>

					{/* Modal card */}
					<div className="w-full bg-gradient-to-b from-[#0c0c20] to-[#08081a] border border-cream/[0.06] rounded-b-lg shadow-[0_4px_24px_rgba(0,0,0,0.4)] overflow-hidden relative">
						<div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent shadow-[0_0_10px_rgba(0,229,255,0.4)]" />

						<div className="p-5 flex flex-col gap-4 relative">
							{/* Select All */}
							<label
								htmlFor="season-select-all"
								className="flex items-center gap-3 px-3 py-2 rounded-md bg-neon-cyan/[0.04] border border-neon-cyan/15 cursor-pointer hover:border-neon-cyan/30 transition-colors duration-200"
							>
								<Checkbox
									id="season-select-all"
									checked={allSelected}
									onCheckedChange={toggleAll}
									className="border-neon-cyan/40 data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
								/>
								<span className="font-mono-retro text-xs tracking-[2px] uppercase text-neon-cyan/70">
									Select All
								</span>
							</label>

							{/* Season list */}
							<div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto scrollbar-amber pr-1">
								{regularSeasons.map((season) => (
									<label
										key={season.seasonNumber}
										htmlFor={`season-${season.seasonNumber}`}
										className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-cream/[0.03] cursor-pointer transition-colors duration-200"
									>
										<Checkbox
											id={`season-${season.seasonNumber}`}
											checked={selected.has(season.seasonNumber)}
											onCheckedChange={() => toggleSeason(season.seasonNumber)}
											className="border-cream/20 data-[state=checked]:bg-neon-cyan data-[state=checked]:border-neon-cyan"
										/>
										<div className="flex-1 min-w-0">
											<span className="text-sm text-cream/80">
												{season.name}
											</span>
											<span className="text-xs text-cream/30 ml-2">
												{season.episodeCount} episodes
											</span>
										</div>
									</label>
								))}
							</div>

							{/* Confirm button */}
							<button
								type="button"
								onClick={handleConfirm}
								disabled={selected.size === 0 || isPending}
								className="w-full py-3 px-6 bg-neon-cyan/[0.08] border-2 border-neon-cyan/35 rounded-lg font-display text-base tracking-widest text-neon-cyan text-center shadow-[0_4px_0_rgba(0,229,255,0.15),0_0_16px_rgba(0,229,255,0.1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[0_2px_0_rgba(0,229,255,0.15),0_0_24px_rgba(0,229,255,0.15)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isPending ? (
									<Loader2 className="h-4 w-4 animate-spin mx-auto" />
								) : (
									"Confirm"
								)}
							</button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
