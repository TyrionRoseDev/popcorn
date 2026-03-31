// Seeded PRNG (mulberry32) for deterministic but scattered star positions
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const rand = mulberry32(42);

const STARS = Array.from({ length: 100 }, (_, i) => ({
	id: i,
	top: `${(rand() * 100).toFixed(1)}%`,
	left: `${(rand() * 100).toFixed(1)}%`,
	size: 1 + rand() * 1.5,
	dur: `${2.5 + rand() * 2}s`,
	delay: `${-(rand() * 3)}s`,
	o1: 0.1 + rand() * 0.1,
	o2: 0.6 + rand() * 0.35,
}));

export function RetroOverlays() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Night sky gradient */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #030305 60%)",
				}}
			/>

			{/* Starfield — 100 scattered stars */}
			{STARS.map((star) => (
				<div
					key={star.id}
					className="fixed rounded-full bg-white"
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
				className="fixed"
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
				className="fixed inset-0"
				style={{
					zIndex: 50,
					opacity: 0.4,
					background:
						"repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
				}}
			/>

			{/* VHS scan line */}
			<div
				className="fixed left-0 right-0"
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
