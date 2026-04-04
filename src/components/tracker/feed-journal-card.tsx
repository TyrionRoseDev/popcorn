import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

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
			className="relative rounded-[10px] border border-neon-amber/20 p-4 transition-colors hover:border-neon-amber/30"
			style={{
				background:
					"linear-gradient(145deg, rgba(10,10,30,0.95) 0%, rgba(15,15,35,0.8) 100%)",
				boxShadow:
					"0 0 12px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,255,240,0.03)",
			}}
		>
			{/* Warm radial light overlay */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-[10px]"
				style={{
					background:
						"radial-gradient(ellipse at top left, rgba(255,184,0,0.06), transparent 50%)",
				}}
			/>

			{/* Header row */}
			<div className="relative z-10 flex items-center gap-2 mb-2">
				<Link
					to="/app/profile/$userId"
					params={{ userId: actor.id }}
					className="flex items-center gap-2 no-underline"
				>
					<div className="w-7 h-7 rounded-full bg-cream/10 flex items-center justify-center text-xs font-medium text-cream/60 shrink-0">
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
					<span className="text-xs font-semibold text-cream/80">
						{actor.username ?? "Someone"}
					</span>
				</Link>
				<span className="text-xs text-cream/30">wrote about</span>
				<Link
					to="/app/title/$mediaType/$tmdbId"
					params={{ mediaType: "tv", tmdbId: entry.tmdbId }}
					className="text-xs font-semibold text-cream/70 hover:text-cream no-underline transition-colors truncate"
				>
					{entry.titleName}
				</Link>
				{badge && (
					<span className="text-xs text-cream/30 shrink-0">· {badge}</span>
				)}
				<span className="text-[10px] text-cream/25 ml-auto shrink-0">
					{formatTimeAgo(entry.createdAt)}
				</span>
			</div>

			{/* Note body */}
			<div className="relative z-10 ml-9">
				<div
					className="h-px mb-2"
					style={{
						background:
							"linear-gradient(90deg, rgba(255,184,0,0.2), transparent 80%)",
					}}
				/>
				<div className="flex items-start gap-2">
					<BookOpen className="h-3 w-3 text-neon-cyan/30 mt-0.5 shrink-0" />
					<p className="relative text-[12.5px] leading-[1.6] text-cream/55 pl-3 line-clamp-3 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:rounded-full before:bg-[rgba(0,229,255,0.2)]">
						{entry.note}
					</p>
				</div>
			</div>
		</div>
	);
}
