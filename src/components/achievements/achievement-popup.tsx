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
	const isMany = achievements.length >= 3;
	const totalAchievements = TOTAL_ACHIEVEMENTS;

	const cardWidth = isMany ? 150 : 180;
	const cardHeight = isMany ? 190 : 220;
	const iconSize = isMany ? "44px" : "56px";
	const nameFontSize = isMany ? "14px" : "18px";
	const descFontSize = isMany ? "9px" : "12px";

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
				@keyframes ach-icon-glow-pulse {
					0%, 100% {
						text-shadow: 0 0 12px rgba(255,184,0,0.6), 0 0 30px rgba(255,184,0,0.4), 0 0 60px rgba(255,184,0,0.2);
					}
					50% {
						text-shadow: 0 0 18px rgba(255,184,0,0.9), 0 0 45px rgba(255,184,0,0.6), 0 0 90px rgba(255,184,0,0.3);
					}
				}
				@keyframes ach-spotlight-pulse {
					0%, 100% { opacity: 0.08; }
					50% { opacity: 0.12; }
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
					overlayClassName="bg-[rgba(5,5,8,0.55)] backdrop-blur-[6px] !z-[60]"
					showCloseButton={false}
					aria-describedby={undefined}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<DialogTitle className="sr-only">
						{isSingle ? "Achievement Unlocked" : "Achievements Unlocked"}
					</DialogTitle>

					<div className="flex items-center justify-center overflow-hidden w-full h-full relative">
						{/* Curtain swag SVG — scalloped red valance */}
						<svg
							aria-hidden="true"
							className="pointer-events-none absolute top-0 left-0 w-full z-20"
							height="50"
							viewBox="0 0 500 50"
							preserveAspectRatio="none"
						>
							<defs>
								<linearGradient
									id="ach-valance-grad"
									x1="0%"
									y1="0%"
									x2="0%"
									y2="100%"
								>
									<stop offset="0%" stopColor="#8B0000" />
									<stop offset="50%" stopColor="#DC143C" />
									<stop offset="100%" stopColor="#5C0000" />
								</linearGradient>
							</defs>
							<path
								d="M0,0 L0,12 Q62,50 125,12 Q187,50 250,12 Q312,50 375,12 Q437,50 500,12 L500,0 Z"
								fill="url(#ach-valance-grad)"
							/>
						</svg>

						{/* Left curtain sliver */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute top-0 left-0 h-full z-10"
							style={{
								width: "8%",
								background: "linear-gradient(90deg, #4a0000, #8B0000, #DC143C)",
								boxShadow:
									"inset -8px 0 15px rgba(0,0,0,0.5), 3px 0 10px rgba(0,0,0,0.5)",
							}}
						/>

						{/* Right curtain sliver */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute top-0 right-0 h-full z-10"
							style={{
								width: "8%",
								background:
									"linear-gradient(270deg, #4a0000, #8B0000, #DC143C)",
								boxShadow:
									"inset 8px 0 15px rgba(0,0,0,0.5), -3px 0 10px rgba(0,0,0,0.5)",
							}}
						/>

						{/* Spotlight cone */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute left-1/2 z-[1]"
							style={{
								top: "50px",
								width: "250px",
								height: "calc(100% - 50px)",
								marginLeft: "-125px",
								background:
									"radial-gradient(ellipse 100% 60% at 50% 0%, rgba(255,240,200,0.18) 0%, rgba(255,220,150,0.08) 40%, transparent 100%)",
								animation: "ach-spotlight-pulse 4s ease-in-out infinite",
							}}
						/>

						{/* Stage floor */}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute bottom-0 left-0 w-full z-10"
							style={{
								height: "55px",
								background: "linear-gradient(180deg, #2a1508, #0f0802)",
							}}
						>
							{/* Gold highlight line above stage floor */}
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									height: "1px",
									background:
										"linear-gradient(90deg, transparent, rgba(255,184,0,0.6), rgba(255,215,0,0.9), rgba(255,184,0,0.6), transparent)",
								}}
							/>
						</div>

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

						{/* Center content */}
						<motion.div
							className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 text-center overflow-y-auto max-h-screen"
							style={{ maxWidth: "700px", width: "100%" }}
							initial={{ scale: 0.9, y: 20, opacity: 0 }}
							animate={{ scale: 1, y: 0, opacity: 1 }}
							transition={{ type: "spring", damping: 18, stiffness: 220 }}
						>
							{/* "Achievement(s) Unlocked" label */}
							<p
								className="font-mono-retro text-xs uppercase"
								style={{
									color: "rgba(255,184,0,0.9)",
									letterSpacing: "5px",
									textShadow:
										"0 0 12px rgba(255,184,0,0.7), 0 0 30px rgba(255,184,0,0.4), 0 0 60px rgba(255,184,0,0.2)",
								}}
							>
								{isSingle ? "Achievement Unlocked" : "Achievements Unlocked"}
							</p>

							{/* Horizontal trophy + cards + trophy row */}
							<div className="flex items-center gap-5">
								{/* Left trophy */}
								<motion.div
									aria-hidden="true"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										delay: 0.3,
										duration: 0.5,
										ease: [0.16, 1, 0.3, 1],
									}}
									style={{
										fontSize: "72px",
										lineHeight: 1,
										transform: "rotate(-5deg)",
										filter:
											"drop-shadow(0 0 20px rgba(255,184,0,0.7)) drop-shadow(0 0 40px rgba(255,184,0,0.4))",
									}}
								>
									🏆
								</motion.div>

								{/* Achievement cards */}
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
													width: `${cardWidth}px`,
													height: `${cardHeight}px`,
													padding: "3px",
													backgroundImage:
														"linear-gradient(135deg, #FFD700, #B8860B, #DAA520, #B8860B, #FFD700)",
													boxShadow:
														"0 0 40px rgba(255,184,0,0.3), 0 8px 32px rgba(0,0,0,0.5)",
												}}
											>
												{/* Inner card fill */}
												<div
													className="absolute inset-[3px] rounded-2xl"
													style={{
														background:
															"linear-gradient(180deg, #1a1020, #0f0a18)",
													}}
												/>

												{/* Icon */}
												<div
													className="relative z-10 leading-none"
													style={{
														fontSize: iconSize,
														animation:
															"ach-icon-glow-pulse 2s ease-in-out infinite",
													}}
												>
													{achievement.icon}
												</div>

												{/* Name */}
												<p
													className="relative z-10 font-display text-center px-3 leading-tight"
													style={{
														fontSize: nameFontSize,
														color: "#FFD700",
														textShadow:
															"0 0 8px rgba(255,215,0,0.6), 0 0 20px rgba(255,184,0,0.3)",
													}}
												>
													{achievement.name}
												</p>

												{/* Description */}
												<p
													className="relative z-10 font-sans text-center px-3 leading-snug"
													style={{
														fontSize: descFontSize,
														color: "rgba(245,240,232,0.8)",
													}}
												>
													{achievement.description}
												</p>
											</div>
										</motion.div>
									))}
								</div>

								{/* Right trophy */}
								<motion.div
									aria-hidden="true"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										delay: 0.3,
										duration: 0.5,
										ease: [0.16, 1, 0.3, 1],
									}}
									style={{
										fontSize: "72px",
										lineHeight: 1,
										transform: "rotate(5deg)",
										filter:
											"drop-shadow(0 0 20px rgba(255,184,0,0.7)) drop-shadow(0 0 40px rgba(255,184,0,0.4))",
									}}
								>
									🏆
								</motion.div>
							</div>

							{/* Progress count */}
							<motion.p
								className="font-mono-retro text-xs tracking-[2px]"
								style={{ color: "rgba(255,184,0,0.6)" }}
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
								className="relative overflow-hidden rounded-full px-8 py-3 font-mono uppercase active:scale-95 transition-all"
								style={{
									border: "1px solid rgba(255,184,0,0.5)",
									color: "rgba(255,184,0,0.9)",
									letterSpacing: "3px",
									fontSize: "13px",
									background: "rgba(255,184,0,0.08)",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.borderColor = "rgba(255,184,0,0.8)";
									e.currentTarget.style.background = "rgba(255,184,0,0.18)";
									e.currentTarget.style.boxShadow =
										"0 0 24px rgba(255,184,0,0.25)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.borderColor = "rgba(255,184,0,0.5)";
									e.currentTarget.style.background = "rgba(255,184,0,0.08)";
									e.currentTarget.style.boxShadow = "none";
								}}
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
