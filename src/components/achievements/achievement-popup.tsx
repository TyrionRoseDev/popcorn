import { motion } from "motion/react";
import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "#/components/ui/dialog";
import { ACHIEVEMENTS_BY_ID, TOTAL_ACHIEVEMENTS } from "#/lib/achievements";

interface AchievementPopupProps {
	achievementIds: string[];
	earnedTotal: number;
	onDismiss: () => void;
}

const PARTICLE_COUNT = 40;

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
	id: i,
	left: `${5 + ((i * 37 + 11) % 90)}%`,
	delay: `${((i * 23) % 20) / 10}s`,
	duration: `${4 + ((i * 17) % 20) / 10}s`,
	width: 4 + ((i * 13) % 5),
	height: 8 + ((i * 7) % 10),
	color:
		i % 3 === 0
			? "rgba(255,45,120,0.9)"
			: i % 3 === 1
				? "rgba(255,184,0,0.9)"
				: "rgba(0,229,255,0.9)",
	drift: `${((i * 41) % 60) - 30}px`,
	initialRotate: (i * 29) % 360,
}));

export function AchievementPopup({
	achievementIds,
	earnedTotal,
	onDismiss,
}: AchievementPopupProps) {
	const achievements = useMemo(
		() =>
			achievementIds
				.map((id) => ACHIEVEMENTS_BY_ID.get(id))
				.filter((a) => a !== undefined),
		[achievementIds],
	);

	if (achievements.length === 0) return null;

	const isSingle = achievements.length === 1;
	const totalAchievements = TOTAL_ACHIEVEMENTS;

	return (
		<>
			<style>{`
				@keyframes ach-particle-rise {
					0% {
						transform: translateY(0) translateX(0) rotate(var(--rot)) scale(1);
						opacity: 0;
					}
					10% { opacity: 1; }
					80% { opacity: 0.8; }
					100% {
						transform: translateY(-85vh) translateX(var(--drift)) rotate(calc(var(--rot) + 720deg)) scale(0.3);
						opacity: 0;
					}
				}
				@keyframes ach-projector-sweep {
					0% { transform: rotate(-25deg); opacity: 0.12; }
					50% { transform: rotate(25deg); opacity: 0.18; }
					100% { transform: rotate(-25deg); opacity: 0.12; }
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

			<Dialog
				open
				onOpenChange={(v) => {
					if (!v) onDismiss();
				}}
			>
				<DialogContent
					className="!inset-0 !top-0 !left-0 !max-w-none !w-screen !h-screen !translate-x-0 !translate-y-0 !rounded-none !border-none !bg-transparent !p-0 !gap-0 !shadow-none !z-[60]"
					overlayClassName="bg-[rgba(5,5,8,0.88)] backdrop-blur-[12px] !z-[60]"
					showCloseButton={false}
					aria-describedby={undefined}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogTitle className="sr-only">
						{isSingle ? "Achievement Unlocked" : "Achievements Unlocked"}
					</DialogTitle>

					{/* Projector sweep beam */}
					<div className="flex items-center justify-center overflow-hidden w-full h-full">
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
						<div
							aria-hidden="true"
							className="pointer-events-none fixed inset-0"
						>
							{PARTICLES.map((p) => (
								<div
									key={p.id}
									className="absolute bottom-0 rounded-[1px]"
									style={
										{
											left: p.left,
											width: `${p.width}px`,
											height: `${p.height}px`,
											background: p.color,
											"--drift": p.drift,
											"--rot": `${p.initialRotate}deg`,
											animation: `ach-particle-rise ${p.duration} ${p.delay} ease-out infinite`,
										} as React.CSSProperties
									}
								/>
							))}
						</div>

						{/* Modal card */}
						<motion.div
							className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 text-center overflow-y-auto max-h-screen"
							style={{ maxWidth: "600px", width: "100%" }}
							initial={{ scale: 0.9, y: 20, opacity: 0 }}
							animate={{ scale: 1, y: 0, opacity: 1 }}
							exit={{ scale: 0.9, y: -20, opacity: 0 }}
							transition={{ type: "spring", damping: 18, stiffness: 220 }}
						>
							{/* "Achievement(s) Unlocked" label */}
							<p
								className="font-mono-retro text-xs uppercase tracking-[4px] text-neon-amber/80"
								style={{
									textShadow:
										"0 0 12px rgba(255,184,0,0.5), 0 0 30px rgba(255,184,0,0.2)",
								}}
							>
								{isSingle ? "Achievement Unlocked" : "Achievements Unlocked"}
							</p>

							{/* Badge grid */}
							<div
								className="flex flex-wrap justify-center gap-4"
								style={{ perspective: "800px" }}
							>
								{achievements.map((achievement, i) => (
									<motion.div
										key={achievement.id}
										initial={{ rotateY: 90, scale: 0.85, opacity: 0 }}
										animate={{ rotateY: 0, scale: 1, opacity: 1 }}
										transition={{
											delay: 0.15 * i,
											duration: 0.7,
											ease: [0.16, 1, 0.3, 1],
										}}
									>
										<div
											className="relative flex flex-col items-center justify-center gap-2 rounded-2xl"
											style={{
												width: "160px",
												height: "220px",
												padding: "3px",
												backgroundImage:
													"conic-gradient(from var(--ach-angle), #FF2D78 0%, #FFB800 33%, #00E5FF 66%, #FF2D78 100%)",
												animation: "ach-conic-spin 3s linear infinite",
											}}
										>
											{/* Inner card fill */}
											<div
												className="absolute inset-[3px] rounded-2xl"
												style={{ background: "#0a0a1e" }}
											/>

											{/* Icon */}
											<div
												className="relative z-10 text-5xl leading-none"
												style={{
													animation:
														"ach-icon-glow-pulse 2s ease-in-out infinite",
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

											{/* Description on badge */}
											<p className="relative z-10 font-sans text-[10px] text-cream/40 px-3 text-center leading-snug">
												{achievement.description}
											</p>
										</div>
									</motion.div>
								))}
							</div>

							{/* Progress count */}
							<motion.p
								className="font-mono-retro text-xs tracking-[2px] text-neon-amber/45"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.45, duration: 0.4 }}
							>
								{earnedTotal} / {totalAchievements} Achievements
							</motion.p>

							{/* Continue button */}
							<motion.button
								type="button"
								onClick={onDismiss}
								className="relative overflow-hidden rounded-full border border-neon-amber/50 bg-neon-amber/12 px-8 py-3 font-mono-retro text-sm uppercase tracking-[2px] text-neon-amber transition-all hover:border-neon-amber/80 hover:bg-neon-amber/22 hover:shadow-[0_0_24px_rgba(255,184,0,0.25)] active:scale-95"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.5, duration: 0.35 }}
							>
								Continue
							</motion.button>
						</motion.div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
