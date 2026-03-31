interface WatchlistFiltersProps {
	sort: string;
	type: string;
	onSortChange: (sort: string) => void;
	onTypeChange: (type: string) => void;
}

const SORT_OPTIONS = [
	{ value: "date-added", label: "Date Added" },
	{ value: "title", label: "Title" },
	{ value: "year", label: "Year" },
	{ value: "rating", label: "Rating" },
	{ value: "recommender", label: "Recommender" },
];

const TYPE_OPTIONS = [
	{ value: "all", label: "All" },
	{ value: "movie", label: "Movies" },
	{ value: "tv", label: "TV Shows" },
];

export function WatchlistFilters({
	sort,
	type,
	onSortChange,
	onTypeChange,
}: WatchlistFiltersProps) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			{/* Sort pills */}
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="mr-1 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
					Sort
				</span>
				{SORT_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						type="button"
						onClick={() => onSortChange(opt.value)}
						className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
							sort === opt.value
								? "bg-neon-pink/12 text-neon-pink border border-neon-pink/25"
								: "text-cream/50 hover:text-cream/80 hover:bg-cream/4 border border-transparent"
						}`}
					>
						{opt.label}
					</button>
				))}
			</div>

			{/* Type filter pills */}
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="mr-1 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
					Type
				</span>
				{TYPE_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						type="button"
						onClick={() => onTypeChange(opt.value)}
						className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
							type === opt.value
								? "bg-neon-pink/12 text-neon-pink border border-neon-pink/25"
								: "text-cream/50 hover:text-cream/80 hover:bg-cream/4 border border-transparent"
						}`}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}
