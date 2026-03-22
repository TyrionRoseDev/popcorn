export function MarqueeBadge({ text }: { text: string }) {
	return (
		<div
			className="mb-10 inline-block border-[1.5px] border-neon-amber/50 px-6 py-2 font-mono-retro text-[11px] uppercase tracking-[6px] text-neon-amber"
			style={{
				textShadow: "0 0 8px rgba(255,184,0,0.4)",
				animationName: "marquee-pulse",
				animationDuration: "3s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
			}}
		>
			✦ {text} ✦
		</div>
	);
}
