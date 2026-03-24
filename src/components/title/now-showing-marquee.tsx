interface NowShowingMarqueeProps {
	title: string;
	year: string;
	runtime: string;
	contentRating: string;
}

export function NowShowingMarquee({
	title,
	year,
	runtime,
	contentRating,
}: NowShowingMarqueeProps) {
	const bulbs = Array.from({ length: 20 }, (_, i) => ({
		id: `bulb-${i}`,
		even: i % 2 === 0,
	}));

	const metaParts = [year, runtime];
	if (contentRating !== "NR") {
		metaParts.push(contentRating);
	}

	return (
		<div className="max-w-[700px] mx-auto mt-[50px] text-center relative px-10 py-5">
			{/* Amber border */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					border: "2px solid rgba(255,184,0,0.3)",
					borderRadius: "8px",
					boxShadow: "0 0 20px rgba(255,184,0,0.08)",
					pointerEvents: "none",
				}}
			/>

			{/* Top chasing bulbs */}
			<div
				aria-hidden="true"
				className="flex gap-3 justify-center"
				style={{
					position: "absolute",
					top: "-4px",
					left: "20px",
					right: "20px",
				}}
			>
				{bulbs.map((bulb) => (
					<div
						key={bulb.id}
						className="bg-neon-amber rounded-full"
						style={{
							width: "6px",
							height: "6px",
							flexShrink: 0,
							animation: bulb.even
								? "chase 1.2s infinite"
								: "chase 1.2s infinite 0.6s",
						}}
					/>
				))}
			</div>

			{/* Bottom chasing bulbs */}
			<div
				aria-hidden="true"
				className="flex gap-3 justify-center"
				style={{
					position: "absolute",
					bottom: "-4px",
					left: "20px",
					right: "20px",
				}}
			>
				{bulbs.map((bulb) => (
					<div
						key={bulb.id}
						className="bg-neon-amber rounded-full"
						style={{
							width: "6px",
							height: "6px",
							flexShrink: 0,
							animation: bulb.even
								? "chase 1.2s infinite"
								: "chase 1.2s infinite 0.6s",
						}}
					/>
				))}
			</div>

			{/* NOW SHOWING label */}
			<p className="font-mono-retro text-[10px] tracking-[4px] uppercase text-neon-amber opacity-70 mb-2">
				NOW SHOWING
			</p>

			{/* Title */}
			<h1 className="font-display text-4xl text-cream [text-shadow:0_0_30px_rgba(255,255,240,0.2),0_0_60px_rgba(255,255,240,0.05)] mb-1.5">
				{title}
			</h1>

			{/* Meta line */}
			<p className="font-mono-retro text-xs text-cream/45 tracking-[1px]">
				{metaParts.join(" · ")}
			</p>
		</div>
	);
}
