import { Loader2 } from "lucide-react";
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
				<div className="flex min-w-0 flex-1 items-center gap-1">
					{entries.map(([key, item], i) => {
						const posterUrl = getTmdbImageUrl(item.posterPath, "w92");
						const overlap = i >= 5;
						return (
							<button
								key={key}
								type="button"
								onClick={() => onDeselect(key)}
								className={`group relative shrink-0 ${overlap ? "-ml-3" : ""}`}
								title={`Remove ${item.title}`}
							>
								<div className="h-12 w-8 overflow-hidden rounded border-[1.5px] border-[#FF2D78] transition-opacity group-hover:opacity-60">
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
							</button>
						);
					})}
				</div>

				<span className="shrink-0 text-sm text-cream/50">
					<span className="font-bold text-[#FF2D78]">
						{selectedTitles.size}
					</span>{" "}
					/ {MIN_TITLES}-{MAX_TITLES}
				</span>

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
