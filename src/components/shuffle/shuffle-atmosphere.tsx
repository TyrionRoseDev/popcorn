const STARS = Array.from({ length: 120 }, (_, i) => ({
	id: i,
	top: `${Math.round((((i * 31 + 11) % 97) / 97) * 80)}%`,
	left: `${Math.round((((i * 53 + 7) % 97) / 97) * 100)}%`,
	size: 1 + ((i * 17) % 3) * 0.5,
	dur: `${2.5 + ((i * 23) % 20) / 10}s`,
	delay: `${-((i * 41) % 30) / 10}s`,
	o1: 0.1 + ((i * 13) % 10) / 100,
	o2: 0.6 + ((i * 19) % 35) / 100,
}));

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
			{/* Night sky gradient — deep cinematic dark */}
			<div
				className="fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse at 50% 0%, #0a0a20 0%, #030305 60%)",
				}}
			/>

			{/* Starfield — richer with 120 stars */}
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

			{/* ===== PROJECTOR BEAM — cone of light from top to card ===== */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					clipPath: "polygon(44% 0%, 56% 0%, 68% 100%, 32% 100%)",
					background:
						"linear-gradient(180deg, rgba(255,220,140,0.18) 0%, rgba(255,184,0,0.06) 40%, rgba(255,184,0,0.02) 100%)",
					animationName: "projector-flicker",
					animationDuration: "4s",
					animationTimingFunction: "steps(1)",
					animationIterationCount: "infinite",
				}}
			/>
			{/* Projector beam inner hotspot */}
			<div
				className="fixed inset-x-0 top-0"
				style={{
					height: "100%",
					clipPath: "polygon(46% 0%, 54% 0%, 62% 100%, 38% 100%)",
					background:
						"linear-gradient(180deg, rgba(255,240,200,0.12) 0%, rgba(255,240,200,0.03) 50%, transparent 100%)",
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

			{/* ===== SWAYING SPOTLIGHTS — adapted from landing page ===== */}
			{/* Left spotlight */}
			<div
				className="fixed hidden md:block"
				style={{
					width: "35vw",
					height: "100%",
					bottom: "0%",
					left: "0%",
					background:
						"linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)",
					transformOrigin: "0% 0%",
					animationName: "sway-left",
					animationDuration: "6s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
					opacity: 0.5,
				}}
			/>
			{/* Right spotlight */}
			<div
				className="fixed hidden md:block"
				style={{
					width: "35vw",
					height: "100%",
					bottom: "0%",
					right: "0%",
					background:
						"linear-gradient(225deg, rgba(255,255,255,0.03) 0%, transparent 60%)",
					transformOrigin: "100% 0%",
					animationName: "sway-right",
					animationDuration: "5.5s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
					animationDirection: "alternate",
					animationDelay: "-3s",
					opacity: 0.5,
				}}
			/>

			{/* ===== DRIVE-IN SCREEN FRAME — structural posts ===== */}
			{/* Left post */}
			<div
				className="fixed hidden sm:block"
				style={{
					left: "calc(50% - 220px)",
					top: "15%",
					bottom: "35%",
					width: "3px",
					background:
						"linear-gradient(180deg, rgba(40,40,60,0.6) 0%, rgba(40,40,60,0.2) 100%)",
					borderRadius: "2px",
				}}
			/>
			{/* Right post */}
			<div
				className="fixed hidden sm:block"
				style={{
					right: "calc(50% - 220px)",
					top: "15%",
					bottom: "35%",
					width: "3px",
					background:
						"linear-gradient(180deg, rgba(40,40,60,0.6) 0%, rgba(40,40,60,0.2) 100%)",
					borderRadius: "2px",
				}}
			/>
			{/* Top crossbar */}
			<div
				className="fixed hidden sm:block"
				style={{
					left: "calc(50% - 220px)",
					right: "calc(50% - 220px)",
					top: "15%",
					height: "2px",
					background:
						"linear-gradient(90deg, rgba(40,40,60,0.4) 0%, rgba(40,40,60,0.6) 50%, rgba(40,40,60,0.4) 100%)",
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

			{/* Film grain overlay */}
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
					opacity: 0.12,
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
