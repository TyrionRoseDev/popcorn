interface TitleMetadataProps {
	director: string | null;
	rating: number;
	contentRating: string;
	runtime: string;
	seasons?: number;
	episodes?: number;
	status?: string;
	className?: string;
}

export function TitleMetadata({
	director,
	rating,
	contentRating,
	runtime,
	seasons,
	episodes,
	status,
	className,
}: TitleMetadataProps) {
	const isTV = seasons != null || episodes != null;
	const filledStars = Math.round(rating / 2);

	const metadataItems = isTV
		? [
				{ label: "Creator", value: director },
				{ label: "Seasons", value: seasons != null ? String(seasons) : null },
				{ label: "Episodes", value: episodes != null ? String(episodes) : null },
				{ label: "Status", value: status ?? null },
			]
		: [
				{ label: "Director", value: director },
				{
					label: "Content Rating",
					value: contentRating && contentRating !== "NR" ? contentRating : null,
				},
				{ label: "Runtime", value: runtime },
				{ label: "Status", value: status ?? null },
			];

	const visibleItems = metadataItems.filter((item) => item.value != null);

	return (
		<div className={`relative rounded-lg overflow-hidden border border-[rgba(255,255,240,0.06)] [background:linear-gradient(135deg,#0c0c20,#08081a)] [box-shadow:0_4px_24px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,240,0.03)]${className ? ` ${className}` : ""}`}>
			{/* Top edge glow */}
			<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,240,0.15)] to-transparent" />
			{/* Top inner wash */}
			<div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[rgba(255,255,240,0.02)] to-transparent pointer-events-none" />

			<div className="flex">
				{/* Main body */}
				<div className="flex-1 p-8">
					{/* Header */}
					<div className="flex items-center gap-2 mb-6">
						<span className="text-base">🎬</span>
						<span className="font-mono-retro text-[11px] uppercase tracking-[2px] text-cream/60">
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
				</div>

				{/* Perforation column */}
				<div className="w-8 flex flex-col items-center justify-around border-l border-dashed border-[rgba(255,255,240,0.08)] py-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<div
							key={i}
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
						{Array.from({ length: 5 }).map((_, i) => (
							<span
								key={i}
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
