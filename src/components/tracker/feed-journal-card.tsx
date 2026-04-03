import { Link } from "@tanstack/react-router";

interface FeedJournalCardProps {
	entry: {
		id: string;
		userId: string;
		tmdbId: number;
		titleName: string;
		scope: string;
		seasonNumber: number | null;
		episodeNumber: number | null;
		note: string;
		isPublic: boolean;
		createdAt: Date;
		user: {
			id: string;
			username: string | null;
			avatarUrl: string | null;
		};
	};
}

function formatTimeAgo(date: Date | string): string {
	const now = new Date();
	const d = new Date(date);
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	if (diffDay < 30) return `${diffDay}d ago`;
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function scopeBadge(
	scope: string,
	seasonNumber: number | null,
	episodeNumber: number | null,
): string | null {
	if (scope === "episode" && seasonNumber != null && episodeNumber != null) {
		return `S${seasonNumber}E${episodeNumber}`;
	}
	if (scope === "season" && seasonNumber != null) {
		return `Season ${seasonNumber}`;
	}
	return null;
}

export function FeedJournalCard({ entry }: FeedJournalCardProps) {
	const actor = entry.user;
	const badge = scopeBadge(
		entry.scope,
		entry.seasonNumber,
		entry.episodeNumber,
	);

	return (
		<div
			className="relative rounded-[10px] border border-neon-cyan/15 p-4 transition-all hover:border-neon-cyan/25 hover:-translate-y-px"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow: "0 0 12px rgba(0,229,255,0.04), 0 4px 16px rgba(0,0,0,0.3)",
			}}
		>
			{/* Header row */}
			<div className="flex items-center gap-2 mb-2.5">
				<Link
					to="/app/profile/$userId"
					params={{ userId: actor.id }}
					className="flex items-center gap-2 no-underline"
				>
					<div className="w-7 h-7 rounded-full bg-neon-cyan/15 border border-neon-cyan/20 flex items-center justify-center text-[11px] font-medium text-neon-cyan shrink-0">
						{actor.avatarUrl ? (
							<img
								src={actor.avatarUrl}
								alt=""
								className="w-7 h-7 rounded-full object-cover"
							/>
						) : (
							(actor.username?.charAt(0) ?? "?").toUpperCase()
						)}
					</div>
					<span className="text-[13px] font-semibold text-cream/75">
						{actor.username ?? "Someone"}
					</span>
				</Link>
				<span className="text-xs text-cream/30">wrote about</span>
				<span className="text-[10px] text-cream/20 ml-auto font-mono-retro">
					{formatTimeAgo(entry.createdAt)}
				</span>
			</div>

			{/* Main row: title + scope on left */}
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<Link
						to="/app/title/$mediaType/$tmdbId"
						params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
						className="text-[15px] font-bold text-neon-cyan no-underline hover:text-neon-cyan/90"
						style={{ textShadow: "0 0 8px rgba(0,229,255,0.15)" }}
					>
						{entry.titleName}
					</Link>
					{badge && (
						<span className="ml-2 text-[11px] font-mono-retro text-cream/35">
							{badge}
						</span>
					)}
				</div>
			</div>

			{/* Note row */}
			<div
				className="mt-2.5 py-1.5 px-3 rounded-r-md"
				style={{
					background: "rgba(0,229,255,0.03)",
					borderLeft: "2px solid rgba(0,229,255,0.25)",
				}}
			>
				<p className="text-[12px] text-cream/50 italic line-clamp-3">
					{entry.note}
				</p>
			</div>
		</div>
	);
}
