const STARS = Array.from({ length: 70 }, (_, i) => ({
	id: i,
	top: `${Math.round((((i * 31 + 11) % 97) / 97) * 80)}%`,
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
			{/* Night sky gradient — darker, more cinematic than watchlist */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #08081c 0%, #050508 60%)",
				}}
			/>

			{/* Starfield */}
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

			{/* Projector spotlight — warm cone of light from above */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					background:
						"radial-gradient(ellipse 60% 80% at 50% 15%, rgba(255,184,0,0.06) 0%, transparent 60%)",
				}}
			/>

			{/* Secondary projector haze — softer, wider spread */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					background:
						"radial-gradient(ellipse 80% 70% at 50% 25%, rgba(255,220,140,0.03) 0%, transparent 55%)",
				}}
			/>

			{/* Film grain overlay */}
			<div
				className="fixed"
				style={{
					inset: "-50%",
					width: "200%",
					height: "200%",
					opacity: 0.04,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					animationName: "grain",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(3)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Faint scanlines for that projector-screen feel */}
			<div
				className="fixed inset-0"
				style={{
					opacity: 0.15,
					background:
						"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 6px)",
				}}
			/>

			{/* Warm amber ground glow — like the glow of a drive-in screen */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "250px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(255,184,0,0.08) 0%, transparent 70%)",
				}}
			/>

			{/* Subtle pink accent glow on the ground */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "180px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.06) 0%, transparent 65%)",
				}}
			/>

			{/* Low-lying fog layers */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "100px",
					background:
						"radial-gradient(ellipse 120% 80% at 30% 100%, rgba(255,255,255,0.025) 0%, transparent 70%)",
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
					height: "80px",
					background:
						"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.02) 0%, transparent 65%)",
					animationName: "fog-drift-2",
					animationDuration: "23s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
		</div>
	);
}
