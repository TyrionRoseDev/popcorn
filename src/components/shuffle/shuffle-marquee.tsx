const BULB_COUNT = 15;

const TOP_BULBS = Array.from({ length: BULB_COUNT }, (_, i) => ({
	id: `top-${i}`,
	even: i % 2 === 0,
}));

const BOTTOM_BULBS = Array.from({ length: BULB_COUNT }, (_, i) => ({
	id: `bot-${i}`,
	even: i % 2 === 0,
}));

const SIDE_BULB_COUNT = 5;
const SIDE_BULBS = Array.from({ length: SIDE_BULB_COUNT }, (_, i) => ({
	id: `side-${i}`,
	even: i % 2 === 0,
}));

export function ShuffleMarquee() {
	return (
		<div className="relative w-full max-w-[340px]">
			<div
				className="relative rounded-xl border-[3px] border-neon-amber/40 px-5 py-3 text-center"
				style={{
					background: "rgba(8,8,24,0.92)",
					boxShadow:
						"0 0 30px rgba(255,184,0,0.1), 0 0 60px rgba(255,184,0,0.05), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)",
				}}
			>
				{/* Top bulbs */}
				<div
					aria-hidden="true"
					className="absolute left-2 right-2 top-[-4px] flex justify-between"
				>
					{TOP_BULBS.map((b) => (
						<Bulb key={b.id} even={b.even} />
					))}
				</div>

				{/* Bottom bulbs */}
				<div
					aria-hidden="true"
					className="absolute bottom-[-4px] left-2 right-2 flex justify-between"
				>
					{BOTTOM_BULBS.map((b) => (
						<Bulb key={b.id} even={!b.even} />
					))}
				</div>

				{/* Left bulbs */}
				<div
					aria-hidden="true"
					className="absolute bottom-2 left-[-4px] top-2 flex flex-col justify-between"
				>
					{SIDE_BULBS.map((b) => (
						<Bulb key={b.id} even={b.even} />
					))}
				</div>

				{/* Right bulbs */}
				<div
					aria-hidden="true"
					className="absolute bottom-2 right-[-4px] top-2 flex flex-col justify-between"
				>
					{SIDE_BULBS.map((b) => (
						<Bulb key={b.id} even={!b.even} />
					))}
				</div>

				{/* Content */}
				<p className="font-mono-retro text-[10px] tracking-[6px] text-neon-amber/40">
					✦ ✦ ✦
				</p>
				<p className="mt-0.5 font-mono-retro text-[8px] uppercase tracking-[4px] text-neon-amber/50">
					Now Shuffling
				</p>
				<h1
					className="font-display text-xl font-bold uppercase tracking-[4px] text-neon-amber/95"
					style={{
						textShadow:
							"0 0 10px rgba(255,184,0,0.6), 0 0 30px rgba(255,184,0,0.3), 0 0 60px rgba(255,184,0,0.15)",
						animationName: "neon-flicker",
						animationDuration: "4s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					}}
				>
					Showtime
					<br />
					Shuffle
				</h1>
				<div
					className="mx-auto mt-1.5 mb-1"
					style={{
						width: "60%",
						height: "1px",
						background:
							"linear-gradient(90deg, transparent, rgba(255,184,0,0.3), transparent)",
					}}
				/>
				<p className="font-mono-retro text-[10px] tracking-[6px] text-neon-amber/40">
					✦ ✦ ✦
				</p>
			</div>
		</div>
	);
}

function Bulb({ even }: { even: boolean }) {
	return (
		<div
			className="size-1.5 rounded-full bg-neon-amber"
			style={{
				boxShadow: "0 0 6px rgba(255,184,0,0.6), 0 0 12px rgba(255,184,0,0.3)",
				animationName: "bulb-chase",
				animationDuration: "1.2s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
				animationDelay: even ? "0s" : "0.6s",
			}}
		/>
	);
}
