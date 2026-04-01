export function CountdownLoader() {
	return (
		<div
			className="relative size-full overflow-hidden rounded-2xl"
			style={{
				background: "#1a1810",
				boxShadow:
					"0 0 40px rgba(255,240,200,0.08), 0 10px 50px rgba(0,0,0,0.7)",
			}}
		>
			{/* Film grain */}
			<div
				className="absolute -inset-1/2 size-[200%]"
				style={{
					opacity: 0.15,
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					animationName: "grain",
					animationDuration: "0.2s",
					animationTimingFunction: "steps(2)",
					animationIterationCount: "infinite",
				}}
			/>

			{/* Vignette */}
			<div
				className="absolute inset-0 rounded-2xl"
				style={{
					background:
						"radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)",
					pointerEvents: "none",
					zIndex: 2,
				}}
			/>

			{/* Corner frame marks */}
			<FrameMark position="tl" />
			<FrameMark position="tr" />
			<FrameMark position="bl" />
			<FrameMark position="br" />

			{/* Film scratches */}
			<div
				className="absolute"
				style={{
					left: "28%",
					top: "5%",
					height: "90%",
					width: "1px",
					background: "rgba(255,240,200,0.08)",
					animationName: "scratch-flicker",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(1)",
					animationIterationCount: "infinite",
				}}
			/>
			<div
				className="absolute"
				style={{
					left: "74%",
					top: "8%",
					height: "84%",
					width: "1px",
					background: "rgba(255,240,200,0.08)",
					animationName: "scratch-flicker",
					animationDuration: "0.3s",
					animationTimingFunction: "steps(1)",
					animationIterationCount: "infinite",
					animationDelay: "0.15s",
				}}
			/>

			{/* Countdown circle */}
			<div
				aria-hidden="true"
				className="absolute inset-0 z-10 flex items-center justify-center"
			>
				<div className="relative size-[150px]">
					{/* Ring */}
					<div className="absolute inset-0 rounded-full border-2 border-[rgba(255,240,200,0.3)]" />

					{/* Crosshairs */}
					<div
						className="absolute top-1/2 right-0 left-0"
						style={{
							height: "1px",
							background: "rgba(255,240,200,0.2)",
						}}
					/>
					<div
						className="absolute top-0 bottom-0 left-1/2"
						style={{
							width: "1px",
							background: "rgba(255,240,200,0.2)",
						}}
					/>

					{/* Sweep hand */}
					<div
						className="absolute top-1/2 left-1/2"
						style={{
							width: "2px",
							height: "70px",
							background:
								"linear-gradient(180deg, rgba(255,240,200,0.5) 0%, transparent 100%)",
							transformOrigin: "top center",
							animationName: "sweep-hand",
							animationDuration: "1s",
							animationTimingFunction: "linear",
							animationIterationCount: "infinite",
						}}
					/>

					{/* Number */}
					<div
						className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-7xl font-bold"
						style={{
							color: "rgba(255,240,200,0.85)",
							textShadow: "0 0 20px rgba(255,240,200,0.3)",
						}}
					>
						3
					</div>
				</div>
			</div>

			{/* Loading text */}
			<output
				aria-live="polite"
				className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap font-mono-retro text-[9px] uppercase tracking-[3px] text-neon-amber/50"
				style={{
					animationName: "pulse-text",
					animationDuration: "2s",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				}}
			>
				Setting up Showtime Shuffle...
			</output>
		</div>
	);
}

function FrameMark({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
	const styles: React.CSSProperties = {
		position: "absolute",
		width: "18px",
		height: "18px",
		border: "1px solid rgba(255,240,200,0.15)",
	};

	if (position === "tl") {
		Object.assign(styles, {
			top: "14px",
			left: "14px",
			borderRight: "none",
			borderBottom: "none",
		});
	} else if (position === "tr") {
		Object.assign(styles, {
			top: "14px",
			right: "14px",
			borderLeft: "none",
			borderBottom: "none",
		});
	} else if (position === "bl") {
		Object.assign(styles, {
			bottom: "14px",
			left: "14px",
			borderRight: "none",
			borderTop: "none",
		});
	} else {
		Object.assign(styles, {
			bottom: "14px",
			right: "14px",
			borderLeft: "none",
			borderTop: "none",
		});
	}

	return <div style={styles} />;
}
