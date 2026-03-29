interface Stamp {
	main: string;
	sub: string;
}

const YES_STAMPS: Stamp[] = [
	{ main: "YES!", sub: "TAKE 1" },
	{ main: "LET'S GO!", sub: "ACTION!" },
	{ main: "OH YEAH!", sub: "ROLLING" },
	{ main: "HECK YES!", sub: "SCENE 1" },
];

const NO_STAMPS: Stamp[] = [
	{ main: "NOPE", sub: "CUT!" },
	{ main: "SKIP", sub: "NEXT" },
	{ main: "NAH", sub: "WRAP" },
	{ main: "PASS", sub: "MOVING ON" },
];

export function getRandomStamp(type: "yes" | "no"): Stamp {
	const pool = type === "yes" ? YES_STAMPS : NO_STAMPS;
	return pool[Math.floor(Math.random() * pool.length)];
}

interface ClapperboardStampProps {
	type: "yes" | "no";
	opacity: number;
	stamp: Stamp;
}

export function ClapperboardStamp({
	type,
	opacity,
	stamp,
}: ClapperboardStampProps) {
	const isYes = type === "yes";

	return (
		<div
			className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
			style={{ opacity }}
		>
			<div
				className="relative w-44 select-none overflow-hidden rounded-sm"
				style={{
					transform: isYes ? "rotate(-12deg)" : "rotate(12deg)",
					boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
				}}
			>
				{/* Chevron stripe top (clapperboard clapper) */}
				<div
					className="flex h-7 items-center overflow-hidden"
					style={{ background: "#1a1a1a" }}
				>
					{Array.from({ length: 10 }, (_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: decorative elements
							key={i}
							className="h-full w-5 shrink-0"
							style={{
								background:
									i % 2 === 0
										? "repeating-linear-gradient(135deg, #fff 0px, #fff 5px, #1a1a1a 5px, #1a1a1a 10px)"
										: "#1a1a1a",
							}}
						/>
					))}
				</div>

				{/* Board body */}
				<div
					className="flex flex-col items-center py-2"
					style={{ background: "#111" }}
				>
					{/* Scene header */}
					<div className="mb-1 w-full px-3 text-center">
						<span
							className="font-mono-retro text-[9px] uppercase tracking-[3px]"
							style={{ color: "rgba(255,255,240,0.5)" }}
						>
							SCENE
						</span>
					</div>

					{/* Main stamp text */}
					<div
						className="px-3 text-center font-display text-3xl leading-none"
						style={{
							color: isYes ? "#4ade80" : "#f87171",
							textShadow: isYes
								? "0 0 12px rgba(74,222,128,0.6)"
								: "0 0 12px rgba(248,113,113,0.6)",
						}}
					>
						{stamp.main}
					</div>

					{/* Sub text footer */}
					<div className="mt-1.5 w-full border-t border-white/10 px-3 pt-1 text-center">
						<span
							className="font-mono-retro text-[9px] uppercase tracking-[4px]"
							style={{ color: "rgba(255,255,240,0.4)" }}
						>
							{stamp.sub}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
