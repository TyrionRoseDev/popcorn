const BULBS = Array.from({ length: 20 }, (_, i) => ({
	id: `bulb-${i}`,
	leftPercent: `${(i / 19) * 100}%`,
	delay: i % 2 === 0 ? "0s" : "0.6s",
}));

function ChasingBulbs({ position }: { position: "top" | "bottom" }) {
	const posStyle = position === "top" ? { top: "-4px" } : { bottom: "-4px" };

	return (
		<>
			{BULBS.map((bulb) => (
				<div
					key={bulb.id}
					className="absolute rounded-full"
					style={{
						...posStyle,
						left: bulb.leftPercent,
						width: "6px",
						height: "6px",
						backgroundColor: "#FFB800",
						transform: "translateX(-50%)",
						animationName: "bulb-chase",
						animationDuration: "1.2s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
						animationDelay: bulb.delay,
					}}
				/>
			))}
		</>
	);
}

export function NowShowingHeader({ title }: { title: string }) {
	return (
		<div className="flex justify-center">
			<div
				className="relative text-center"
				style={{ maxWidth: "700px", padding: "20px 40px" }}
			>
				{/* Amber border */}
				<div
					className="absolute"
					style={{
						inset: 0,
						border: "2px solid rgba(255,184,0,0.3)",
						borderRadius: "8px",
						boxShadow: "0 0 20px rgba(255,184,0,0.08)",
						pointerEvents: "none",
					}}
				/>

				{/* Chasing bulbs */}
				<ChasingBulbs position="top" />
				<ChasingBulbs position="bottom" />

				{/* NOW SHOWING label */}
				<p
					className="font-mono-retro mb-2"
					style={{
						fontSize: "10px",
						letterSpacing: "4px",
						textTransform: "uppercase",
						color: "#FFB800",
						opacity: 0.7,
						margin: 0,
						marginBottom: "8px",
					}}
				>
					Now Showing
				</p>

				{/* Title */}
				<h1
					className="font-display"
					style={{
						fontSize: "36px",
						color: "#fffff0",
						margin: 0,
						textShadow:
							"0 0 30px rgba(255,255,240,0.2), 0 0 60px rgba(255,255,240,0.05)",
					}}
				>
					{title}
				</h1>
			</div>
		</div>
	);
}
