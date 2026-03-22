import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export function TicketStub() {
	const containerRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ["start end", "center center"],
	});

	const rotateX = useTransform(scrollYProgress, [0, 1], [35, 0]);
	const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);
	const y = useTransform(scrollYProgress, [0, 1], [60, 0]);
	const glowOpacity = useTransform(scrollYProgress, [0.3, 1], [0, 1]);

	return (
		<div
			ref={containerRef}
			aria-hidden="true"
			className="relative mx-auto max-w-md px-4"
			style={{ perspective: "800px" }}
		>
			{/* Ambient glow behind ticket — intensifies on scroll */}
			<motion.div
				className="pointer-events-none absolute inset-0 -inset-x-8 -inset-y-4"
				style={{
					opacity: glowOpacity,
					background:
						"radial-gradient(ellipse at center, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.04) 40%, transparent 70%)",
					filter: "blur(20px)",
				}}
			/>

			<motion.div
				className="group relative"
				style={{
					rotateX,
					scale,
					y,
					transformOrigin: "center bottom",
					background:
						"linear-gradient(165deg, #d4a84a 0%, #c49a3e 40%, #b88e35 70%, #a9802e 100%)",
					borderRadius: "6px",
					boxShadow:
						"0 2px 8px rgba(0,0,0,0.35), 0 8px 40px rgba(0,0,0,0.6), 0 0 50px rgba(255,184,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15)",
				}}
			>
				{/* Left notch */}
				<div
					className="absolute left-0 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						background: "#070714",
						boxShadow: "inset 2px 0 6px rgba(0,0,0,0.3)",
					}}
				/>
				{/* Right notch */}
				<div
					className="absolute right-0 top-1/2 h-7 w-7 translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						background: "#070714",
						boxShadow: "inset -2px 0 6px rgba(0,0,0,0.3)",
					}}
				/>

				<div className="flex items-stretch">
					{/* Left stub */}
					<div className="relative flex w-12 shrink-0 items-center justify-center">
						<div className="absolute bottom-3 right-0 top-3 w-px border-r border-dashed border-[#ddc9a0]/20" />
						<span className="rotate-180 font-mono-retro text-[7px] uppercase tracking-[3px] text-[#5a3d1a]/50 [writing-mode:vertical-lr]">
							Admit One
						</span>
					</div>

					{/* Center content */}
					<div className="flex-1 py-7 text-center">
						<p className="font-mono-retro text-[7px] uppercase tracking-[4px] text-[#5a3d1a]/70">
							✦ Popcorn Drive-In ✦
						</p>

						{/* Decorative divider */}
						<div className="mx-auto my-3 flex max-w-[180px] items-center gap-3">
							<div className="h-px flex-1 bg-[#5a3d1a]/20" />
							<span className="font-mono-retro text-[8px] text-[#5a3d1a]/40">
								♦
							</span>
							<div className="h-px flex-1 bg-[#5a3d1a]/20" />
						</div>

						<p
							className="font-display text-xl text-[#2a1a05]"
							style={{
								textShadow: "1px 1px 0 rgba(255,255,255,0.12)",
							}}
						>
							Admit One
						</p>

						{/* Decorative divider */}
						<div className="mx-auto my-3 flex max-w-[180px] items-center gap-3">
							<div className="h-px flex-1 bg-[#5a3d1a]/20" />
							<span className="font-mono-retro text-[8px] text-[#5a3d1a]/40">
								✦
							</span>
							<div className="h-px flex-1 bg-[#5a3d1a]/20" />
						</div>

						<p className="font-mono-retro text-[7px] tracking-[2px] text-[#5a3d1a]/60">
							SCREEN 01 · No. 000001
						</p>
					</div>

					{/* Right stub */}
					<div className="relative flex w-12 shrink-0 items-center justify-center">
						<div className="absolute bottom-3 left-0 top-3 w-px border-l border-dashed border-[#ddc9a0]/20" />
						<span className="font-mono-retro text-[7px] uppercase tracking-[3px] text-[#5a3d1a]/50 [writing-mode:vertical-lr]">
							Admit One
						</span>
					</div>
				</div>

				{/* Paper texture overlay */}
				<div
					className="pointer-events-none absolute inset-0 rounded-[6px] opacity-[0.03]"
					style={{
						backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					}}
				/>

				{/* Hover glow overlay (CSS-only via group-hover) */}
				<div
					className="pointer-events-none absolute -inset-1 rounded-lg opacity-0 transition-opacity duration-700 group-hover:opacity-100"
					style={{
						boxShadow: "0 0 80px rgba(255,184,0,0.1)",
					}}
				/>
			</motion.div>
		</div>
	);
}
