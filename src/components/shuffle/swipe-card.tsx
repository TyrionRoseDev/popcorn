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

/** Generates positions for sprocket holes along the card edge */
const SPROCKET_COUNT = 10;
const SPROCKETS = Array.from({ length: SPROCKET_COUNT }, (_, i) => ({
	id: i,
	topPercent: `${6 + (i / (SPROCKET_COUNT - 1)) * 88}%`,
}));

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
	const rotate = useTransform(x, [-300, 300], [-18, 18]);
	const yesOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
	const noOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

	// Color tint overlays driven by drag
	const greenTint = useTransform(x, [0, SWIPE_THRESHOLD * 1.5], [0, 0.15]);
	const redTint = useTransform(x, [-SWIPE_THRESHOLD * 1.5, 0], [0.15, 0]);

	// Swipe feedback vignettes
	const goldenVignetteOpacity = useTransform(
		x,
		[0, SWIPE_THRESHOLD * 1.2],
		[0, 0.6],
	);
	const coolVignetteOpacity = useTransform(
		x,
		[-SWIPE_THRESHOLD * 1.2, 0],
		[0.6, 0],
	);

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

	const mediaTypeBadge = item.mediaType === "tv" ? "TV Series" : "Film";

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
					// Dramatic entrance for the top card promoting
					{...(isTop && stackIndex === 0
						? {
								initial: { scale: 0.96, filter: "brightness(1.4)" },
								animate: {
									scale: 1,
									filter: "brightness(1)",
									transition: { duration: 0.4, ease: "easeOut" },
								},
							}
						: {})}
					exit={{
						x: exitX,
						opacity: 0,
						filter: "blur(4px)",
						rotate: exitDirection === "right" ? 20 : -20,
						transition: { duration: 0.4, ease: "easeOut" },
					}}
					onClick={() => {
						if (!isDragging && isTop && !forceAction) {
							onTap();
						}
					}}
				>
					{/* Double border frame — thin inner + gap + thin outer */}
					<div
						className="absolute -inset-[3px] rounded-[18px] pointer-events-none"
						style={{
							border: "1px solid rgba(255,184,0,0.08)",
						}}
					/>
					<div
						className="absolute -inset-[6px] rounded-[21px] pointer-events-none"
						style={{
							border: "1px solid rgba(255,184,0,0.04)",
						}}
					/>

					{/* Sprocket holes — left side */}
					<div className="absolute left-0 top-0 bottom-0 w-3 z-20 pointer-events-none">
						{SPROCKETS.map((s) => (
							<div
								key={`l-${s.id}`}
								className="absolute left-[3px] rounded-[2px]"
								style={{
									top: s.topPercent,
									width: "6px",
									height: "9px",
									transform: "translateY(-50%)",
									backgroundColor: "rgba(0,0,0,0.5)",
									border: "0.5px solid rgba(255,255,240,0.04)",
									boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
								}}
							/>
						))}
					</div>

					{/* Sprocket holes — right side */}
					<div className="absolute right-0 top-0 bottom-0 w-3 z-20 pointer-events-none">
						{SPROCKETS.map((s) => (
							<div
								key={`r-${s.id}`}
								className="absolute right-[3px] rounded-[2px]"
								style={{
									top: s.topPercent,
									width: "6px",
									height: "9px",
									transform: "translateY(-50%)",
									backgroundColor: "rgba(0,0,0,0.5)",
									border: "0.5px solid rgba(255,255,240,0.04)",
									boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
								}}
							/>
						))}
					</div>

					<div
						className="relative h-full w-full overflow-hidden rounded-2xl bg-drive-in-card"
						style={{
							boxShadow:
								isTop && stackIndex === 0
									? "0 0 40px rgba(255,240,200,0.14), 0 0 80px rgba(255,184,0,0.08), 0 12px 50px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,184,0,0.1)"
									: "0 8px 40px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,240,0.05)",
						}}
					>
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

						{/* Film grain overlay on poster */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								opacity: 0.03,
								backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
								mixBlendMode: "overlay",
							}}
						/>

						{/* Light leak — warm amber in top-right corner */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								background:
									"radial-gradient(ellipse at 85% 8%, rgba(255,184,0,0.08) 0%, rgba(255,140,0,0.03) 30%, transparent 60%)",
							}}
						/>

						{/* Projector flicker overlay — subtle top wash */}
						<div
							className="absolute top-0 left-0 right-0 h-1/4 pointer-events-none"
							style={{
								background:
									"linear-gradient(to bottom, rgba(255,245,220,0.04) 0%, transparent 100%)",
								animationName: "projector-flicker",
								animationDuration: "4s",
								animationTimingFunction: "steps(1)",
								animationIterationCount: "infinite",
							}}
						/>

						{/* Gradient overlay for text — deeper, more dramatic */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								background:
									"linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.75) 18%, rgba(0,0,0,0.3) 38%, rgba(0,0,0,0.05) 55%, transparent 70%)",
							}}
						/>

						{/* Golden vignette on drag right — projector brightening */}
						{isTop && (
							<motion.div
								className="absolute inset-0 pointer-events-none"
								style={{
									opacity: goldenVignetteOpacity,
									background:
										"radial-gradient(ellipse at center, transparent 30%, rgba(255,184,0,0.25) 100%)",
								}}
							/>
						)}

						{/* Cool blue vignette on drag left — screen dimming */}
						{isTop && (
							<motion.div
								className="absolute inset-0 pointer-events-none"
								style={{
									opacity: coolVignetteOpacity,
									background:
										"radial-gradient(ellipse at center, transparent 30%, rgba(30,40,80,0.5) 100%)",
								}}
							/>
						)}

						{/* Green tint overlay on drag right */}
						{isTop && (
							<motion.div
								className="absolute inset-0"
								style={{
									backgroundColor: "rgba(74,222,128,1)",
									opacity: greenTint,
									pointerEvents: "none",
								}}
							/>
						)}

						{/* Red tint overlay on drag left */}
						{isTop && (
							<motion.div
								className="absolute inset-0"
								style={{
									backgroundColor: "rgba(248,113,113,1)",
									opacity: redTint,
									pointerEvents: "none",
								}}
							/>
						)}

						{/* Media type badge — ticket-stub style */}
						<div
							className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-md px-2 py-1"
							style={{
								background:
									"linear-gradient(135deg, rgba(255,184,0,0.15) 0%, rgba(255,140,0,0.08) 100%)",
								border: "1px solid rgba(255,184,0,0.2)",
								boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
								backdropFilter: "blur(8px)",
							}}
						>
							<span
								className="font-mono-retro text-[9px] font-bold uppercase tracking-widest text-neon-amber/90"
								style={{
									textShadow: "0 0 6px rgba(255,184,0,0.4)",
								}}
							>
								{mediaTypeBadge}
							</span>
						</div>

						{/* Card info at bottom */}
						<div className="absolute bottom-0 left-0 right-0 p-5">
							{/* Amber divider line */}
							<div
								className="mb-4"
								style={{
									height: "1px",
									background:
										"linear-gradient(90deg, transparent 0%, rgba(255,184,0,0.3) 20%, rgba(255,184,0,0.5) 50%, rgba(255,184,0,0.3) 80%, transparent 100%)",
									boxShadow: "0 0 8px rgba(255,184,0,0.15)",
								}}
							/>

							<h2
								className="font-display text-2xl leading-tight text-cream"
								style={{
									textShadow:
										"0 2px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255,255,240,0.08)",
								}}
							>
								{item.title}
							</h2>

							<div className="mt-1.5 flex items-center gap-3">
								{/* Rating with neon-amber glow */}
								<span
									className="flex items-center gap-1 text-base font-bold text-neon-amber"
									style={{
										textShadow:
											"0 0 10px rgba(255,184,0,0.5), 0 0 20px rgba(255,184,0,0.2)",
									}}
								>
									<span
										style={{
											filter:
												"drop-shadow(0 0 4px rgba(255,184,0,0.6)) drop-shadow(0 0 10px rgba(255,184,0,0.3))",
										}}
									>
										&#9733;
									</span>
									{item.rating.toFixed(1)}
								</span>
								{item.year && (
									<span className="text-sm text-cream/50">{item.year}</span>
								)}
							</div>

							{/* Genre pills — neon palette */}
							<div className="mt-2.5 flex flex-wrap gap-1.5">
								{item.genreIds.slice(0, 3).map((genreId, i) => (
									<span
										key={genreId}
										className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
										style={{
											background:
												i === 0
													? "rgba(255,45,120,0.15)"
													: "rgba(255,184,0,0.12)",
											border: `1px solid ${i === 0 ? "rgba(255,45,120,0.25)" : "rgba(255,184,0,0.2)"}`,
											color:
												i === 0
													? "rgba(255,130,175,0.95)"
													: "rgba(255,220,130,0.9)",
											textShadow:
												i === 0
													? "0 0 8px rgba(255,45,120,0.3)"
													: "0 0 8px rgba(255,184,0,0.3)",
										}}
									>
										{getGenreNameByTmdbId(genreId)}
									</span>
								))}
							</div>

							{/* Synopsis */}
							{item.overview && (
								<p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-cream/55">
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
