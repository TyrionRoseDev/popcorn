import { useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "#/components/ui/sheet";
import { UNIFIED_GENRES } from "#/lib/genre-map";

interface FilterProps {
	type: "all" | "movie" | "tv";
	genre?: number;
	yearMin?: number;
	yearMax?: number;
}

const TYPE_OPTIONS = [
	{ value: "all" as const, label: "All" },
	{ value: "movie" as const, label: "Movies" },
	{ value: "tv" as const, label: "TV Shows" },
];

function getActiveCount(props: FilterProps) {
	return [
		props.type !== "all",
		props.genre !== undefined,
		props.yearMin !== undefined || props.yearMax !== undefined,
	].filter(Boolean).length;
}

function FilterControls({ type, genre, yearMin, yearMax }: FilterProps) {
	const navigate = useNavigate();
	const [localYearMin, setLocalYearMin] = useState(yearMin?.toString() ?? "");
	const [localYearMax, setLocalYearMax] = useState(yearMax?.toString() ?? "");

	function updateFilter(updates: Record<string, unknown>) {
		navigate({
			to: "/app/search",
			search: (prev) => ({
				q: prev.q ?? "",
				type: prev.type ?? "all",
				sort: prev.sort ?? "relevance",
				page: 1,
				genre: prev.genre,
				yearMin: prev.yearMin,
				yearMax: prev.yearMax,
				rating: prev.rating,
				...updates,
			}),
		});
	}

	function clearFilters() {
		navigate({
			to: "/app/search",
			search: (prev) => ({
				q: prev.q ?? "",
				type: "all" as const,
				sort: prev.sort ?? "relevance",
				page: 1,
			}),
		});
		setLocalYearMin("");
		setLocalYearMax("");
	}

	function commitYearMin() {
		const val = localYearMin ? Number(localYearMin) : undefined;
		updateFilter({ yearMin: val });
	}

	function commitYearMax() {
		const val = localYearMax ? Number(localYearMax) : undefined;
		updateFilter({ yearMax: val });
	}

	return (
		<div className="space-y-6">
			{/* Type */}
			<div role="radiogroup" aria-label="Media type filter">
				<div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
					Type
				</div>
				<div className="flex flex-col gap-1">
					{TYPE_OPTIONS.map((opt) => (
						// biome-ignore lint/a11y/useSemanticElements: styled pill buttons intentionally use role="radio"
						<button
							key={opt.value}
							type="button"
							role="radio"
							aria-checked={type === opt.value}
							onClick={() => updateFilter({ type: opt.value })}
							className={`rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
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

			{/* Genre */}
			<div role="radiogroup" aria-label="Genre filter">
				<div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
					Genre
				</div>
				<div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
					{UNIFIED_GENRES.map((g) => (
						// biome-ignore lint/a11y/useSemanticElements: styled pill buttons intentionally use role="radio"
						<button
							key={g.id}
							type="button"
							role="radio"
							aria-checked={genre === g.id}
							onClick={() =>
								updateFilter({ genre: genre === g.id ? undefined : g.id })
							}
							className={`rounded-md px-3 py-1.5 text-left text-xs transition-all ${
								genre === g.id
									? "text-neon-cyan bg-neon-cyan/8"
									: "text-cream/45 hover:text-cream/80 hover:bg-cream/4"
							}`}
						>
							{g.name}
						</button>
					))}
				</div>
			</div>

			{/* Year Range */}
			<div>
				<div className="mb-2.5 font-mono-retro text-[10px] uppercase tracking-[1.5px] text-neon-pink">
					Year
				</div>
				<div className="flex items-center gap-2">
					<input
						type="number"
						placeholder="From"
						value={localYearMin}
						onChange={(e) => setLocalYearMin(e.target.value)}
						onBlur={commitYearMin}
						onKeyDown={(e) => e.key === "Enter" && commitYearMin()}
						className="w-full rounded-lg border border-cream/10 bg-cream/6 px-3 py-1.5 text-xs text-cream placeholder:text-cream/30 outline-none focus:border-neon-cyan/40"
					/>
					<span className="text-cream/30 text-xs">–</span>
					<input
						type="number"
						placeholder="To"
						value={localYearMax}
						onChange={(e) => setLocalYearMax(e.target.value)}
						onBlur={commitYearMax}
						onKeyDown={(e) => e.key === "Enter" && commitYearMax()}
						className="w-full rounded-lg border border-cream/10 bg-cream/6 px-3 py-1.5 text-xs text-cream placeholder:text-cream/30 outline-none focus:border-neon-cyan/40"
					/>
				</div>
			</div>

			{/* Clear */}
			{getActiveCount({ type, genre, yearMin, yearMax }) > 0 && (
				<button
					type="button"
					onClick={clearFilters}
					className="text-xs text-cream/30 hover:text-neon-pink transition-colors"
				>
					Clear all filters
				</button>
			)}
		</div>
	);
}

export function FilterSidebarDesktop(props: FilterProps) {
	return (
		<div className="hidden md:block w-[220px] shrink-0">
			<FilterControls {...props} />
		</div>
	);
}

export function FilterSidebarMobile(props: FilterProps) {
	const [open, setOpen] = useState(false);
	const activeCount = getActiveCount(props);

	return (
		<div className="md:hidden mb-4">
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className="border-cream/12 bg-cream/6 text-cream/70 hover:text-cream"
					>
						<SlidersHorizontal className="h-4 w-4 mr-2" />
						Filters{activeCount > 0 ? ` (${activeCount})` : ""}
					</Button>
				</SheetTrigger>
				<SheetContent
					side="left"
					className="bg-drive-in-bg border-cream/10 w-[280px]"
				>
					<SheetHeader>
						<SheetTitle className="text-cream font-display">Filters</SheetTitle>
					</SheetHeader>
					<div className="mt-6">
						<FilterControls {...props} />
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
