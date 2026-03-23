import { useState } from "react";
import { getTmdbImageUrl } from "#/lib/tmdb";

interface DriveInScreenProps {
	backdropPath: string | null;
	trailerKey: string | null;
}

export function DriveInScreen({ backdropPath, trailerKey }: DriveInScreenProps) {
	const [playing, setPlaying] = useState(false);
	const backdropUrl = getTmdbImageUrl(backdropPath, "w1280");

	return (
		<div className="relative max-w-[1100px] mx-auto mt-10 px-6">
			{/* Screen frame with support poles via pseudo-elements */}
			<div
				className="relative rounded-[4px] p-[6px] before:content-[''] before:absolute before:bottom-[-50px] before:left-[15%] before:w-2 before:h-[50px] before:rounded-b-[2px] before:[background:linear-gradient(to_bottom,#222,#111)] after:content-[''] after:absolute after:bottom-[-50px] after:right-[15%] after:w-2 after:h-[50px] after:rounded-b-[2px] after:[background:linear-gradient(to_bottom,#222,#111)]"
				style={{
					background: "#111",
					boxShadow:
						"0 0 80px rgba(180,200,255,0.06), 0 0 200px rgba(180,200,255,0.03), 0 20px 60px rgba(0,0,0,0.8)",
				}}
			>
				{/* Screen glow (behind the frame) */}
				<div
					aria-hidden="true"
					className="absolute pointer-events-none"
					style={{
						top: "-40px",
						left: "-60px",
						right: "-60px",
						bottom: "-40px",
						background:
							"radial-gradient(ellipse at 50% 50%, rgba(180,200,255,0.04) 0%, transparent 70%)",
						zIndex: -1,
					}}
				/>

				{/* Screen inner */}
				<div
					className="relative w-full overflow-hidden rounded-[2px]"
					style={{
						aspectRatio: "16/9",
						maxHeight: "450px",
						background: "linear-gradient(135deg, #1a1028 0%, #0d1a2e 40%, #1a0a1e 100%)",
					}}
				>
					{playing && trailerKey ? (
						<iframe
							src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
							title="Trailer"
							allow="autoplay; encrypted-media"
							allowFullScreen
							className="absolute inset-0 w-full h-full z-10"
						/>
					) : (
						<>
							{/* Projector beam */}
							<div
								aria-hidden="true"
								className="absolute pointer-events-none"
								style={{
									top: "-200px",
									left: "50%",
									transform: "translateX(-50%)",
									width: "120%",
									height: "250px",
									background:
										"linear-gradient(to bottom, transparent 0%, rgba(200,210,255,0.008) 40%, rgba(200,210,255,0.015) 70%, rgba(200,210,255,0.02) 100%)",
									clipPath: "polygon(48% 0%, 52% 0%, 100% 100%, 0% 100%)",
								}}
							/>

							{/* Backdrop image or fallback gradient */}
							<div
								className="absolute inset-0 bg-cover bg-center"
								style={
									backdropUrl
										? { backgroundImage: `url(${backdropUrl})` }
										: {
												background:
													"radial-gradient(ellipse at 30% 40%, #1a1040 0%, #0d0d1a 50%, #050510 100%)",
											}
								}
							/>

							{/* Bottom fade */}
							<div
								aria-hidden="true"
								className="absolute bottom-0 left-0 right-0 z-[3] pointer-events-none"
								style={{
									height: "40%",
									background: "linear-gradient(transparent, rgba(5,5,8,0.6))",
								}}
							/>

							{/* Play button */}
							{trailerKey && (
								<button
									type="button"
									aria-label="Play trailer"
									onClick={() => setPlaying(true)}
									className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[5] flex flex-col items-center gap-2 cursor-pointer group"
								>
									{/* Circle */}
									<div
										className="w-20 h-20 rounded-full border-[2.5px] border-neon-pink flex items-center justify-center transition-all duration-300 group-hover:scale-105"
										style={{
											boxShadow:
												"0 0 40px rgba(255,45,120,0.4), 0 0 80px rgba(255,45,120,0.15)",
										}}
									>
										{/* Play triangle */}
										<div
											aria-hidden="true"
											className="w-0 h-0 ml-1"
											style={{
												borderLeft: "20px solid #FF2D78",
												borderTop: "12px solid transparent",
												borderBottom: "12px solid transparent",
											}}
										/>
									</div>
									{/* Play Trailer label */}
									<span
										className="font-mono-retro text-[10px] uppercase tracking-[3px] text-neon-pink whitespace-nowrap"
										style={{ textShadow: "0 0 12px rgba(255,45,120,0.6)" }}
									>
										Play Trailer
									</span>
								</button>
							)}
						</>
					)}

					{/* Film strip — top */}
					<div
						aria-hidden="true"
						className="absolute top-0 left-0 right-0 h-[14px] flex items-center z-10 overflow-hidden"
						style={{ background: "rgba(0,0,0,0.7)" }}
					>
						<div className="flex justify-between w-full px-1.5">
							{Array.from({ length: 35 }, (_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: static decorative elements
									key={i}
									aria-hidden="true"
									className="flex-shrink-0"
									style={{
										width: "10px",
										height: "7px",
										borderRadius: "1.5px",
										background: "rgba(255,255,240,0.08)",
									}}
								/>
							))}
						</div>
					</div>

					{/* Film strip — bottom */}
					<div
						aria-hidden="true"
						className="absolute bottom-0 left-0 right-0 h-[14px] flex items-center z-10 overflow-hidden"
						style={{ background: "rgba(0,0,0,0.7)" }}
					>
						<div className="flex justify-between w-full px-1.5">
							{Array.from({ length: 35 }, (_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: static decorative elements
									key={i}
									aria-hidden="true"
									className="flex-shrink-0"
									style={{
										width: "10px",
										height: "7px",
										borderRadius: "1.5px",
										background: "rgba(255,255,240,0.08)",
									}}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
