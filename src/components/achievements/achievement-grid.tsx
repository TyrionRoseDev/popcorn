import { Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ACHIEVEMENTS } from "#/lib/achievements";
import { AchievementBadge } from "./achievement-badge";

interface EarnedAchievement {
	id?: string;
	earnedAt: Date;
}

interface AchievementGridProps {
	myEarned: EarnedAchievement[];
	theirEarned?: EarnedAchievement[];
	theirName?: string;
	onClose: () => void;
}

type FilterTab = "all" | "shared";

export function AchievementGrid({
	myEarned,
	theirEarned,
	theirName,
	onClose,
}: AchievementGridProps) {
	const [filter, setFilter] = useState<FilterTab>("all");

	const isComparison = theirEarned !== undefined && theirName !== undefined;

	// Build lookup maps
	const myMap = new Map(myEarned.map((e) => [e.id, e.earnedAt]));
	const theirMap = new Map((theirEarned ?? []).map((e) => [e.id, e.earnedAt]));

	const myCount = myEarned.length;
	const theirCount = theirEarned?.length ?? 0;
	const sharedCount = isComparison
		? ACHIEVEMENTS.filter((a) => myMap.has(a.id) && theirMap.has(a.id)).length
		: 0;

	const visibleAchievements = ACHIEVEMENTS.filter((a) => {
		if (filter === "shared") {
			return myMap.has(a.id) && theirMap.has(a.id);
		}
		return true;
	});

	return (
		<div
			className="fixed inset-0 z-[999] flex items-center justify-center p-4"
			style={{
				background: "rgba(5,5,8,0.82)",
				backdropFilter: "blur(10px)",
				WebkitBackdropFilter: "blur(10px)",
			}}
			role="dialog"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			<motion.div
				className="flex flex-col overflow-hidden rounded-2xl border border-drive-in-border bg-drive-in-card shadow-2xl"
				style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh" }}
				initial={{ scale: 0.94, y: 16, opacity: 0 }}
				animate={{ scale: 1, y: 0, opacity: 1 }}
				exit={{ scale: 0.94, y: 16, opacity: 0 }}
				transition={{ type: "spring", damping: 22, stiffness: 240 }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-drive-in-border/60 px-5 py-4">
					<div className="flex items-center gap-2.5">
						<Trophy
							className="h-4.5 w-4.5 text-neon-amber"
							style={{ width: "18px", height: "18px" }}
						/>
						<h2
							className="font-display text-lg text-cream"
							style={{
								textShadow: "0 0 12px rgba(255,184,0,0.25)",
							}}
						>
							Achievements
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center rounded-lg p-1.5 text-cream/35 transition-colors hover:bg-cream/6 hover:text-cream/70"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Stats row */}
				<div className="border-b border-drive-in-border/40 px-5 py-3">
					{isComparison ? (
						<div className="flex items-center gap-4">
							<StatChip
								label="You"
								value={myCount}
								total={ACHIEVEMENTS.length}
								color="amber"
							/>
							<span className="text-cream/15 text-xs">·</span>
							<StatChip
								label={theirName}
								value={theirCount}
								total={ACHIEVEMENTS.length}
								color="cyan"
							/>
							<span className="text-cream/15 text-xs">·</span>
							<div className="flex items-center gap-1.5">
								<span className="font-mono-retro text-[10px] uppercase tracking-[1px] text-cream/40">
									Shared
								</span>
								<span className="font-display text-sm text-cream/70">
									{sharedCount}
								</span>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-1.5">
							<span className="font-display text-base text-neon-amber">
								{myCount}
							</span>
							<span className="font-mono-retro text-[10px] uppercase tracking-[1.5px] text-cream/35">
								/ {ACHIEVEMENTS.length} Earned
							</span>
						</div>
					)}
				</div>

				{/* Filter tabs — only in comparison mode */}
				{isComparison && (
					<div className="flex items-center gap-1 border-b border-drive-in-border/40 px-5 py-2.5">
						{(["all", "shared"] as FilterTab[]).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => setFilter(tab)}
								className={[
									"rounded-full px-3.5 py-1 font-mono-retro text-[10px] uppercase tracking-[1px] transition-all",
									filter === tab
										? "bg-neon-amber/15 border border-neon-amber/40 text-neon-amber"
										: "border border-transparent text-cream/35 hover:text-cream/60",
								].join(" ")}
							>
								{tab === "all" ? "All" : "Shared"}
							</button>
						))}
					</div>
				)}

				{/* Grid */}
				<div className="flex-1 overflow-y-auto px-5 py-5">
					<motion.div layout className="flex flex-wrap justify-center gap-3">
						<AnimatePresence mode="popLayout">
							{visibleAchievements.map((achievement) => {
								const myDate = myMap.get(achievement.id) ?? null;
								const theirDate = theirMap.get(achievement.id) ?? null;
								const isEarned = myDate !== null;

								return (
									<motion.div
										key={achievement.id}
										layout
										initial={{ opacity: 0, scale: 0.85 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.85 }}
										transition={{ type: "spring", damping: 20, stiffness: 260 }}
									>
										<AchievementBadge
											achievement={achievement}
											earned={isEarned}
											earnedAt={myDate}
											comparison={
												isComparison
													? {
															myEarnedAt: myDate,
															theirEarnedAt: theirDate,
															theirName: theirName,
														}
													: undefined
											}
										/>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</motion.div>
				</div>
			</motion.div>
		</div>
	);
}

function StatChip({
	label,
	value,
	total,
	color,
}: {
	label: string;
	value: number;
	total: number;
	color: "amber" | "cyan";
}) {
	const colorClasses =
		color === "amber"
			? "text-neon-amber border-neon-amber/30 bg-neon-amber/8"
			: "text-neon-cyan border-neon-cyan/30 bg-neon-cyan/8";

	return (
		<div className="flex items-center gap-1.5">
			<span
				className={`rounded-full border px-2 py-0.5 font-mono-retro text-[9px] uppercase tracking-[1px] ${colorClasses}`}
			>
				{label}
			</span>
			<span className="font-display text-sm text-cream/70">
				{value}
				<span className="font-mono-retro text-[10px] text-cream/30">
					/{total}
				</span>
			</span>
		</div>
	);
}
