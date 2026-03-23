const STARS = Array.from({ length: 70 }, (_, i) => ({
	id: i,
	top: `${Math.round((((i * 31 + 11) % 97) / 97) * 85)}%`,
	left: `${Math.round((((i * 53 + 7) % 97) / 97) * 100)}%`,
	size: 1 + ((i * 17) % 3) * 0.5,
	dur: `${2.5 + ((i * 23) % 20) / 10}s`,
	delay: `${-((i * 41) % 30) / 10}s`,
	o1: 0.1 + ((i * 13) % 10) / 100,
	o2: 0.6 + ((i * 19) % 35) / 100,
}));

export function TitlePageAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 z-0"
		>
			{/* Night sky gradient */}
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #050508 60%)",
				}}
			/>

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

			{/* Ground glow */}
			<div
				className="fixed bottom-0 left-0 right-0"
				style={{
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236, 72, 153, 0.15) 0%, transparent 70%)",
					zIndex: 1,
				}}
			/>
		</div>
	);
}
