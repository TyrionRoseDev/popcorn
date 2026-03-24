import { useState } from "react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface HeroTrailerProps {
	backdropPath: string | null;
	trailerKey: string | null;
}

export function HeroTrailer({ backdropPath, trailerKey }: HeroTrailerProps) {
	const [playing, setPlaying] = useState(false);
	const backdropUrl = getTmdbImageUrl(backdropPath, "w1280");

	return (
		<div className="relative w-full h-[280px] md:h-[480px] overflow-hidden bg-drive-in-bg">
			{playing && trailerKey ? (
				<iframe
					src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
					title="Trailer"
					allow="autoplay; encrypted-media"
					allowFullScreen
					className="absolute inset-0 w-full h-full z-10"
				/>
			) : (
				<>
					<div
						className="absolute inset-0 bg-cover bg-center"
						style={
							backdropUrl
								? { backgroundImage: `url(${backdropUrl})` }
								: {
										background:
											"radial-gradient(ellipse at 30% 40%, #1a1040 0%, #0d0d1a 50%, #050510 100%)",
									}
						}
					/>
					<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(5,5,8,0.7)_100%)] pointer-events-none" />
					<div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-drive-in-bg to-transparent" />
					{trailerKey && (
						<button
							type="button"
							aria-label="Play trailer"
							onClick={() => setPlaying(true)}
							className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5 z-20 group cursor-pointer"
						>
							<div className="w-[56px] h-[56px] md:w-[72px] md:h-[72px] rounded-full bg-neon-pink flex items-center justify-center shadow-[0_0_40px_rgba(255,45,120,0.5),0_0_80px_rgba(255,45,120,0.2)] group-hover:scale-110 group-hover:shadow-[0_0_50px_rgba(255,45,120,0.6),0_0_100px_rgba(255,45,120,0.3)] transition-all duration-200">
								<div className="w-0 h-0 border-l-[18px] md:border-l-[24px] border-l-white border-t-[10px] md:border-t-[14px] border-t-transparent border-b-[10px] md:border-b-[14px] border-b-transparent ml-1" />
							</div>
							<span className="text-cream/70 text-[11px] tracking-[3px] uppercase font-mono-retro">
								Play Trailer
							</span>
						</button>
					)}
				</>
			)}
			<div className="absolute top-0 left-0 right-0 h-[18px] bg-[#111] flex items-center justify-center gap-3 z-30 border-b border-neon-pink/15">
				{Array.from({ length: 60 }, (_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static decorative elements
						key={i}
						className="w-2.5 h-[7px] rounded-[1px] bg-drive-in-bg shadow-[inset_0_0_2px_rgba(0,0,0,0.8)]"
					/>
				))}
			</div>
			<div className="absolute bottom-0 left-0 right-0 h-[18px] bg-[#111] flex items-center justify-center gap-3 z-30 border-t border-neon-pink/15">
				{Array.from({ length: 60 }, (_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static decorative elements
						key={i}
						className="w-2.5 h-[7px] rounded-[1px] bg-drive-in-bg shadow-[inset_0_0_2px_rgba(0,0,0,0.8)]"
					/>
				))}
			</div>
		</div>
	);
}
