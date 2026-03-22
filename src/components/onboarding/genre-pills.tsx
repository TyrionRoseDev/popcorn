import { useEffect, useState } from "react";
import type { UnifiedGenre } from "#/lib/genre-map";

const MAX_GENRES = 5;

const NEON_COLORS = [
	{ bg: "bg-[#FF2D78]", text: "text-white" },
	{ bg: "bg-[#00E5FF]", text: "text-[#0a0a0a]" },
	{ bg: "bg-[#FFB800]", text: "text-[#0a0a0a]" },
	{ bg: "bg-[#FF2D78]", text: "text-white" },
	{ bg: "bg-[#00E5FF]", text: "text-[#0a0a0a]" },
];

interface GenrePillsProps {
	genres: UnifiedGenre[];
	selected: Set<number>;
	onToggle: (genreId: number) => void;
	disabled?: boolean;
}

export function GenrePills({
	genres,
	selected,
	onToggle,
	disabled = false,
}: GenrePillsProps) {
	const selectedArray = Array.from(selected);
	const [visibleCount, setVisibleCount] = useState(0);

	useEffect(() => {
		// Stagger pills in after the card transition finishes (~700ms)
		const baseDelay = 700;
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let i = 0; i <= genres.length; i++) {
			timers.push(setTimeout(() => setVisibleCount(i), baseDelay + i * 40));
		}
		return () => timers.forEach(clearTimeout);
	}, [genres.length]);

	return (
		<div className="flex flex-wrap gap-2">
			{genres.map((genre, index) => {
				const isSelected = selected.has(genre.id);
				const selectedIndex = selectedArray.indexOf(genre.id);
				const atMax = selected.size >= MAX_GENRES;
				const isDisabled = disabled || (!isSelected && atMax);
				const color = isSelected
					? NEON_COLORS[selectedIndex % NEON_COLORS.length]
					: null;
				const isVisible = index < visibleCount;

				return (
					<button
						key={genre.id}
						type="button"
						onClick={() => onToggle(genre.id)}
						disabled={isDisabled || !isVisible}
						className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${
							isSelected
								? `${color?.bg} ${color?.text} shadow-lg`
								: isDisabled
									? "border border-cream/10 text-cream/20 cursor-not-allowed"
									: "border border-cream/25 text-cream/60 hover:border-cream/40 hover:text-cream/80"
						}`}
						style={{
							opacity: isVisible ? 1 : 0,
							transform: isVisible ? "translateY(0)" : "translateY(8px)",
						}}
					>
						{genre.name}
					</button>
				);
			})}
		</div>
	);
}
