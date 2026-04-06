import { Check } from "lucide-react";
import type { AchievementDefinition } from "#/lib/achievements";

interface ComparisonData {
	myEarnedAt: Date | null;
	theirEarnedAt: Date | null;
	theirName: string;
}

interface AchievementBadgeProps {
	achievement: AchievementDefinition;
	earned: boolean;
	earnedAt?: Date | null;
	comparison?: ComparisonData;
}

function formatShortDate(date: Date): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "2-digit",
	});
}

function EarnedDot({
	earned,
	date,
	color,
}: {
	earned: boolean;
	date: Date | null;
	color: "amber" | "cyan";
}) {
	if (!earned) {
		return (
			<div className="flex items-center justify-center w-16">
				<div className="h-2 w-2 rounded-full bg-cream/10" />
			</div>
		);
	}

	const colorClass =
		color === "amber"
			? "bg-neon-amber text-neon-amber shadow-[0_0_8px_rgba(255,184,0,0.5)]"
			: "bg-neon-cyan text-neon-cyan shadow-[0_0_8px_rgba(0,229,255,0.5)]";

	const dateColor =
		color === "amber" ? "text-neon-amber/50" : "text-neon-cyan/50";

	return (
		<div className="flex flex-col items-center gap-0.5 w-16">
			<div
				className={`flex items-center justify-center h-5 w-5 rounded-full ${colorClass}`}
			>
				<Check className="h-3 w-3 text-drive-in-card" strokeWidth={3} />
			</div>
			{date && (
				<span
					className={`font-mono-retro text-[8px] tracking-[0.5px] ${dateColor}`}
				>
					{formatShortDate(date)}
				</span>
			)}
		</div>
	);
}

export function AchievementBadge({
	achievement,
	earned,
	earnedAt,
	comparison,
}: AchievementBadgeProps) {
	const iEarned = comparison ? comparison.myEarnedAt !== null : earned;
	const theyEarned = comparison?.theirEarnedAt != null;
	const isRevealed = comparison ? iEarned || theyEarned : iEarned;
	const bothEarned = comparison ? iEarned && theyEarned : false;

	// Row highlight based on status
	const rowBg = bothEarned
		? "bg-cream/[0.03]"
		: isRevealed
			? "bg-cream/[0.015]"
			: "";

	// Left border accent
	const borderColor = !isRevealed
		? "border-l-cream/5"
		: bothEarned
			? "border-l-neon-amber/60"
			: iEarned
				? "border-l-neon-amber/40"
				: "border-l-neon-cyan/40";

	return (
		<div
			className={`flex items-center gap-3 px-4 py-3 border-l-2 rounded-r-lg transition-colors ${rowBg} ${borderColor} ${!isRevealed ? "opacity-35" : ""}`}
		>
			{/* Left indicator: You */}
			{comparison ? (
				<EarnedDot
					earned={iEarned}
					date={comparison.myEarnedAt}
					color="amber"
				/>
			) : null}

			{/* Achievement info — center */}
			<div className="flex items-center gap-3 flex-1 min-w-0">
				<div
					className="text-2xl leading-none shrink-0"
					style={
						isRevealed
							? {
									textShadow:
										"0 0 8px rgba(255,184,0,0.4), 0 0 16px rgba(255,184,0,0.2)",
								}
							: { filter: "grayscale(1)" }
					}
				>
					{isRevealed ? achievement.icon : "🔒"}
				</div>
				<div className="flex flex-col gap-0.5 min-w-0">
					<p
						className={`font-display text-sm leading-snug ${isRevealed ? "text-cream/90" : "text-cream/30"}`}
					>
						{isRevealed ? achievement.name : "???"}
					</p>
					{isRevealed && (
						<p className="font-sans text-[11px] leading-snug text-cream/40 truncate">
							{achievement.description}
						</p>
					)}
				</div>
			</div>

			{/* Right indicator */}
			{comparison ? (
				<EarnedDot
					earned={theyEarned}
					date={comparison.theirEarnedAt}
					color="cyan"
				/>
			) : (
				/* Solo mode: just show date */
				<div className="flex items-center shrink-0">
					{iEarned && earnedAt ? (
						<span className="font-mono-retro text-[10px] tracking-[0.5px] text-neon-amber/50">
							{formatShortDate(earnedAt)}
						</span>
					) : (
						<div className="h-2 w-2 rounded-full bg-cream/10" />
					)}
				</div>
			)}
		</div>
	);
}
