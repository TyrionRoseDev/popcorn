interface TitleInfoBarProps {
	contentRating: string;
	genres: string[];
}

export function TitleInfoBar({ contentRating, genres }: TitleInfoBarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2.5">
			{contentRating && contentRating !== "NR" && (
				<span className="px-2 py-0.5 border border-neon-amber/40 rounded text-[11px] font-mono-retro font-semibold text-neon-amber [text-shadow:0_0_6px_rgba(255,184,0,0.3)]">
					{contentRating}
				</span>
			)}
			{genres.map((genre) => (
				<span
					key={genre}
					className="px-3.5 py-1 border border-neon-pink/25 rounded-full font-mono-retro text-[11px] text-cream/80 tracking-wider hover:border-neon-pink/60 hover:shadow-[0_0_10px_rgba(255,45,120,0.2)] transition-all"
				>
					{genre}
				</span>
			))}
		</div>
	);
}
