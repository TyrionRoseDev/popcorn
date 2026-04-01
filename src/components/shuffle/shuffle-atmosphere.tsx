const DUST_PARTICLES = Array.from({ length: 18 }, (_, i) => ({
	id: i,
	left: `${42 + ((i * 7) % 16)}%`,
	size: 1 + ((i * 13) % 3) * 0.5,
	dur: `${4 + ((i * 11) % 6)}s`,
	delay: `${-((i * 17) % 8)}s`,
}));

export function ShuffleAtmosphere() {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-0"
			style={{ zIndex: 0 }}
		>
			{/* ===== PROJECTOR BEAM — single cone with stacked radial gradients ===== */}
			<div
				className="fixed"
				style={{
					top: "-10%",
					left: "-10%",
					right: "-10%",
					height: "120%",
					clipPath: "polygon(42% 8%, 58% 8%, 72% 100%, 28% 100%)",
					background: [
						"radial-gradient(ellipse 18% 80% at 50% 8%, rgba(255,245,210,0.1) 0%, transparent 100%)",
						"radial-gradient(ellipse 30% 90% at 50% 8%, rgba(255,235,180,0.07) 0%, transparent 100%)",
						"radial-gradient(ellipse 45% 100% at 50% 8%, rgba(255,220,140,0.04) 0%, transparent 100%)",
					].join(", "),
					filter: "blur(20px)",
					animationName: "projector-flicker",
					animationDuration: "4s",
					animationTimingFunction: "steps(1)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Projector dust particles floating in the beam */}
			{DUST_PARTICLES.map((p) => (
				<div
					key={p.id}
					className="fixed rounded-full bg-white/60"
					style={{
						left: p.left,
						top: "5%",
						width: `${p.size}px`,
						height: `${p.size}px`,
						animationName: "dust-float",
						animationDuration: p.dur,
						animationTimingFunction: "linear",
						animationIterationCount: "infinite",
						animationDelay: p.delay,
					}}
				/>
			))}

			{/* Projector source glow — small bright spot at top center */}
			<div
				className="fixed left-1/2 top-0 -translate-x-1/2"
				style={{
					width: "80px",
					height: "40px",
					background:
						"radial-gradient(ellipse at 50% 0%, rgba(255,220,140,0.5) 0%, rgba(255,184,0,0.15) 50%, transparent 100%)",
					filter: "blur(8px)",
				}}
			/>

			{/* Vignette overlay — strong dark edges like looking through a windshield */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse 75% 65% at 50% 45%, transparent 30%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 100%)",
					zIndex: 1,
				}}
			/>

			{/* Warm amber ground glow — screen reflecting off the ground */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "300px",
					background:
						"radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.04) 40%, transparent 70%)",
				}}
			/>

			{/* Low-lying fog — denser, atmospheric ground mist */}
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "140px",
					background:
						"radial-gradient(ellipse 130% 90% at 30% 100%, rgba(255,255,255,0.04) 0%, transparent 70%)",
					animationName: "fog-crawl",
					animationDuration: "18s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				}}
			/>
			<div
				className="fixed inset-x-0 bottom-0"
				style={{
					height: "100px",
					background:
						"radial-gradient(ellipse 100% 70% at 70% 100%, rgba(255,255,255,0.03) 0%, transparent 65%)",
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
						"radial-gradient(ellipse 90% 60% at 50% 100%, rgba(255,255,255,0.025) 0%, transparent 60%)",
					animationName: "fog-drift-3",
					animationDuration: "25s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
				}}
			/>

			{/* ===== CAR DASHBOARD SILHOUETTE ===== */}
			{/* Dashboard curve at bottom */}
			<div
				className="fixed inset-x-0 bottom-0 hidden md:block"
				style={{
					height: "80px",
					zIndex: 3,
					background:
						"linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.07) 100%)",
					borderTop: "1px solid rgba(30,30,50,0.08)",
					borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
				}}
			/>
			{/* Steering wheel silhouette — subtle arc at bottom center */}
			<div
				className="fixed bottom-0 left-1/2 hidden md:block"
				style={{
					width: "140px",
					height: "60px",
					transform: "translateX(-50%)",
					zIndex: 4,
					border: "2px solid rgba(30,30,50,0.06)",
					borderBottom: "none",
					borderRadius: "70px 70px 0 0",
					opacity: 0.6,
				}}
			/>

			{/* ===== SPEAKER BOX — bottom-right corner ===== */}
			<div
				className="fixed hidden md:flex"
				style={{
					bottom: "90px",
					right: "24px",
					width: "36px",
					height: "52px",
					zIndex: 4,
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{/* Speaker wire */}
				<div
					style={{
						width: "2px",
						height: "16px",
						background: "rgba(40,40,60,0.15)",
						borderRadius: "1px",
					}}
				/>
				{/* Speaker body */}
				<div
					style={{
						width: "32px",
						height: "36px",
						background: "rgba(15,15,25,0.08)",
						border: "1px solid rgba(40,40,60,0.1)",
						borderRadius: "4px",
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gridTemplateRows: "repeat(4, 1fr)",
						gap: "2px",
						padding: "4px",
					}}
				>
					{/* Grill dots */}
					{Array.from({ length: 12 }, (_, i) => (
						<div
							key={`grill-${i.toString()}`}
							style={{
								width: "4px",
								height: "4px",
								borderRadius: "50%",
								background: "rgba(40,40,60,0.1)",
								justifySelf: "center",
								alignSelf: "center",
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
