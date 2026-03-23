interface SectionBoardProps {
	icon: string;
	title: string;
	children: React.ReactNode;
	className?: string;
}

export function SectionBoard({
	icon,
	title,
	children,
	className,
}: SectionBoardProps) {
	return (
		<div
			className={className}
			style={{
				background: "linear-gradient(to bottom, #0c0c20, #08081a)",
				border: "1px solid rgba(255, 255, 240, 0.06)",
				borderRadius: "0.5rem",
				padding: "2rem",
				position: "relative",
				overflow: "hidden",
				boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
			}}
		>
			{/* Top edge glow */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: "10%",
					right: "10%",
					height: "1px",
					background:
						"linear-gradient(to right, transparent, rgba(255, 255, 240, 0.2), transparent)",
				}}
			/>

			{/* Inner light wash */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "60px",
					background:
						"linear-gradient(to bottom, rgba(255, 255, 240, 0.015), transparent)",
					pointerEvents: "none",
				}}
			/>

			{/* Header */}
			<div
				className="flex items-center gap-3 mb-5 pb-4 border-b border-cream/4"
				style={{ position: "relative", zIndex: 10 }}
			>
				<div
					className="w-8 h-8 rounded-md flex items-center justify-center text-base"
					style={{
						background: "rgba(255, 255, 240, 0.04)",
						border: "1px solid rgba(255, 255, 240, 0.06)",
					}}
				>
					{icon}
				</div>
				<span
					className="font-display text-[15px] tracking-[3px] uppercase text-cream/80"
					style={{ textShadow: "0 0 15px rgba(255, 255, 240, 0.08)" }}
				>
					{title}
				</span>
			</div>

			{/* Children */}
			<div style={{ position: "relative", zIndex: 10 }}>{children}</div>
		</div>
	);
}
