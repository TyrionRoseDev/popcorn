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
			<button
				type="button"
				onClick={onNo}
				className={cn(
					"group relative flex size-16 items-center justify-center rounded-2xl sm:size-[72px]",
					"border-2 border-red-500/50 bg-red-500/10",
					"shadow-[0_6px_24px_rgba(239,68,68,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]",
					"transition-all duration-150",
					"hover:scale-105 hover:border-red-400/70 hover:bg-red-500/20 hover:shadow-[0_8px_32px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
					"active:scale-95 active:shadow-[0_2px_8px_rgba(239,68,68,0.2)]",
				)}
				aria-label="No"
			>
				{/* Ambient glow */}
				<div className="absolute -inset-1 rounded-2xl bg-red-500/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
				<X
					className="relative h-7 w-7 text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
					strokeWidth={2.5}
				/>
			</button>

			{/* Undo — small muted utility, raised */}
			<button
				type="button"
				onClick={onUndo}
				disabled={!canUndo}
				className={cn(
					"mb-2 flex size-11 items-center justify-center rounded-xl sm:size-12",
					"border border-cream/15 bg-cream/5",
					"shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
					"transition-all duration-150",
					canUndo
						? "hover:scale-105 hover:border-cream/30 hover:bg-cream/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] active:scale-95"
						: "cursor-not-allowed opacity-30",
				)}
				aria-label="Undo"
			>
				<RotateCcw
					className={cn("h-4 w-4", canUndo ? "text-cream/60" : "text-cream/30")}
				/>
			</button>

			{/* Hide — small muted utility, raised */}
			<button
				type="button"
				onClick={onHide}
				className={cn(
					"mb-2 flex size-11 items-center justify-center rounded-xl sm:size-12",
					"border border-cream/15 bg-cream/5",
					"shadow-[0_2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
					"transition-all duration-150",
					"hover:scale-105 hover:border-cream/30 hover:bg-cream/10 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
					"active:scale-95",
				)}
				aria-label="Hide"
			>
				<EyeOff className="h-4 w-4 text-cream/60" />
			</button>

			{/* Yes — large green arcade button */}
			<button
				type="button"
				onClick={onYes}
				className={cn(
					"group relative flex size-16 items-center justify-center rounded-2xl sm:size-[72px]",
					"border-2 border-green-500/50 bg-green-500/10",
					"shadow-[0_6px_24px_rgba(74,222,128,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]",
					"transition-all duration-150",
					"hover:scale-105 hover:border-green-400/70 hover:bg-green-500/20 hover:shadow-[0_8px_32px_rgba(74,222,128,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
					"active:scale-95 active:shadow-[0_2px_8px_rgba(74,222,128,0.2)]",
				)}
				aria-label="Yes"
			>
				{/* Ambient glow */}
				<div className="absolute -inset-1 rounded-2xl bg-green-500/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
				<Check
					className="relative h-7 w-7 text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.5)]"
					strokeWidth={2.5}
				/>
			</button>
		</div>
	);
}
