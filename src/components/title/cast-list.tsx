import { getTmdbImageUrl } from "#/lib/tmdb";

interface CastMember {
	id: number;
	name: string;
	character: string;
	profilePath: string | null;
}

interface CastListProps {
	cast: CastMember[];
}

function FilmStripRow() {
	return (
		<div className="h-[14px] flex items-center bg-[rgba(0,0,0,0.35)] px-2 overflow-hidden justify-between">
			{Array.from({ length: 20 }).map((_, i) => (
				<div
					key={i}
					className="w-3 h-2 rounded-sm bg-[rgba(255,255,240,0.05)] border border-[rgba(255,255,240,0.04)]"
				/>
			))}
		</div>
	);
}

export function CastList({ cast }: CastListProps) {
	if (cast.length === 0) return null;

	return (
		<div>
			<FilmStripRow />
			<div className="relative">
				<div className="flex gap-7 overflow-x-auto py-5 px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
					{cast.map((member) => {
						const photoUrl = getTmdbImageUrl(member.profilePath, "w185");
						return (
							<div
								key={member.id}
								className="flex flex-col items-center gap-2 min-w-[90px] group"
							>
								{photoUrl ? (
									<img
										src={photoUrl}
										alt={member.name}
										className="w-[76px] h-[76px] rounded-full object-cover border-2 border-neon-cyan/20 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-cyan/50 group-hover:shadow-[0_0_25px_rgba(0,229,255,0.2)] transition-all"
										loading="lazy"
									/>
								) : (
									<div className="w-[76px] h-[76px] rounded-full bg-gradient-to-br from-[#2a1a4e] to-[#1a3a5e] border-2 border-neon-cyan/20 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-cyan/50 group-hover:shadow-[0_0_25px_rgba(0,229,255,0.2)] transition-all" />
								)}
								<span className="text-[13px] text-cream font-semibold text-center">
									{member.name}
								</span>
								<span className="text-[10px] text-cream/40 text-center mt-0.5">
									{member.character}
								</span>
							</div>
						);
					})}
				</div>
				<div className="absolute top-0 right-0 bottom-0 w-[70px] bg-gradient-to-r from-transparent to-[#0a0a1c] pointer-events-none" />
			</div>
			<FilmStripRow />
		</div>
	);
}
