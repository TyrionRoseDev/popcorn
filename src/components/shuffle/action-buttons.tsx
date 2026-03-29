import { Check, EyeOff, RotateCcw, X } from "lucide-react";
import { cn } from "#/lib/utils";

interface ActionButtonsProps {
	onNo: () => void;
	onUndo: () => void;
	onHide: () => void;
	onYes: () => void;
	canUndo: boolean;
}

export function ActionButtons({
	onNo,
	onUndo,
	onHide,
	onYes,
	canUndo,
}: ActionButtonsProps) {
	return (
		<div className="flex items-end justify-center gap-3 sm:gap-4">
			{/* No — large red arcade button */}
			<div className="flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onNo}
					className={cn(
						"group relative flex size-16 items-center justify-center rounded-2xl sm:size-[72px]",
						"border-2 border-red-500/40 bg-drive-in-card",
						"transition-all duration-100",
						"hover:scale-105 hover:border-red-400/60",
						"active:scale-[0.88] active:translate-y-0.5",
					)}
					style={{
						boxShadow:
							"0 6px 0 rgba(80,0,0,0.5), 0 6px 24px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.3)",
					}}
					aria-label="No — skip this title"
				>
					{/* Neon red underglow — pulsing idle */}
					<div
						className="absolute -inset-1.5 rounded-2xl"
						style={{
							background:
								"radial-gradient(ellipse at 50% 80%, rgba(239,68,68,0.25) 0%, transparent 70%)",
							animationName: "button-underglow-pulse",
							animationDuration: "2.5s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							filter: "blur(6px)",
						}}
					/>
					{/* Hover glow brightens */}
					<div
						className="absolute -inset-2 rounded-2xl opacity-0 blur-lg transition-opacity group-hover:opacity-100"
						style={{
							background:
								"radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)",
						}}
					/>
					<X
						className="relative h-7 w-7 text-red-400"
						style={{
							filter: "drop-shadow(0 0 8px rgba(239,68,68,0.6))",
						}}
						strokeWidth={2.5}
					/>
				</button>
				<span
					className="font-mono-retro text-[8px] uppercase tracking-[2px] text-red-400/70"
					style={{ textShadow: "0 0 8px rgba(239,68,68,0.4)" }}
				>
					Cut!
				</span>
			</div>

			{/* Undo — small utility button, raised */}
			<div className="mb-5 flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onUndo}
					disabled={!canUndo}
					className={cn(
						"flex size-11 items-center justify-center rounded-xl sm:size-12",
						"border border-drive-in-border bg-drive-in-card",
						"transition-all duration-100",
						canUndo
							? "hover:scale-105 hover:border-neon-amber/30 active:scale-90 active:translate-y-0.5"
							: "cursor-not-allowed opacity-30",
					)}
					style={{
						boxShadow:
							"0 3px 0 rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)",
					}}
					aria-label="Undo"
				>
					<RotateCcw
						className={cn(
							"h-4 w-4",
							canUndo ? "text-cream/60" : "text-cream/30",
						)}
					/>
				</button>
				<span className="font-mono-retro text-[7px] uppercase tracking-[1.5px] text-cream/30">
					Undo
				</span>
			</div>

			{/* Hide — small utility button, raised */}
			<div className="mb-5 flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onHide}
					className={cn(
						"flex size-11 items-center justify-center rounded-xl sm:size-12",
						"border border-drive-in-border bg-drive-in-card",
						"transition-all duration-100",
						"hover:scale-105 hover:border-neon-amber/30",
						"active:scale-90 active:translate-y-0.5",
					)}
					style={{
						boxShadow:
							"0 3px 0 rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)",
					}}
					aria-label="Hide"
				>
					<EyeOff className="h-4 w-4 text-cream/60" />
				</button>
				<span className="font-mono-retro text-[7px] uppercase tracking-[1.5px] text-cream/30">
					Hide
				</span>
			</div>

			{/* Yes — large green arcade button */}
			<div className="flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onYes}
					className={cn(
						"group relative flex size-16 items-center justify-center rounded-2xl sm:size-[72px]",
						"border-2 border-green-500/40 bg-drive-in-card",
						"transition-all duration-100",
						"hover:scale-105 hover:border-green-400/60",
						"active:scale-[0.88] active:translate-y-0.5",
					)}
					style={{
						boxShadow:
							"0 6px 0 rgba(0,60,0,0.5), 0 6px 24px rgba(74,222,128,0.25), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -2px 0 rgba(0,0,0,0.3)",
					}}
					aria-label="Yes — add to watchlist"
				>
					{/* Neon green underglow — pulsing idle */}
					<div
						className="absolute -inset-1.5 rounded-2xl"
						style={{
							background:
								"radial-gradient(ellipse at 50% 80%, rgba(74,222,128,0.25) 0%, transparent 70%)",
							animationName: "button-underglow-pulse",
							animationDuration: "2.5s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDelay: "-1.2s",
							filter: "blur(6px)",
						}}
					/>
					{/* Hover glow brightens */}
					<div
						className="absolute -inset-2 rounded-2xl opacity-0 blur-lg transition-opacity group-hover:opacity-100"
						style={{
							background:
								"radial-gradient(circle, rgba(74,222,128,0.35) 0%, transparent 70%)",
						}}
					/>
					<Check
						className="relative h-7 w-7 text-green-400"
						style={{
							filter: "drop-shadow(0 0 8px rgba(74,222,128,0.6))",
						}}
						strokeWidth={2.5}
					/>
				</button>
				<span
					className="font-mono-retro text-[8px] uppercase tracking-[2px] text-green-400/70"
					style={{ textShadow: "0 0 8px rgba(74,222,128,0.4)" }}
				>
					Action!
				</span>
			</div>
		</div>
	);
}
