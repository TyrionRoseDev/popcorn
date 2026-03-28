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
		<div className="flex items-end justify-center gap-4">
			{/* No — large red */}
			<button
				type="button"
				onClick={onNo}
				className={cn(
					"flex size-12 items-center justify-center rounded-full",
					"border-2 border-red-500/60 bg-red-500/15 text-red-400",
					"shadow-[0_4px_16px_rgba(239,68,68,0.25)]",
					"transition-all hover:scale-105 hover:border-red-400 hover:bg-red-500/25",
					"active:scale-95",
				)}
				aria-label="No"
			>
				<X className="h-5 w-5" strokeWidth={2.5} />
			</button>

			{/* Undo — small muted, raised */}
			<button
				type="button"
				onClick={onUndo}
				disabled={!canUndo}
				className={cn(
					"mb-1 flex size-10 items-center justify-center rounded-full",
					"border border-cream/20 bg-cream/5 text-cream/40",
					"transition-all",
					canUndo
						? "hover:scale-105 hover:border-cream/40 hover:bg-cream/10 hover:text-cream/70 active:scale-95"
						: "cursor-not-allowed opacity-40",
				)}
				aria-label="Undo"
			>
				<RotateCcw className="h-4 w-4" />
			</button>

			{/* Hide — small muted, raised */}
			<button
				type="button"
				onClick={onHide}
				className={cn(
					"mb-1 flex size-10 items-center justify-center rounded-full",
					"border border-cream/20 bg-cream/5 text-cream/40",
					"transition-all hover:scale-105 hover:border-cream/40 hover:bg-cream/10 hover:text-cream/70",
					"active:scale-95",
				)}
				aria-label="Hide"
			>
				<EyeOff className="h-4 w-4" />
			</button>

			{/* Yes — large green */}
			<button
				type="button"
				onClick={onYes}
				className={cn(
					"flex size-12 items-center justify-center rounded-full",
					"border-2 border-green-500/60 bg-green-500/15 text-green-400",
					"shadow-[0_4px_16px_rgba(74,222,128,0.25)]",
					"transition-all hover:scale-105 hover:border-green-400 hover:bg-green-500/25",
					"active:scale-95",
				)}
				aria-label="Yes"
			>
				<Check className="h-5 w-5" strokeWidth={2.5} />
			</button>
		</div>
	);
}
