import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const BULB_COUNT = 16;
const BULBS = Array.from({ length: BULB_COUNT }, (_, i) => i);

export function MarqueeBoard({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start end", "start 0.35"],
	});

	const rotateX = useTransform(scrollYProgress, [0, 1], [12, 0]);
	const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);
	const opacity = useTransform(scrollYProgress, [0, 0.4], [0, 1]);

	return (
		<div ref={ref} style={{ perspective: "800px" }}>
			<motion.div
				className="relative z-10 overflow-hidden rounded border-[2.5px] border-drive-in-border bg-drive-in-card/85 backdrop-blur-sm"
				style={{
					rotateX,
					scale,
					opacity,
					transformOrigin: "center top",
					boxShadow: "0 -10px 40px rgba(0,0,0,0.4)",
				}}
			>
				<BulbRow />
				<div className="px-6 py-7 text-center">
					<h2
						className="mb-5 font-display text-[22px] text-neon-pink"
						style={{
							textShadow: "0 0 10px rgba(255,45,120,0.3)",
						}}
					>
						{title}
					</h2>
					{children}
				</div>
				<BulbRow />
			</motion.div>
		</div>
	);
}

export function MarqueeBoardRow({
	label,
	status,
	index = 0,
}: {
	label: string;
	status: string;
	index?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start 0.95", "start 0.55"],
	});

	// Each row staggers slightly based on index
	const start = Math.min(index * 0.08, 0.3);
	const opacity = useTransform(scrollYProgress, [start, start + 0.4], [0, 1]);
	const x = useTransform(scrollYProgress, [start, start + 0.5], [-20, 0]);
	const statusOpacity = useTransform(
		scrollYProgress,
		[start + 0.2, start + 0.6],
		[0, 1],
	);

	return (
		<motion.div
			ref={ref}
			className="flex items-center justify-between border-b border-white/[0.04] py-2.5 font-mono-retro text-xs tracking-wide text-cream/50 last:border-b-0"
			style={{ opacity, x }}
		>
			<span>{label}</span>
			<motion.span
				className="text-[10px] uppercase tracking-[2px] text-neon-cyan"
				style={{
					textShadow: "0 0 6px rgba(0,229,255,0.2)",
					opacity: statusOpacity,
				}}
			>
				{status}
			</motion.span>
		</motion.div>
	);
}

function BulbRow() {
	return (
		<div className="flex justify-around border-b-2 border-drive-in-border bg-[rgba(17,17,17,0.9)] px-3 py-2 last:border-b-0 last:border-t-2">
			{BULBS.map((i) => (
				<div
					key={i}
					className="h-[7px] w-[7px] rounded-full bg-neon-amber"
					style={{
						boxShadow: "0 0 6px rgba(255,184,0,0.5)",
						animationName: "bulb-chase",
						animationDuration: "2s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
						animationDelay: i % 2 === 0 ? "0s" : "0.5s",
					}}
				/>
			))}
		</div>
	);
}
