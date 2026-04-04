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
	onClick?: () => void;
}

function formatShortDate(date: Date): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "2-digit",
	});
}

export function AchievementBadge({
	achievement,
	earned,
	earnedAt,
	comparison,
	onClick,
}: AchievementBadgeProps) {
	const iEarned = comparison ? comparison.myEarnedAt !== null : earned;
	const theyEarned = comparison ? comparison.theirEarnedAt !== null : false;

	const Wrapper = onClick ? "button" : "div";

	return (
		<Wrapper
			{...(onClick ? { type: "button" as const, onClick } : {})}
			className={[
				"group relative flex flex-col items-center rounded-xl bg-drive-in-card text-center",
				"transition-transform duration-200",
				iEarned && onClick ? "cursor-pointer hover:scale-105" : "",
				!iEarned ? "opacity-30 grayscale" : "",
			]
				.filter(Boolean)
				.join(" ")}
			style={{
				width: "140px",
				minHeight: "170px",
				padding: "3px",
				backgroundImage: iEarned
					? "conic-gradient(from 0deg, rgba(255,45,120,0.6) 0%, rgba(255,184,0,0.6) 33%, rgba(0,229,255,0.6) 66%, rgba(255,45,120,0.6) 100%)"
					: undefined,
				background: iEarned ? undefined : "#0a0a1e",
			}}
		>
			{/* Inner fill */}
			<div
				className="absolute inset-[3px] rounded-[calc(0.75rem-2px)] bg-drive-in-card"
				aria-hidden="true"
			/>

			{/* Card content */}
			<div className="relative z-10 flex w-full flex-1 flex-col items-center gap-2 px-3 pb-3 pt-4">
				{/* Icon */}
				<div
					className="text-4xl leading-none"
					style={
						iEarned
							? {
									textShadow:
										"0 0 10px rgba(255,184,0,0.6), 0 0 24px rgba(255,184,0,0.35)",
								}
							: undefined
					}
				>
					{iEarned ? achievement.icon : "?"}
				</div>

				{/* Name */}
				<p className="font-display text-xs leading-snug text-cream/85">
					{iEarned ? achievement.name : "???"}
				</p>

				{/* Date earned */}
				{iEarned && earnedAt && (
					<p className="font-mono-retro text-[9px] tracking-[1px] text-neon-amber/50">
						{formatShortDate(earnedAt)}
					</p>
				)}

				{/* Comparison indicators */}
				{comparison && (iEarned || theyEarned) && (
					<div className="mt-auto flex flex-wrap justify-center gap-1 pt-1">
						{comparison.myEarnedAt && (
							<span className="rounded-full border border-neon-amber/30 bg-neon-amber/10 px-1.5 py-0.5 font-mono-retro text-[8px] uppercase tracking-[0.5px] text-neon-amber">
								You
							</span>
						)}
						{comparison.theirEarnedAt && (
							<span
								className="rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-1.5 py-0.5 font-mono-retro text-[8px] uppercase tracking-[0.5px] text-neon-cyan truncate max-w-[70px]"
								title={comparison.theirName}
							>
								{comparison.theirName}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Locked overlay */}
			{!iEarned && (
				<div
					className="absolute inset-[3px] z-20 flex items-center justify-center rounded-[calc(0.75rem-2px)]"
					aria-hidden="true"
				>
					<span className="text-2xl">🔒</span>
				</div>
			)}
		</Wrapper>
	);
}
