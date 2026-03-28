const STARS = Array.from({ length: 90 }, (_, i) => ({
	id: i,
	top: `${Math.round((((i * 31 + 11) % 97) / 97) * 85)}%`,
	left: `${Math.round((((i * 53 + 7) % 97) / 97) * 100)}%`,
	size: 1 + ((i * 17) % 3) * 0.5,
	dur: `${2.5 + ((i * 23) % 20) / 10}s`,
	delay: `${-((i * 41) % 30) / 10}s`,
	o1: 0.1 + ((i * 13) % 10) / 100,
	o2: 0.6 + ((i * 19) % 35) / 100,
}));

export function ShuffleAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Night sky gradient — deep cinematic dark */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #050508 60%)",
				}}
			/>

			{/* Starfield — richer with more stars */}
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

			{/* Vignette overlay — dark edges like the landing page */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)",
					zIndex: 1,
				}}
			/>

			{/* Projector cone — dramatic warm light from above, centered on the card */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					background:
						"radial-gradient(ellipse 50% 85% at 50% 10%, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.04) 30%, transparent 60%)",
				}}
			/>

			{/* Secondary projector haze — softer warm spread */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					background:
						"radial-gradient(ellipse 70% 70% at 50% 20%, rgba(255,220,140,0.06) 0%, transparent 55%)",
				}}
			/>

			{/* Inner projector hotspot — bright center where the card is */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					background:
						"radial-gradient(ellipse 30% 50% at 50% 40%, rgba(255,240,200,0.05) 0%, transparent 50%)",
				}}
			/>

			{/* Film grain overlay — slightly more visible */}
			<div
				className="fixed"
				style={{
					inset: "-50%",
					width: "200%",
					height: "200%",
					opacity: 0.05,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					animationName: "grain",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(3)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Scanlines for projector-screen feel */}
			<div
				className="fixed inset-0"
				style={{
					opacity: 0.15,
					background:
						"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)",
				}}
			/>

			{/* VHS scan line */}
			<div
				className="fixed left-0 right-0"
				style={{
					height: "2px",
					zIndex: 2,
					background:
						"linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
					animationName: "vhs-scan",
					animationDuration: "8s",
					animationTimingFunction: "linear",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Warm amber ground glow — strong, like drive-in screen reflecting off the ground */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "300px",
					background:
						"radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,184,0,0.15) 0%, rgba(255,184,0,0.06) 40%, transparent 70%)",
				}}
			/>

			{/* Secondary amber ground reflection — wider spread */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(255,160,0,0.08) 0%, transparent 65%)",
				}}
			/>

			{/* Subtle pink accent glow on the ground */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "180px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.08) 0%, transparent 65%)",
				}}
			/>

			{/* Low-lying fog layers — richer with three layers */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "120px",
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
					height: "100px",
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
					height: "80px",
					background:
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
		</div>
	);
}
