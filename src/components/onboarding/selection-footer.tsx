import { Loader2, X } from "lucide-react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getTmdbImageUrl } from "#/lib/tmdb";

const MIN_TITLES = 3;
const MAX_TITLES = 10;

interface SelectionFooterProps {
	selectedTitles: Map<string, FeedItem>;
	onDeselect: (key: string) => void;
	onContinue: () => void;
	isSaving: boolean;
}

export function SelectionFooter({
	selectedTitles,
	onDeselect,
	onContinue,
	isSaving,
}: SelectionFooterProps) {
	if (selectedTitles.size === 0) return null;

	const entries = Array.from(selectedTitles.entries());
	const canContinue = selectedTitles.size >= MIN_TITLES;

	return (
		<div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#FF2D78]/20 bg-[#0a0a0a]/95 shadow-[0_-4px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl">
			<div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
				{/* Poster thumbnails with × */}
				<div className="flex flex-1 gap-1.5 overflow-x-auto">
					{entries.map(([key, item]) => {
						const posterUrl = getTmdbImageUrl(
							item.posterPath,
							"w92",
						);
						return (
							<div
								key={key}
								className="group relative shrink-0"
								title={item.title}
							>
								<div className="h-11 w-[30px] overflow-hidden rounded">
									{posterUrl ? (
										<img
											src={posterUrl}
											alt={item.title}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full bg-cream/10" />
									)}
								</div>
								<button
									type="button"
									onClick={() => onDeselect(key)}
									className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0a0a0a] border border-cream/20 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-cream/10"
								>
									<X className="h-2.5 w-2.5 text-cream/70" />
								</button>
							</div>
						);
					})}
				</div>

				{/* Count */}
				<span className="shrink-0 text-sm text-cream/50">
					<span className="font-bold text-[#FF2D78]">
						{selectedTitles.size}
					</span>
					/{MAX_TITLES}
				</span>

				{/* Continue */}
				<button
					type="button"
					onClick={onContinue}
					disabled={!canContinue || isSaving}
					className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-all ${
						canContinue
							? "bg-[#FF2D78] text-white shadow-[0_0_12px_rgba(255,45,120,0.4)] hover:shadow-[0_0_20px_rgba(255,45,120,0.5)]"
							: "bg-cream/10 text-cream/30 cursor-not-allowed"
					}`}
				>
					{isSaving ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						"Continue \u2192"
					)}
				</button>
			</div>
		</div>
	);
}
