import { Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
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

type FilterTab = "all" | "shared" | "you" | "them";

export function AchievementGrid({
	myEarned,
	theirEarned,
	theirName,
	onClose,
}: AchievementGridProps) {
	const [filter, setFilter] = useState<FilterTab>("all");

	const isComparison = theirEarned !== undefined && theirName !== undefined;

	const myMap = new Map(myEarned.map((e) => [e.id, e.earnedAt]));
	const theirMap = new Map((theirEarned ?? []).map((e) => [e.id, e.earnedAt]));

	const total = ACHIEVEMENTS.length;
	const myCount = myEarned.length;
	const theirCount = theirEarned?.length ?? 0;
	const sharedCount = isComparison
		? ACHIEVEMENTS.filter((a) => myMap.has(a.id) && theirMap.has(a.id)).length
		: 0;
	const youOnlyCount = isComparison ? myCount - sharedCount : 0;
	const themOnlyCount = isComparison ? theirCount - sharedCount : 0;

	const myPct = Math.round((myCount / total) * 100);
	const theirPct = Math.round((theirCount / total) * 100);

	const visibleAchievements = useMemo(() => {
		let filtered = ACHIEVEMENTS.filter((a) => {
			const iHave = myMap.has(a.id);
			const theyHave = theirMap.has(a.id);
			switch (filter) {
				case "shared":
					return iHave && theyHave;
				case "you":
					return iHave && !theyHave;
				case "them":
					return !iHave && theyHave;
				default:
					return true;
			}
		});

		// Sort: both → you only → them only → neither
		if (isComparison) {
			filtered = [...filtered].sort((a, b) => {
				const aMe = myMap.has(a.id) ? 2 : 0;
				const aThem = theirMap.has(a.id) ? 1 : 0;
				const bMe = myMap.has(b.id) ? 2 : 0;
				const bThem = theirMap.has(b.id) ? 1 : 0;
				return bMe + bThem - (aMe + aThem);
			});
		}

		return filtered;
	}, [filter, isComparison, myMap, theirMap]);

	const filterTabs: { key: FilterTab; label: string; count?: number }[] =
		isComparison
			? [
					{ key: "all", label: "All" },
					{ key: "shared", label: "Shared", count: sharedCount },
					{ key: "you", label: "You Only", count: youOnlyCount },
					{ key: "them", label: `${theirName} Only`, count: themOnlyCount },
				]
			: [];

	return (
		<Dialog
			open
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent
				className="flex max-h-[85vh] max-w-[600px] flex-col overflow-hidden rounded-2xl border-drive-in-border bg-drive-in-card p-0 gap-0 shadow-2xl"
				overlayClassName="bg-[rgba(5,5,8,0.82)] backdrop-blur-[10px]"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">Achievements</DialogTitle>
				<motion.div
					className="flex flex-col overflow-hidden rounded-2xl border border-drive-in-border bg-drive-in-card shadow-2xl"
					style={{ width: "100%", maxWidth: "600px", maxHeight: "85vh" }}
					initial={{ scale: 0.94, y: 16, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					exit={{ scale: 0.94, y: 16, opacity: 0 }}
					transition={{ type: "spring", damping: 22, stiffness: 240 }}
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
											transition={{
												type: "spring",
												damping: 20,
												stiffness: 260,
											}}
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
			</DialogContent>
		</Dialog>
	);
}

function ProgressRow({
	label,
	count,
	total,
	pct,
	color,
}: {
	label: string;
	count: number;
	total: number;
	pct: number;
	color: "amber" | "cyan";
}) {
	const barBg = color === "amber" ? "bg-neon-amber/8" : "bg-neon-cyan/8";
	const barFill = color === "amber" ? "bg-neon-amber" : "bg-neon-cyan";
	const labelColor = color === "amber" ? "text-neon-amber" : "text-neon-cyan";
	const chipBorder =
		color === "amber"
			? "border-neon-amber/30 bg-neon-amber/8"
			: "border-neon-cyan/30 bg-neon-cyan/8";

	return (
		<div className="flex items-center gap-3">
			<span
				className={`shrink-0 rounded-full border px-2 py-0.5 font-mono-retro text-[9px] uppercase tracking-[1px] ${labelColor} ${chipBorder} truncate max-w-[80px]`}
				title={label}
			>
				{label}
			</span>
			<div
				className={`relative flex-1 h-2.5 rounded-full overflow-hidden ${barBg}`}
			>
				<motion.div
					className={`absolute inset-y-0 left-0 rounded-full ${barFill}`}
					style={{ opacity: 0.7 }}
					initial={{ width: 0 }}
					animate={{ width: `${pct}%` }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
				/>
			</div>
			<span className="shrink-0 font-mono-retro text-[10px] text-cream/50 tabular-nums w-[60px] text-right">
				{count}
				<span className="text-cream/25">/{total}</span>
			</span>
		</div>
	);
}
