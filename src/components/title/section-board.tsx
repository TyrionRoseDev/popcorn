interface SectionBoardProps {
	title: string;
	children: React.ReactNode;
	className?: string;
}

export function SectionBoard({
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
				className="mb-5 pb-4 border-b border-cream/6"
				style={{ position: "relative", zIndex: 10 }}
			>
				<span
					className="font-display text-base tracking-[3px] uppercase text-cream/90"
					style={{
						textShadow:
							"0 0 20px rgba(255, 255, 240, 0.12), 0 0 40px rgba(255, 184, 0, 0.04)",
					}}
				>
					{title}
				</span>
			</div>

			{/* Children */}
			<div style={{ position: "relative", zIndex: 10 }}>{children}</div>
		</div>
	);
}
