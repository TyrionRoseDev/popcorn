interface WatchlistReelHeaderProps {
	name: string;
	itemCount: number;
	isDefault: boolean;
	members: Array<{
		user: { id: string; username: string | null; avatarUrl: string | null };
	}>;
}

export function WatchlistReelHeader({
	name,
	itemCount,
	isDefault,
	members,
}: WatchlistReelHeaderProps) {
	const isShared = members.length > 1;

	return (
		<div className="flex items-center justify-between px-8 pb-2">
			{/* Left side */}
			<div className="flex items-center gap-2">
				<span className="font-sans text-sm font-bold text-cream">{name}</span>
				<span className="text-xs text-cream/30">
					{itemCount} {itemCount === 1 ? "title" : "titles"}
				</span>
				{isDefault && (
					<span className="rounded bg-neon-pink/10 px-2 py-0.5 text-[10px] font-medium text-neon-pink/70">
						Default
					</span>
				)}
				{isShared && (
					<span className="rounded bg-neon-cyan/10 px-2 py-0.5 text-[10px] font-medium text-neon-cyan/70">
						Shared
					</span>
				)}
			</div>

			{/* Right side */}
			<div className="flex items-center gap-2">
				{/* Stacked member avatars */}
				{isShared && (
					<div className="flex items-center">
						{members.map((member, i) => (
							<div
								key={member.user.id}
								className="flex items-center justify-center rounded-full border-2 border-drive-in-bg bg-cream/10 text-[10px] font-bold uppercase text-cream/60"
								style={{
									width: 24,
									height: 24,
									marginLeft: i > 0 ? -6 : 0,
									zIndex: members.length - i,
								}}
								title={member.user.username ?? "User"}
							>
								{(member.user.username ?? "?")[0]}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
