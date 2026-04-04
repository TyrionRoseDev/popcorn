export function WatchlistAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Pink ground glow */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236,72,153,0.15) 0%, transparent 70%)",
				}}
			/>

			{/* Low-lying fog layers */}
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
