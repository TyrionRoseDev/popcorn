import { cn } from "#/lib/utils";

const genreColorClasses = [
	"text-neon-pink border-neon-pink/40 [text-shadow:0_0_8px_rgba(255,45,120,0.5)] [box-shadow:0_0_10px_rgba(255,45,120,0.1),inset_0_0_10px_rgba(255,45,120,0.05)]",
	"text-neon-cyan border-neon-cyan/40 [text-shadow:0_0_8px_rgba(0,229,255,0.5)] [box-shadow:0_0_10px_rgba(0,229,255,0.1),inset_0_0_10px_rgba(0,229,255,0.05)]",
	"text-neon-amber border-neon-amber/40 [text-shadow:0_0_8px_rgba(255,184,0,0.5)] [box-shadow:0_0_10px_rgba(255,184,0,0.1),inset_0_0_10px_rgba(255,184,0,0.05)]",
];

interface TitleMetadataProps {
	director: string | null;
	rating: number;
	contentRating: string;
	runtime: string;
	genres: string[];
	seasons?: number;
	episodes?: number;
	className?: string;
}

export function TitleMetadata({
	director,
	rating,
	contentRating,
	runtime,
	genres,
	seasons,
	episodes,
	className,
}: TitleMetadataProps) {
	const isTV = seasons != null || episodes != null;
	const filledStars = Math.round(rating / 2);

	const metadataItems = isTV
		? [
				{ label: "Creator", value: director },
				{ label: "Seasons", value: seasons != null ? String(seasons) : null },
				{
					label: "Episodes",
					value: episodes != null ? String(episodes) : null,
				},
			]
		: [
				{ label: "Director", value: director },
				{
					label: "Content Rating",
					value: contentRating && contentRating !== "NR" ? contentRating : null,
				},
				{ label: "Runtime", value: runtime },
			];

	const visibleItems = metadataItems.filter((item) => item.value != null);

	return (
		<div
			className={cn(
				"relative rounded-lg overflow-hidden border border-[rgba(255,255,240,0.06)] [background:linear-gradient(135deg,#0c0c20,#08081a)] [box-shadow:0_4px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,240,0.03)]",
				className,
			)}
		>
			{/* Top edge glow */}
			<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,240,0.15)] to-transparent" />
			{/* Top inner wash */}
			<div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[rgba(255,255,240,0.02)] to-transparent pointer-events-none" />

			<div className="flex">
				{/* Main body */}
				<div className="flex-1 p-8">
					{/* Header */}
					<div className="mb-6 pb-4 border-b border-cream/6">
						<span
							className="font-display text-base tracking-[3px] uppercase text-cream/90"
							style={{
								textShadow:
									"0 0 20px rgba(255, 255, 240, 0.12), 0 0 40px rgba(255, 184, 0, 0.04)",
							}}
						>
							Details
						</span>
					</div>

					{/* Metadata grid */}
					<div className="grid grid-cols-2 gap-6">
						{visibleItems.map((item) => (
							<div key={item.label}>
								<div className="font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/30 mb-1.5">
									{item.label}
								</div>
								<div className="text-[15px] text-cream">{item.value}</div>
							</div>
						))}
					</div>

					{/* Genre pills */}
					{genres.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-cream/4">
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
					)}
				</div>

				{/* Perforation column */}
				<div className="w-8 flex flex-col items-center justify-around border-l border-dashed border-[rgba(255,255,240,0.08)] py-4">
					{["p1", "p2", "p3", "p4", "p5"].map((id) => (
						<div
							key={id}
							className="w-[10px] h-[10px] rounded-full bg-drive-in-bg [box-shadow:inset_0_1px_3px_rgba(0,0,0,0.5)]"
						/>
					))}
				</div>

				{/* Rating tear-off */}
				<div className="w-[110px] flex flex-col items-center justify-center gap-1 [background:rgba(255,184,0,0.03)] py-8 px-4">
					<div className="font-logo text-4xl text-neon-amber [text-shadow:0_0_20px_rgba(255,184,0,0.4)]">
						{rating.toFixed(1)}
					</div>
					<div className="font-mono-retro text-[9px] text-cream/35 uppercase tracking-[2px] mt-2">
						TMDB
					</div>
					<div className="flex gap-0.5 mt-1">
						{[0, 1, 2, 3, 4].map((i) => (
							<span
								key={`star-${i}`}
								className={
									i < filledStars
										? "text-neon-amber text-[11px]"
										: "text-neon-amber/20 text-[11px]"
								}
							>
								★
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
