import confetti from "canvas-confetti";
import { Sparkles } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "#/components/ui/dialog";

interface CompletionCelebrationProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	titleName: string;
	posterPath: string | null;
	episodeCount: number;
	onReview: () => void;
}

function fireConfetti() {
	const colors = ["#FFB800", "#00E5FF", "#FF2D78"];

	confetti({
		particleCount: 100,
		spread: 70,
		origin: { y: 0.6 },
		colors,
	});

	setTimeout(() => {
		confetti({
			particleCount: 50,
			angle: 60,
			spread: 55,
			origin: { x: 0 },
			colors,
		});
		confetti({
			particleCount: 50,
			angle: 120,
			spread: 55,
			origin: { x: 1 },
			colors,
		});
	}, 250);
}

export function CompletionCelebration({
	open,
	onOpenChange,
	titleName,
	posterPath,
	episodeCount,
	onReview,
}: CompletionCelebrationProps) {
	useEffect(() => {
		if (open) {
			// Small delay so overlay is visible first
			const timer = setTimeout(() => fireConfetti(), 150);
			return () => clearTimeout(timer);
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay className="bg-black/80 backdrop-blur-sm" />
				<DialogPrimitive.Content
					className="fixed inset-0 z-50 flex items-center justify-center outline-none"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					{/* Radial amber glow behind content */}
					<div
						className="pointer-events-none fixed inset-0"
						style={{
							background:
								"radial-gradient(ellipse at center, rgba(255,184,0,0.08) 0%, transparent 60%)",
						}}
					/>

					<div className="relative flex flex-col items-center gap-6 px-6 py-10 text-center celebration-fade-in">
						{/* "SHOW COMPLETE" marquee label */}
						<div className="flex items-center gap-2">
							<Sparkles
								className="h-4 w-4 text-neon-amber"
								style={{
									filter: "drop-shadow(0 0 6px rgba(255,184,0,0.6))",
								}}
							/>
							<span
								className="font-mono-retro text-xs tracking-[0.3em] uppercase"
								style={{
									color: "#FFB800",
									textShadow:
										"0 0 8px rgba(255,184,0,0.5), 0 0 20px rgba(255,184,0,0.3)",
									animation: "marquee-pulse 2s ease-in-out infinite",
								}}
							>
								Show Complete
							</span>
							<Sparkles
								className="h-4 w-4 text-neon-amber"
								style={{
									filter: "drop-shadow(0 0 6px rgba(255,184,0,0.6))",
								}}
							/>
						</div>

						{/* Poster with golden glow */}
						{posterPath && (
							<div
								className="relative h-[210px] w-[140px] overflow-hidden rounded-lg"
								style={{
									boxShadow:
										"0 0 30px rgba(255,184,0,0.3), 0 0 60px rgba(255,184,0,0.15), 0 0 2px rgba(255,184,0,0.6)",
									border: "2px solid rgba(255,184,0,0.4)",
								}}
							>
								<img
									src={`https://image.tmdb.org/t/p/w342${posterPath}`}
									alt=""
									className="h-full w-full object-cover"
								/>
								{/* Shimmer overlay */}
								<div
									className="absolute inset-0"
									style={{
										background:
											"linear-gradient(135deg, transparent 40%, rgba(255,184,0,0.12) 50%, transparent 60%)",
										animation: "shimmer-sweep 3s ease-in-out infinite",
									}}
								/>
							</div>
						)}

						{/* Title */}
						<h2
							className="font-display text-3xl tracking-wide text-cream max-w-sm leading-tight"
							style={{
								textShadow: "0 0 30px rgba(255,184,0,0.2)",
							}}
						>
							{titleName}
						</h2>

						{/* Episode count */}
						<p
							className="font-mono-retro text-[11px] tracking-wider text-cream/40"
							style={{
								textShadow: "0 0 8px rgba(0,229,255,0.2)",
							}}
						>
							All <span className="text-neon-cyan/80">{episodeCount}</span>{" "}
							episodes watched!
						</p>

						{/* Action buttons */}
						<div className="mt-2 flex flex-col items-center gap-3 w-full max-w-[220px]">
							<button
								type="button"
								onClick={() => {
									onOpenChange(false);
									// Small delay so celebration closes before review opens
									setTimeout(onReview, 200);
								}}
								className="w-full rounded-full px-6 py-2.5 font-mono-retro text-xs tracking-wider uppercase transition-all duration-200 hover:scale-[1.03]"
								style={{
									background:
										"linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.1))",
									border: "1px solid rgba(255,184,0,0.4)",
									color: "#FFB800",
									textShadow: "0 0 8px rgba(255,184,0,0.3)",
									boxShadow:
										"0 0 20px rgba(255,184,0,0.15), inset 0 1px 0 rgba(255,184,0,0.1)",
								}}
							>
								Leave a Review
							</button>

							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="w-full rounded-full px-6 py-2 font-mono-retro text-[10px] tracking-wider uppercase text-cream/30 transition-colors duration-200 hover:text-cream/50"
								style={{
									border: "1px solid rgba(255,255,240,0.08)",
								}}
							>
								Maybe Later
							</button>
						</div>
					</div>
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}
