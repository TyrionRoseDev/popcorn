import { motion } from "motion/react";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface MatchCelebrationProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	posterPath: string | null;
	watchlistName: string;
}

export function MatchCelebration({
	isOpen,
	onClose,
	title,
	posterPath,
	watchlistName,
}: MatchCelebrationProps) {
	const posterUrl = getTmdbImageUrl(posterPath, "w342");

	// Auto-dismiss after 3 seconds
	useEffect(() => {
		if (!isOpen) return;
		const timer = setTimeout(onClose, 3000);
		return () => clearTimeout(timer);
	}, [isOpen, onClose]);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent
				className="pointer-events-none inset-0 top-0 left-0 max-w-none w-screen h-screen translate-x-0 translate-y-0 rounded-none border-none bg-transparent p-0 gap-0 shadow-none"
				overlayClassName="bg-black/80"
				showCloseButton={false}
				aria-describedby={undefined}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<DialogTitle className="sr-only">Match</DialogTitle>
				{/* Content layer — sits behind curtains */}
				<motion.div
					className="pointer-events-auto relative flex flex-col items-center gap-4 px-6 text-center"
					style={{ maxWidth: "420px", width: "100%" }}
					initial={{ opacity: 0, scale: 0.85 }}
					animate={{
						opacity: 1,
						scale: 1,
						transition: { delay: 0.5, duration: 0.4 },
					}}
				>
					{/* Curtain Call header */}
					<p className="font-mono-retro text-[11px] uppercase tracking-[5px] text-cream/50">
						Curtain Call
					</p>

					{/* MATCH! */}
					<h2
						className="font-display text-5xl"
						style={{
							color: "#FFB800",
							textShadow:
								"0 0 20px rgba(255,184,0,0.6), 0 0 40px rgba(255,184,0,0.3)",
						}}
					>
						MATCH!
					</h2>

					{/* Poster */}
					{posterUrl && (
						<div className="w-32 overflow-hidden rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] ring-2 ring-neon-amber/40">
							<img
								src={posterUrl}
								alt={title}
								className="aspect-[2/3] w-full object-cover"
							/>
						</div>
					)}

					{/* Title */}
					<p className="max-w-[220px] text-base font-semibold text-cream">
						{title}
					</p>

					{/* Watchlist name */}
					<p className="text-sm text-cream/50">
						Added to{" "}
						<span className="font-semibold text-neon-amber">
							{watchlistName}
						</span>
					</p>
				</motion.div>

				{/* Curtain rod */}
				<motion.div
					className="absolute inset-x-0 top-[8%] h-3 rounded-full"
					style={{
						background:
							"linear-gradient(90deg, #a0752a 0%, #d4a84a 20%, #f0c060 50%, #d4a84a 80%, #a0752a 100%)",
						boxShadow: "0 2px 12px rgba(0,0,0,0.6), 0 4px 24px rgba(0,0,0,0.4)",
					}}
					initial={{ scaleX: 0 }}
					animate={{
						scaleX: 1,
						transition: { duration: 0.3, ease: "easeOut" },
					}}
				/>

				{/* Left curtain */}
				<motion.div
					className="absolute inset-y-0 left-0 w-1/2"
					style={{
						background:
							"linear-gradient(90deg, #8B0000 0%, #a00000 40%, #b81414 80%, #8B0000 100%)",
						transformOrigin: "left center",
					}}
					initial={{ x: 0 }}
					animate={{
						x: "-100%",
						transition: { duration: 0.6, ease: "easeInOut", delay: 0.2 },
					}}
				>
					{/* Curtain pleats */}
					<div
						className="h-full w-full opacity-20"
						style={{
							backgroundImage:
								"repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.3) 20px, rgba(0,0,0,0.3) 22px)",
						}}
					/>
				</motion.div>

				{/* Right curtain */}
				<motion.div
					className="absolute inset-y-0 right-0 w-1/2"
					style={{
						background:
							"linear-gradient(270deg, #8B0000 0%, #a00000 40%, #b81414 80%, #8B0000 100%)",
						transformOrigin: "right center",
					}}
					initial={{ x: 0 }}
					animate={{
						x: "100%",
						transition: { duration: 0.6, ease: "easeInOut", delay: 0.2 },
					}}
				>
					{/* Curtain pleats */}
					<div
						className="h-full w-full opacity-20"
						style={{
							backgroundImage:
								"repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,0,0,0.3) 20px, rgba(0,0,0,0.3) 22px)",
						}}
					/>
				</motion.div>
			</DialogContent>
		</Dialog>
	);
}
