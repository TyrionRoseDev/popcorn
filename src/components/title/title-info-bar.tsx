interface TitleInfoBarProps {
	contentRating: string;
	genres: string[];
}

const genreColorClasses = [
	"text-neon-pink border-neon-pink/40 [text-shadow:0_0_8px_rgba(255,45,120,0.5)] [box-shadow:0_0_10px_rgba(255,45,120,0.1),inset_0_0_10px_rgba(255,45,120,0.05)]",
	"text-neon-cyan border-neon-cyan/40 [text-shadow:0_0_8px_rgba(0,229,255,0.5)] [box-shadow:0_0_10px_rgba(0,229,255,0.1),inset_0_0_10px_rgba(0,229,255,0.05)]",
	"text-neon-amber border-neon-amber/40 [text-shadow:0_0_8px_rgba(255,184,0,0.5)] [box-shadow:0_0_10px_rgba(255,184,0,0.1),inset_0_0_10px_rgba(255,184,0,0.05)]",
];

export function TitleInfoBar({ contentRating, genres }: TitleInfoBarProps) {
	return (
		<div className="flex flex-wrap items-center gap-2.5">
			{contentRating && contentRating !== "NR" && (
				<span className="px-2 py-0.5 border border-neon-amber/40 rounded text-[11px] font-mono-retro font-semibold text-neon-amber [text-shadow:0_0_6px_rgba(255,184,0,0.3)]">
					{contentRating}
				</span>
			)}
			{genres.map((genre, index) => (
				<span
					key={genre}
					className={`px-3.5 py-[5px] border rounded-sm font-mono-retro text-[11px] tracking-wider ${genreColorClasses[index % 3]}`}
				>
					{genre}
				</span>
			))}
		</div>
	);
}
