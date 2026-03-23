import { getTmdbImageUrl } from "#/lib/tmdb";

interface PosterDisplayCaseProps {
	posterPath: string | null;
	title: string;
}

export function PosterDisplayCase({ posterPath, title }: PosterDisplayCaseProps) {
	const posterUrl = getTmdbImageUrl(posterPath, "w342");

	return (
		<div className="w-[280px] flex-shrink-0 relative">
			{/* Ambient glow */}
			<div
				aria-hidden="true"
				className="absolute pointer-events-none z-[-1]"
				style={{
					top: "10%",
					left: "-20px",
					right: "-20px",
					bottom: "10%",
					background: "radial-gradient(ellipse at center, rgba(255,45,120,0.06), transparent 70%)",
					filter: "blur(20px)",
				}}
			/>

			{/* Case */}
			<div
				className="bg-[#0e0e14] rounded-md p-3 relative"
				style={{
					border: "1px solid rgba(255,255,240,0.08)",
					boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
				}}
			>
				{/* Case light bar */}
				<div
					aria-hidden="true"
					className="absolute top-0 rounded-t-md"
					style={{
						left: "10%",
						right: "10%",
						height: "3px",
						background: "linear-gradient(to right, transparent, rgba(255,255,240,0.7), transparent)",
						boxShadow: "0 2px 12px rgba(255,255,240,0.3), 0 4px 24px rgba(255,255,240,0.12)",
					}}
				/>

				{/* Light wash */}
				<div
					aria-hidden="true"
					className="absolute top-0 pointer-events-none"
					style={{
						left: "10%",
						right: "10%",
						height: "60%",
						background: "linear-gradient(to bottom, rgba(255,255,240,0.04), transparent)",
					}}
				/>

				{/* Corner screws */}
				<div
					aria-hidden="true"
					className="absolute top-2 left-2 w-[6px] h-[6px] rounded-full bg-[#1a1a24]"
					style={{
						border: "1px solid rgba(255,255,240,0.06)",
						boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
					}}
				/>
				<div
					aria-hidden="true"
					className="absolute top-2 right-2 w-[6px] h-[6px] rounded-full bg-[#1a1a24]"
					style={{
						border: "1px solid rgba(255,255,240,0.06)",
						boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
					}}
				/>
				<div
					aria-hidden="true"
					className="absolute bottom-2 left-2 w-[6px] h-[6px] rounded-full bg-[#1a1a24]"
					style={{
						border: "1px solid rgba(255,255,240,0.06)",
						boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
					}}
				/>
				<div
					aria-hidden="true"
					className="absolute bottom-2 right-2 w-[6px] h-[6px] rounded-full bg-[#1a1a24]"
					style={{
						border: "1px solid rgba(255,255,240,0.06)",
						boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
					}}
				/>

				{/* Poster image */}
				{posterUrl ? (
					<img
						src={posterUrl}
						alt={title}
						className="w-full rounded-sm object-cover"
						style={{ aspectRatio: "2/3" }}
					/>
				) : (
					<div
						className="w-full rounded-sm"
						style={{
							aspectRatio: "2/3",
							background: "linear-gradient(135deg, #2a1a4e, #1a3a5e)",
						}}
					/>
				)}

				{/* Glass reflection */}
				<div
					aria-hidden="true"
					className="absolute rounded-sm pointer-events-none"
					style={{
						inset: "12px",
						background: "linear-gradient(135deg, rgba(255,255,255,0.03), transparent 60%)",
					}}
				/>

				{/* Feature Presentation label */}
				<div className="text-center mt-3 font-mono-retro text-[9px] uppercase tracking-[2px] text-cream/30">
					Feature Presentation
				</div>
			</div>
		</div>
	);
}
