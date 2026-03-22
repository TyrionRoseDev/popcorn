const STARS = Array.from({ length: 30 }, (_, i) => ({
	id: i,
	top: `${Math.round((((i * 37 + 13) % 97) / 97) * 100)}%`,
	left: `${Math.round((((i * 53 + 7) % 97) / 97) * 100)}%`,
	size: 1 + ((i * 17) % 3) * 0.5,
	dur: `${2.5 + ((i * 23) % 20) / 10}s`,
	delay: `${-((i * 41) % 30) / 10}s`,
	o1: 0.1 + ((i * 13) % 10) / 100,
	o2: 0.6 + ((i * 19) % 35) / 100,
}));

export function RetroOverlays() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Starfield */}
			{STARS.map((star) => (
				<div
					key={star.id}
					className="absolute rounded-full bg-white"
					style={
						{
							top: star.top,
							left: star.left,
							width: `${star.size}px`,
							height: `${star.size}px`,
							animationName: "twinkle",
							animationDuration: star.dur,
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDelay: star.delay,
							"--o1": star.o1,
							"--o2": star.o2,
						} as React.CSSProperties
					}
				/>
			))}

			{/* Film grain */}
			<div
				className="absolute"
				style={{
					inset: "-50%",
					width: "200%",
					height: "200%",
					opacity: 0.05,
					zIndex: 49,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					animationName: "grain",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(3)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Scanlines */}
			<div
				className="absolute inset-0"
				style={{
					zIndex: 50,
					opacity: 0.4,
					background:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
				}}
			/>

			{/* VHS scan line */}
			<div
				className="absolute left-0 right-0"
				style={{
					height: "2px",
					zIndex: 51,
					background:
						"linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
					animationName: "vhs-scan",
					animationDuration: "8s",
					animationTimingFunction: "linear",
					animationIterationCount: "infinite",
				}}
			/>
		</div>
	);
}
