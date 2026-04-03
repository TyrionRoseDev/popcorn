import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const BULBS = Array.from({ length: 20 }, (_, i) => ({
	id: `bulb-${i}`,
	even: i % 2 === 0,
}));

export function MarqueeBoard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children?: React.ReactNode;
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
				style={{
					rotateX,
					scale,
					opacity,
					transformOrigin: "center top",
				}}
			>
				{/* Marquee frame — fixed size matching all other marquees */}
				<div className="w-[700px] max-w-full h-[130px] mx-auto relative flex flex-col items-center justify-center px-10">
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
						{BULBS.map((bulb) => (
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
						{BULBS.map((bulb) => (
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

					{/* Title */}
					<h2 className="font-display text-4xl uppercase text-cream [text-shadow:0_0_30px_rgba(255,255,240,0.2),0_0_60px_rgba(255,255,240,0.05)] mb-1.5">
						{title}
					</h2>

					{/* Subtitle */}
					{subtitle && (
						<p className="font-mono-retro text-xs text-cream/45 tracking-[1px]">
							{subtitle}
						</p>
					)}
				</div>

				{/* Content rows — below the marquee frame */}
				{children && (
					<div className="w-[700px] max-w-full mx-auto mt-4 px-6">
						{children}
					</div>
				)}
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
