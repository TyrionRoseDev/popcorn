import {
	AnimatePresence,
	motion,
	useMotionValue,
	useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "#/lib/feed-assembler";
import { getGenreNameByTmdbId } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";
import { ClapperboardStamp, getRandomStamp } from "./clapperboard-stamp";

const SWIPE_THRESHOLD = 120;

interface SwipeCardProps {
	item: FeedItem;
	onSwipe: (direction: "left" | "right") => void;
	onTap: () => void;
	isTop: boolean;
	stackIndex: number;
	/** When set, shows the stamp and then exits the card in the given direction */
	forceAction?: "left" | "right" | null;
	/** Called after the stamp flash + exit animation completes */
	onForceActionComplete?: () => void;
}

export function SwipeCard({
	item,
	onSwipe,
	onTap,
	isTop,
	stackIndex,
	forceAction = null,
	onForceActionComplete,
}: SwipeCardProps) {
	const x = useMotionValue(0);
	const rotate = useTransform(x, [-300, 300], [-15, 15]);
	const yesOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
	const noOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

	const [isDragging, setIsDragging] = useState(false);
	const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
		null,
	);
	// Stamp flash state for button-triggered actions
	const [stampFlash, setStampFlash] = useState<"left" | "right" | null>(null);

	// Stable per-card stamps using ref so they don't change on re-render
	const yesStamp = useRef(getRandomStamp("yes")).current;
	const noStamp = useRef(getRandomStamp("no")).current;

	const posterUrl = getTmdbImageUrl(item.posterPath, "w342");

	// Stack visual offsets
	const scale = 1 - stackIndex * 0.04;
	const y = stackIndex * 8;
	const opacity = 1 - stackIndex * 0.2;

	// Handle forceAction: show stamp then exit
	useEffect(() => {
		if (!forceAction || !isTop) return;

		setStampFlash(forceAction);

		const timer = setTimeout(() => {
			setStampFlash(null);
			setExitDirection(forceAction);
			onForceActionComplete?.();
		}, 350);

		return () => clearTimeout(timer);
	}, [forceAction, isTop, onForceActionComplete]);

	function handleDragEnd() {
		setIsDragging(false);
		const currentX = x.get();
		if (currentX > SWIPE_THRESHOLD) {
			setExitDirection("right");
			onSwipe("right");
		} else if (currentX < -SWIPE_THRESHOLD) {
			setExitDirection("left");
			onSwipe("left");
		}
	}

	const exitX =
		exitDirection === "right" ? 800 : exitDirection === "left" ? -800 : 0;

	// Determine stamp opacity: either from drag motion or from button flash
	const showYesStamp = stampFlash === "right";
	const showNoStamp = stampFlash === "left";

	return (
		<AnimatePresence>
			{exitDirection === null && (
				<motion.div
					className="absolute inset-0 cursor-grab active:cursor-grabbing"
					style={{
						x: isTop ? x : 0,
						rotate: isTop ? rotate : 0,
						scale,
						y,
						opacity,
						zIndex: 10 - stackIndex,
					}}
					drag={isTop && !forceAction ? "x" : false}
					dragConstraints={{ left: 0, right: 0 }}
					dragElastic={0.8}
					onDragStart={() => setIsDragging(true)}
					onDragEnd={handleDragEnd}
					exit={{
						x: exitX,
						opacity: 0,
						transition: { duration: 0.35, ease: "easeOut" },
					}}
					onClick={() => {
						if (!isDragging && isTop && !forceAction) {
							onTap();
						}
					}}
				>
					<div className="relative h-full w-full overflow-hidden rounded-2xl border border-cream/10 bg-drive-in-card shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
						{/* Poster image */}
						<div className="absolute inset-0">
							{posterUrl ? (
								<img
									src={posterUrl}
									alt={item.title}
									className="h-full w-full object-cover"
									draggable={false}
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-cream/5">
									<span className="font-mono-retro text-xs text-cream/20">
										No Poster
									</span>
								</div>
							)}
						</div>

						{/* Gradient overlay for text readability */}
						<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

						{/* Media type badge */}
						<div className="absolute top-3 right-3 rounded-md bg-black/70 px-2 py-0.5 font-mono-retro text-[10px] font-semibold uppercase tracking-wider text-cream/70">
							{item.mediaType === "tv" ? "TV" : "Film"}
						</div>

						{/* Card info at bottom */}
						<div className="absolute bottom-0 left-0 right-0 p-5">
							<h2 className="text-xl font-bold leading-tight text-cream">
								{item.title}
							</h2>
							<div className="mt-1 flex items-center gap-2">
								<span className="text-sm font-medium text-neon-amber">
									★ {item.rating.toFixed(1)}
								</span>
								{item.year && (
									<span className="text-sm text-cream/50">{item.year}</span>
								)}
							</div>

							{/* Genre pills */}
							<div className="mt-2 flex flex-wrap gap-1.5">
								{item.genreIds.slice(0, 3).map((genreId) => (
									<span
										key={genreId}
										className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-cream/80 backdrop-blur-sm"
									>
										{getGenreNameByTmdbId(genreId)}
									</span>
								))}
							</div>

							{/* Synopsis */}
							{item.overview && (
								<p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-cream/60">
									{item.overview}
								</p>
							)}
						</div>

						{/* YES stamp overlay — drag-driven */}
						{isTop && !stampFlash && (
							<motion.div
								style={{ opacity: yesOpacity }}
								className="absolute inset-0"
							>
								<ClapperboardStamp type="yes" opacity={1} stamp={yesStamp} />
							</motion.div>
						)}

						{/* NO stamp overlay — drag-driven */}
						{isTop && !stampFlash && (
							<motion.div
								style={{ opacity: noOpacity }}
								className="absolute inset-0"
							>
								<ClapperboardStamp type="no" opacity={1} stamp={noStamp} />
							</motion.div>
						)}

						{/* YES stamp — button flash */}
						{isTop && showYesStamp && (
							<motion.div
								initial={{ opacity: 0, scale: 0.7 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.15, ease: "easeOut" }}
								className="absolute inset-0"
							>
								<ClapperboardStamp type="yes" opacity={1} stamp={yesStamp} />
							</motion.div>
						)}

						{/* NO stamp — button flash */}
						{isTop && showNoStamp && (
							<motion.div
								initial={{ opacity: 0, scale: 0.7 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 0.15, ease: "easeOut" }}
								className="absolute inset-0"
							>
								<ClapperboardStamp type="no" opacity={1} stamp={noStamp} />
							</motion.div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
