import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo } from "react";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";

interface AchievementPopupProps {
	achievementIds: string[];
	currentIndex: number;
	earnedTotal: number;
	onDismiss: () => void;
}

const PARTICLE_COUNT = 40;

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
	id: i,
	left: `${5 + ((i * 37 + 11) % 90)}%`,
	delay: `${((i * 23) % 20) / 10}s`,
	duration: `${2.5 + ((i * 17) % 20) / 10}s`,
	size: 3 + ((i * 13) % 5),
	color:
		i % 3 === 0
			? "rgba(255,45,120,0.9)"
			: i % 3 === 1
				? "rgba(255,184,0,0.9)"
				: "rgba(0,229,255,0.9)",
	drift: `${((i * 41) % 60) - 30}px`,
}));

export function AchievementPopup({
	achievementIds,
	currentIndex,
	earnedTotal,
	onDismiss,
}: AchievementPopupProps) {
	const achievement = useMemo(
		() => ACHIEVEMENTS_BY_ID.get(achievementIds[currentIndex] ?? ""),
		[achievementIds, currentIndex],
	);

	// Dismiss on Escape
	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onDismiss();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onDismiss]);

	if (!achievement) return null;

	const hasMore = currentIndex < achievementIds.length - 1;
	const totalAchievements = 30; // matches TOTAL_ACHIEVEMENTS

	return (
		<>
			<style>{`
				@keyframes ach-particle-rise {
					0% {
						transform: translateY(0) translateX(0) scale(1);
						opacity: 0;
					}
					10% { opacity: 1; }
					80% { opacity: 0.8; }
					100% {
						transform: translateY(-85vh) translateX(var(--drift)) scale(0.3);
						opacity: 0;
					}
				}
				@keyframes ach-projector-sweep {
					0% { transform: rotate(-25deg); opacity: 0.12; }
					50% { transform: rotate(25deg); opacity: 0.18; }
					100% { transform: rotate(-25deg); opacity: 0.12; }
				}
				@keyframes ach-badge-flip {
					0% {
						transform: rotateY(90deg) scale(0.85);
						opacity: 0;
					}
					60% {
						transform: rotateY(-8deg) scale(1.04);
						opacity: 1;
					}
					80% {
						transform: rotateY(4deg) scale(0.99);
					}
					100% {
						transform: rotateY(0deg) scale(1);
						opacity: 1;
					}
				}
				@keyframes ach-icon-glow-pulse {
					0%, 100% {
						text-shadow: 0 0 12px rgba(255,184,0,0.6), 0 0 30px rgba(255,184,0,0.4), 0 0 60px rgba(255,184,0,0.2);
					}
					50% {
						text-shadow: 0 0 18px rgba(255,184,0,0.9), 0 0 45px rgba(255,184,0,0.6), 0 0 90px rgba(255,184,0,0.3);
					}
				}
				@keyframes ach-conic-spin {
					from { --ach-angle: 0deg; }
					to { --ach-angle: 360deg; }
				}
				@property --ach-angle {
					syntax: '<angle>';
					initial-value: 0deg;
					inherits: false;
				}
			`}</style>

			<AnimatePresence>
				<motion.div
					key="popup-backdrop"
					className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.3 }}
					style={{
						background: "rgba(5,5,8,0.88)",
						backdropFilter: "blur(12px)",
						WebkitBackdropFilter: "blur(12px)",
					}}
					onClick={onDismiss}
				>
					{/* Projector sweep beam */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute bottom-0 left-1/2 origin-bottom"
						style={{
							width: "300px",
							height: "100vh",
							marginLeft: "-150px",
							background:
								"conic-gradient(from -15deg at 50% 100%, transparent 0deg, rgba(255,184,0,0.08) 15deg, transparent 30deg)",
							animation: "ach-projector-sweep 4s ease-in-out infinite",
						}}
					/>

					{/* Particles */}
					<div aria-hidden="true" className="pointer-events-none fixed inset-0">
						{PARTICLES.map((p) => (
							<div
								key={p.id}
								className="absolute bottom-0 rounded-full"
								style={
									{
										left: p.left,
										width: `${p.size}px`,
										height: `${p.size}px`,
										background: p.color,
										"--drift": p.drift,
										animation: `ach-particle-rise ${p.duration} ${p.delay} ease-out infinite`,
									} as React.CSSProperties
								}
							/>
						))}
					</div>

					{/* Modal card */}
					<motion.div
						key={`popup-card-${achievementIds[currentIndex]}`}
						className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 text-center"
						style={{ maxWidth: "420px", width: "100%" }}
						initial={{ scale: 0.9, y: 20, opacity: 0 }}
						animate={{ scale: 1, y: 0, opacity: 1 }}
						exit={{ scale: 0.9, y: -20, opacity: 0 }}
						transition={{ type: "spring", damping: 18, stiffness: 220 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* "Achievement Unlocked" label */}
						<p
							className="font-mono-retro text-xs uppercase tracking-[4px] text-neon-amber/80"
							style={{
								textShadow:
									"0 0 12px rgba(255,184,0,0.5), 0 0 30px rgba(255,184,0,0.2)",
							}}
						>
							Achievement Unlocked
						</p>

						{/* Badge */}
						<div
							style={{
								perspective: "600px",
								animation:
									"ach-badge-flip 0.7s cubic-bezier(0.16,1,0.3,1) both",
							}}
						>
							<div
								className="relative flex flex-col items-center justify-center gap-3 rounded-2xl"
								style={{
									width: "180px",
									height: "210px",
									background: "#0a0a1e",
									padding: "3px",
									backgroundImage:
										"conic-gradient(from var(--ach-angle), #FF2D78 0%, #FFB800 33%, #00E5FF 66%, #FF2D78 100%)",
									animation:
										"ach-badge-flip 0.7s cubic-bezier(0.16,1,0.3,1) both, ach-conic-spin 3s linear infinite",
								}}
							>
								{/* Inner card fill */}
								<div
									className="absolute inset-[3px] rounded-2xl"
									style={{ background: "#0a0a1e" }}
								/>

								{/* Icon */}
								<div
									className="relative z-10 text-6xl leading-none"
									style={{
										animation: "ach-icon-glow-pulse 2s ease-in-out infinite",
										textShadow:
											"0 0 12px rgba(255,184,0,0.7), 0 0 30px rgba(255,184,0,0.4)",
									}}
								>
									{achievement.icon}
								</div>

								{/* Name on badge */}
								<p
									className="relative z-10 font-display text-sm text-cream/90 px-3 text-center leading-tight"
									style={{
										textShadow: "0 0 8px rgba(255,184,0,0.3)",
									}}
								>
									{achievement.name}
								</p>
							</div>
						</div>

						{/* Achievement name (big gradient) */}
						<motion.h2
							className="font-display text-3xl leading-tight"
							style={{
								background:
									"linear-gradient(135deg, #FF2D78 0%, #FFB800 50%, #00E5FF 100%)",
								WebkitBackgroundClip: "text",
								WebkitTextFillColor: "transparent",
								backgroundClip: "text",
							}}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.25, duration: 0.4 }}
						>
							{achievement.name}
						</motion.h2>

						{/* Description */}
						<motion.p
							className="text-sm leading-relaxed text-cream/55"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.35, duration: 0.4 }}
						>
							{achievement.description}
						</motion.p>

						{/* Progress count */}
						<motion.p
							className="font-mono-retro text-xs tracking-[2px] text-neon-amber/45"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.45, duration: 0.4 }}
						>
							{earnedTotal} / {totalAchievements} Achievements
						</motion.p>

						{/* Continue / Next button */}
						<motion.button
							type="button"
							onClick={onDismiss}
							className="relative overflow-hidden rounded-full border border-neon-amber/50 bg-neon-amber/12 px-8 py-3 font-mono-retro text-sm uppercase tracking-[2px] text-neon-amber transition-all hover:border-neon-amber/80 hover:bg-neon-amber/22 hover:shadow-[0_0_24px_rgba(255,184,0,0.25)] active:scale-95"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.5, duration: 0.35 }}
						>
							{hasMore ? "Next" : "Continue"}
						</motion.button>
					</motion.div>
				</motion.div>
			</AnimatePresence>
		</>
	);
}
