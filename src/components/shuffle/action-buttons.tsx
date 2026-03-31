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
		<div className="flex items-end justify-center gap-3.5 sm:gap-4">
			{/* No — circular pink arcade button */}
			<div className="flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onNo}
					className={cn(
						"group relative flex size-[60px] items-center justify-center rounded-full",
						"border-[3px] border-neon-pink/50 bg-neon-pink/[0.18]",
						"transition-all duration-100",
						"hover:translate-y-[2px] hover:border-neon-pink/60",
						"active:scale-[0.88] active:translate-y-1",
					)}
					style={{
						boxShadow:
							"0 5px 0 rgba(255,45,120,0.3), 0 0 20px rgba(255,45,120,0.18)",
					}}
					aria-label="No — skip this title"
				>
					{/* Outer glow ring */}
					<div
						aria-hidden="true"
						className="absolute -inset-[7px] rounded-full border border-neon-pink/25 pointer-events-none opacity-30 transition-opacity group-hover:opacity-15"
					/>
					{/* Inner concave depth */}
					<div
						aria-hidden="true"
						className="absolute inset-[3px] rounded-full bg-neon-pink/15 pointer-events-none"
						style={{ filter: "brightness(0.6)" }}
					/>
					<X
						className="relative z-10 size-[22px] text-neon-pink/90"
						style={{
							filter: "drop-shadow(0 0 8px rgba(255,45,120,0.5))",
						}}
						strokeWidth={2.5}
					/>
				</button>
				<span
					className="font-mono-retro text-[8px] uppercase tracking-[2px] text-neon-pink/60"
					style={{ textShadow: "0 0 8px rgba(255,45,120,0.3)" }}
				>
					Cut!
				</span>
			</div>

			{/* Undo — small circular utility button */}
			<div className="mb-4 flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onUndo}
					disabled={!canUndo}
					className={cn(
						"flex size-[42px] items-center justify-center rounded-full",
						"border-2 border-cream/[0.12] bg-cream/[0.05]",
						"transition-all duration-100",
						canUndo
							? "hover:scale-105 hover:border-neon-amber/20 active:scale-90 active:translate-y-0.5"
							: "cursor-not-allowed opacity-30",
					)}
					style={{
						boxShadow:
							"0 3px 0 rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
					}}
					aria-label="Undo"
				>
					<RotateCcw
						className={cn(
							"size-[14px]",
							canUndo ? "text-cream/45" : "text-cream/25",
						)}
					/>
				</button>
				<span className="font-mono-retro text-[7px] uppercase tracking-[1.5px] text-cream/25">
					Undo
				</span>
			</div>

			{/* Hide — small circular utility button */}
			<div className="mb-4 flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onHide}
					className={cn(
						"flex size-[42px] items-center justify-center rounded-full",
						"border-2 border-cream/[0.12] bg-cream/[0.05]",
						"transition-all duration-100",
						"hover:scale-105 hover:border-neon-amber/20",
						"active:scale-90 active:translate-y-0.5",
					)}
					style={{
						boxShadow:
							"0 3px 0 rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
					}}
					aria-label="Hide"
				>
					<EyeOff className="size-[14px] text-cream/45" />
				</button>
				<span className="font-mono-retro text-[7px] uppercase tracking-[1.5px] text-cream/25">
					Hide
				</span>
			</div>

			{/* Yes — circular cyan arcade button */}
			<div className="flex flex-col items-center gap-1.5">
				<button
					type="button"
					onClick={onYes}
					className={cn(
						"group relative flex size-[60px] items-center justify-center rounded-full",
						"border-[3px] border-neon-cyan/50 bg-neon-cyan/[0.12]",
						"transition-all duration-100",
						"hover:translate-y-[2px] hover:border-neon-cyan/60",
						"active:scale-[0.88] active:translate-y-1",
					)}
					style={{
						boxShadow:
							"0 5px 0 rgba(0,229,255,0.2), 0 0 20px rgba(0,229,255,0.15)",
					}}
					aria-label="Yes — add to watchlist"
				>
					{/* Outer glow ring */}
					<div
						aria-hidden="true"
						className="absolute -inset-[7px] rounded-full border border-neon-cyan/25 pointer-events-none opacity-30 transition-opacity group-hover:opacity-15"
					/>
					{/* Inner concave depth */}
					<div
						aria-hidden="true"
						className="absolute inset-[3px] rounded-full bg-neon-cyan/10 pointer-events-none"
						style={{ filter: "brightness(0.6)" }}
					/>
					<Check
						className="relative z-10 size-[22px] text-neon-cyan/90"
						style={{
							filter: "drop-shadow(0 0 8px rgba(0,229,255,0.5))",
						}}
						strokeWidth={2.5}
					/>
				</button>
				<span
					className="font-mono-retro text-[8px] uppercase tracking-[2px] text-neon-cyan/60"
					style={{ textShadow: "0 0 8px rgba(0,229,255,0.3)" }}
				>
					Action!
				</span>
			</div>
		</div>
	);
}
