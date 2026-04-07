import { Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
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

	const myMap = useMemo(
		() => new Map(myEarned.map((e) => [e.id, e.earnedAt])),
		[myEarned],
	);
	const theirMap = useMemo(
		() => new Map((theirEarned ?? []).map((e) => [e.id, e.earnedAt])),
		[theirEarned],
	);

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
				className="flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border-drive-in-border bg-drive-in-card p-0 gap-0 shadow-2xl"
				overlayClassName="bg-[rgba(5,5,8,0.82)] backdrop-blur-[10px]"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">
					{isComparison ? "Compare Achievements" : "Achievements"}
				</DialogTitle>

				<motion.div
					className="flex flex-col overflow-hidden rounded-2xl border border-drive-in-border bg-drive-in-card shadow-2xl w-full"
					style={{ maxHeight: "85vh" }}
					initial={{ scale: 0.94, y: 16, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					exit={{ scale: 0.94, y: 16, opacity: 0 }}
					transition={{ type: "spring", damping: 22, stiffness: 240 }}
				>
					{/* Header */}
					<div className="flex items-center justify-between border-b border-drive-in-border/60 px-5 py-4">
						<div className="flex items-center gap-2.5">
							<Trophy
								className="text-neon-amber"
								style={{ width: "18px", height: "18px" }}
							/>
							<h2
								className="font-display text-lg text-cream"
								style={{ textShadow: "0 0 12px rgba(255,184,0,0.25)" }}
							>
								{isComparison ? "Compare Achievements" : "Achievements"}
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

					{/* Progress bars */}
					<div className="border-b border-drive-in-border/40 px-5 py-4 flex flex-col gap-3">
						{/* You */}
						<ProgressRow
							label="You"
							count={myCount}
							total={total}
							pct={myPct}
							color="amber"
						/>
						{/* Them */}
						{isComparison && (
							<ProgressRow
								label={theirName}
								count={theirCount}
								total={total}
								pct={theirPct}
								color="cyan"
							/>
						)}
					</div>

					{/* Filter tabs */}
					{isComparison && (
						<div className="flex items-center gap-1 border-b border-drive-in-border/40 px-5 py-2.5 overflow-x-auto">
							{filterTabs.map((tab) => {
								const isActive = filter === tab.key;
								const activeColor =
									tab.key === "them"
										? "bg-neon-cyan/15 border-neon-cyan/40 text-neon-cyan"
										: "bg-neon-amber/15 border-neon-amber/40 text-neon-amber";
								return (
									<button
										key={tab.key}
										type="button"
										onClick={() => setFilter(tab.key)}
										className={`rounded-full px-3 py-1 font-mono-retro text-[9px] uppercase tracking-[0.5px] transition-all whitespace-nowrap border ${
											isActive
												? activeColor
												: "border-transparent text-cream/35 hover:text-cream/60"
										}`}
									>
										{tab.label}
										{tab.count !== undefined && (
											<span className="ml-1 opacity-60">{tab.count}</span>
										)}
									</button>
								);
							})}
						</div>
					)}

					{/* Column headers in comparison mode */}
					{isComparison && (
						<div className="flex items-center gap-3 px-4 py-2 border-b border-drive-in-border/30">
							<span className="w-16 text-center font-mono-retro text-[8px] uppercase tracking-[1px] text-neon-amber/40">
								You
							</span>
							<div className="flex-1" />
							<span className="w-16 text-center font-mono-retro text-[8px] uppercase tracking-[1px] text-neon-cyan/40">
								{theirName}
							</span>
						</div>
					)}

					{/* Achievement list */}
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col gap-px py-1">
							<AnimatePresence mode="popLayout">
								{visibleAchievements.map((achievement, i) => {
									const myDate = myMap.get(achievement.id) ?? null;
									const theirDate = theirMap.get(achievement.id) ?? null;
									const isEarned = myDate !== null;

									return (
										<motion.div
											key={achievement.id}
											layout
											initial={{ opacity: 0, x: -8 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: 8 }}
											transition={{
												type: "spring",
												damping: 24,
												stiffness: 300,
												delay: Math.min(i * 0.02, 0.3),
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
						</div>
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
