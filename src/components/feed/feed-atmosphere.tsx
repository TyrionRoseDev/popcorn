export function FeedAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* Amber ground glow */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "220px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(255,184,0,0.12) 0%, transparent 70%)",
				}}
			/>

			{/* Fog layer 1 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "140px",
					background:
						"radial-gradient(ellipse 120% 80% at 30% 100%, rgba(255,255,255,0.03) 0%, transparent 70%)",
					animationName: "fog-drift-1",
					animationDuration: "20s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
			{/* Fog layer 2 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "110px",
					background:
						"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.025) 0%, transparent 65%)",
					animationName: "fog-drift-2",
					animationDuration: "23s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>
			{/* Fog layer 3 */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "90px",
					background:
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.02) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>

			{/* Film strip left edge */}
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

			{/* Film strip right edge */}
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

			{/* Scattered light orbs */}
			<div
				className="fixed"
				style={{
					top: "20%",
					left: "8%",
					width: "80px",
					height: "80px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255,184,0,0.04), transparent 70%)",
				}}
			/>
			<div
				className="fixed"
				style={{
					top: "55%",
					right: "6%",
					width: "100px",
					height: "100px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(0,229,255,0.03), transparent 70%)",
				}}
			/>
			<div
				className="fixed"
				style={{
					bottom: "30%",
					left: "5%",
					width: "60px",
					height: "60px",
					borderRadius: "50%",
					background:
						"radial-gradient(circle, rgba(255,45,120,0.03), transparent 70%)",
				}}
			/>
		</div>
	);
}
