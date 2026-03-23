import { cn } from "#/lib/utils";

interface TitleInfoBarProps {
	contentRating: string;
	genres: string[];
	className?: string;
}

const genreColorClasses = [
	"text-neon-pink border-neon-pink/40 [text-shadow:0_0_8px_rgba(255,45,120,0.5)] [box-shadow:0_0_10px_rgba(255,45,120,0.1),inset_0_0_10px_rgba(255,45,120,0.05)]",
	"text-neon-cyan border-neon-cyan/40 [text-shadow:0_0_8px_rgba(0,229,255,0.5)] [box-shadow:0_0_10px_rgba(0,229,255,0.1),inset_0_0_10px_rgba(0,229,255,0.05)]",
	"text-neon-amber border-neon-amber/40 [text-shadow:0_0_8px_rgba(255,184,0,0.5)] [box-shadow:0_0_10px_rgba(255,184,0,0.1),inset_0_0_10px_rgba(255,184,0,0.05)]",
];

export function TitleInfoBar({ contentRating, genres, className }: TitleInfoBarProps) {
	return (
		<div className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
			{contentRating && contentRating !== "NR" && (
				<span className="px-4 py-2 border border-neon-amber/40 rounded text-sm font-mono-retro font-bold text-neon-amber [text-shadow:0_0_8px_rgba(255,184,0,0.4)]">
					{contentRating}
				</span>
			)}
			{genres.map((genre, index) => (
				<span
					key={genre}
					className={cn(
						"px-4 py-2 border rounded-sm font-mono-retro text-sm font-bold tracking-wider",
						genreColorClasses[index % 3],
					)}
				>
					{genre}
				</span>
			))}
		</div>
	);
}
