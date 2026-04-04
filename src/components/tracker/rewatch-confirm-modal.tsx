import { RotateCcw } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";

interface RewatchConfirmModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	isComplete: boolean;
	watchedCount: number;
	totalEpisodes: number;
	currentWatchNumber: number;
	onConfirm: () => void;
	isPending?: boolean;
}

export function RewatchConfirmModal({
	open,
	onOpenChange,
	titleName,
	isComplete,
	watchedCount,
	totalEpisodes,
	currentWatchNumber,
	onConfirm,
	isPending,
}: RewatchConfirmModalProps) {
	const watchLabel =
		currentWatchNumber === 1 ? "Watch 1" : `Rewatch ${currentWatchNumber}`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay className="bg-black/80 backdrop-blur-sm" />
				<DialogPrimitive.Content
					className="fixed inset-0 z-50 flex items-center justify-center outline-none"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div
						className="relative mx-6 flex max-w-sm flex-col items-center gap-5 rounded-xl px-8 py-8 text-center"
						style={{
							background:
								"linear-gradient(160deg, rgba(20,16,32,0.98) 0%, rgba(12,10,24,0.99) 100%)",
							border: "1px solid rgba(255,45,120,0.2)",
							boxShadow:
								"0 0 40px rgba(255,45,120,0.08), 0 8px 32px rgba(0,0,0,0.6)",
						}}
					>
						{/* Icon */}
						<div
							className="flex h-12 w-12 items-center justify-center rounded-full"
							style={{
								background: "rgba(255,45,120,0.1)",
								border: "1px solid rgba(255,45,120,0.25)",
								boxShadow: "0 0 20px rgba(255,45,120,0.1)",
							}}
						>
							<RotateCcw
								className="h-5 w-5 text-neon-pink"
								style={{
									filter: "drop-shadow(0 0 6px rgba(255,45,120,0.5))",
								}}
							/>
						</div>

						{/* Title */}
						<h2 className="font-display text-xl tracking-wide text-cream leading-tight">
							Start rewatching{" "}
							<span className="text-neon-pink">{titleName}</span>?
						</h2>

						{/* Description */}
						{isComplete ? (
							<p className="text-sm text-cream/40 leading-relaxed max-w-[280px]">
								Your progress and notes from {watchLabel} are saved. You'll
								start fresh tracking episodes again.
							</p>
						) : (
							<p className="text-sm text-cream/40 leading-relaxed max-w-[280px]">
								You haven't finished this show yet — you've watched{" "}
								<span className="text-cream/60">{watchedCount}</span> of{" "}
								<span className="text-cream/60">{totalEpisodes}</span> episodes.
								Your progress is saved but you'll be starting a fresh
								watch-through.
							</p>
						)}

						{/* Buttons */}
						<div className="mt-1 flex w-full flex-col gap-2.5">
							<button
								type="button"
								onClick={() => {
									onConfirm();
								}}
								disabled={isPending}
								className="w-full rounded-full px-6 py-2.5 font-mono-retro text-xs tracking-wider uppercase transition-all duration-200 hover:scale-[1.03] disabled:opacity-40 disabled:pointer-events-none"
								style={{
									background:
										"linear-gradient(135deg, rgba(255,45,120,0.2), rgba(255,45,120,0.1))",
									border: "1px solid rgba(255,45,120,0.4)",
									color: "#FF2D78",
									textShadow: "0 0 8px rgba(255,45,120,0.3)",
									boxShadow:
										"0 0 20px rgba(255,45,120,0.12), inset 0 1px 0 rgba(255,45,120,0.1)",
								}}
							>
								{isComplete ? "Start Rewatch" : "Start Rewatch Anyway"}
							</button>

							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="w-full rounded-full px-6 py-2 font-mono-retro text-[10px] tracking-wider uppercase text-cream/30 transition-colors duration-200 hover:text-cream/50"
								style={{
									border: "1px solid rgba(255,255,240,0.08)",
								}}
							>
								Cancel
							</button>
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
