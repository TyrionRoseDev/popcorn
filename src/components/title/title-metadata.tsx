interface TitleMetadataProps {
	director: string | null;
	tagline: string | null;
	rating: number;
	seasons?: number;
	episodes?: number;
	status?: string;
}

export function TitleMetadata({
	director,
	tagline,
	rating,
	seasons,
	episodes,
	status,
}: TitleMetadataProps) {
	return (
		<div>
			<div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
				Details
			</div>
			{tagline && (
				<p className="italic text-cream/50 text-[15px] border-l-2 border-neon-pink pl-3.5 mb-3.5 [text-shadow:0_0_12px_rgba(255,45,120,0.1)]">
					&ldquo;{tagline}&rdquo;
				</p>
			)}
			<div className="flex flex-col gap-2.5">
				{director && (
					<div className="flex gap-2 text-sm">
						<span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
							Director
						</span>
						<span className="text-cream/80">{director}</span>
					</div>
				)}
				<div className="flex gap-2 text-sm">
					<span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
						Rating
					</span>
					<span className="text-cream/80">
						<span className="text-neon-amber [text-shadow:0_0_6px_rgba(255,184,0,0.4)]">
							★
						</span>{" "}
						{rating.toFixed(1)} / 10
					</span>
				</div>
				{seasons != null && (
					<div className="flex gap-2 text-sm">
						<span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
							Seasons
						</span>
						<span className="text-cream/80">{seasons}</span>
					</div>
				)}
				{episodes != null && (
					<div className="flex gap-2 text-sm">
						<span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
							Episodes
						</span>
						<span className="text-cream/80">{episodes}</span>
					</div>
				)}
				{status && (
					<div className="flex gap-2 text-sm">
						<span className="text-cream/40 min-w-[80px] font-mono-retro text-xs">
							Status
						</span>
						<span className="text-cream/80">{status}</span>
					</div>
				)}
			</div>
		</div>
	);
}
