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

export function CastList({ cast }: CastListProps) {
	if (cast.length === 0) return null;

	return (
		<div>
			<div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
				Cast
			</div>
			<div className="relative">
				<div className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
										className="w-[68px] h-[68px] rounded-full object-cover border-2 border-neon-pink/30 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-pink/70 group-hover:shadow-[0_0_12px_rgba(255,45,120,0.3)] transition-all"
										loading="lazy"
									/>
								) : (
									<div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-[#2a1a4e] to-[#1a3a5e] border-2 border-neon-pink/30 shadow-[0_2px_8px_rgba(0,0,0,0.3)] group-hover:border-neon-pink/70 group-hover:shadow-[0_0_12px_rgba(255,45,120,0.3)] transition-all" />
								)}
								<span className="text-[11px] text-cream font-semibold text-center">
									{member.name}
								</span>
								<span className="text-[10px] text-cream/40 text-center -mt-1">
									{member.character}
								</span>
							</div>
						);
					})}
				</div>
				<div className="absolute top-0 right-0 bottom-2 w-[60px] bg-gradient-to-r from-transparent to-drive-in-bg pointer-events-none" />
			</div>
		</div>
	);
}
