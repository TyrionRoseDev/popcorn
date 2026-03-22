export function FilmStrip({ className }: { className?: string }) {
	return (
		<div
			className={`relative z-20 h-7 w-full border-y-[3px] border-drive-in-border opacity-60 ${className ?? ""}`}
			style={{
				background:
					"repeating-linear-gradient(90deg, #1a1a2e 0px, #1a1a2e 20px, #050508 20px, #050508 30px)",
			}}
		/>
	);
}
