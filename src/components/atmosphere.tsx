interface LightOrb {
	position: { top?: string; bottom?: string; left?: string; right?: string };
	size: string;
	color: string;
}

interface AtmosphereProps {
	/** Ground glow radial gradient color, e.g. "rgba(255,184,0,0.12)" */
	glowColor: string;
	/** Height of the ground glow (default "220px") */
	glowHeight?: string;
	/** Whether to render fog layers (default true) */
	fog?: boolean;
	/** Heights of the 3 fog layers (default ["140px","110px","90px"]) */
	fogHeights?: [string, string, string];
	/** Whether to render film strip edges (default false) */
	filmStrips?: boolean;
	/** Optional scattered light orbs */
	orbs?: LightOrb[];
}

export function Atmosphere({
	glowColor,
	glowHeight = "220px",
	fog = true,
	fogHeights = ["140px", "110px", "90px"],
	filmStrips = false,
	orbs,
}: AtmosphereProps) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Ground glow */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: glowHeight,
					background: `radial-gradient(ellipse at 50% 100%, ${glowColor} 0%, transparent 70%)`,
				}}
			/>

			{/* Fog layers */}
			{fog !== false && (
				<>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[0],
							background:
								"radial-gradient(ellipse 120% 80% at 30% 100%, rgba(255,255,255,0.03) 0%, transparent 70%)",
							animationName: "fog-drift-1",
							animationDuration: "20s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[1],
							background:
								"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.025) 0%, transparent 65%)",
							animationName: "fog-drift-2",
							animationDuration: "23s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
					<div
						className="fixed inset-x-0 bottom-0"
						style={{
							height: fogHeights[2],
							background:
								"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
							animationName: "fog-drift-3",
							animationDuration: "25s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDirection: "alternate",
						}}
					/>
				</>
			)}

			{/* Film strip edges */}
			{filmStrips && (
				<>
					<div
						className="fixed left-0 top-0 bottom-0"
						style={{
							width: "22px",
							opacity: 0.06,
						}}
					>
						<div
							style={{
								width: "100%",
								height: "100%",
								background:
									"repeating-linear-gradient(180deg, transparent 0px, transparent 8px, rgba(255,255,240,0.5) 8px, rgba(255,255,240,0.5) 10px, transparent 10px, transparent 24px)",
								borderRight: "2px solid rgba(255,255,240,0.4)",
							}}
						/>
					</div>
					<div
						className="fixed right-0 top-0 bottom-0"
						style={{
							width: "22px",
							opacity: 0.06,
						}}
					>
						<div
							style={{
								width: "100%",
								height: "100%",
								background:
									"repeating-linear-gradient(180deg, transparent 0px, transparent 8px, rgba(255,255,240,0.5) 8px, rgba(255,255,240,0.5) 10px, transparent 10px, transparent 24px)",
								borderLeft: "2px solid rgba(255,255,240,0.4)",
							}}
						/>
					</div>
				</>
			)}

			{/* Light orbs */}
			{orbs?.map((orb) => (
				<div
					key={`${orb.color}-${orb.size}-${JSON.stringify(orb.position)}`}
					className="fixed"
					style={{
						...orb.position,
						width: orb.size,
						height: orb.size,
						borderRadius: "50%",
						background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
					}}
				/>
			))}
		</div>
	);
}
