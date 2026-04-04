export function TitlePageAtmosphere() {
	return (
		<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
			{/* Pink ground glow */}
			<div
				className="fixed bottom-0 left-0 right-0"
				style={{
					height: "200px",
					background:
						"radial-gradient(ellipse at 50% 100%, rgba(236, 72, 153, 0.15) 0%, transparent 70%)",
					zIndex: 1,
				}}
			/>
		</div>
	);
}
