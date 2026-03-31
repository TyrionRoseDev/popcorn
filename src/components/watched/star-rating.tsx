import { useState } from "react";

const ratingLabels: Record<number, string> = {
	1: "Bad",
	2: "Meh",
	3: "Decent",
	4: "Great Film",
	5: "Masterpiece",
};

interface StarRatingProps {
	value: number | null;
	onChange: (value: number | null) => void;
}

export function StarRating({ value, onChange }: StarRatingProps) {
	const [hovered, setHovered] = useState<number | null>(null);
	const displayValue = hovered ?? value ?? 0;

	return (
		<div className="text-center">
			<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3">
				How was it?
			</div>
			<div className="flex justify-center gap-1.5 mb-2.5">
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						key={star}
						type="button"
						className="relative w-12 h-12 flex items-center justify-center cursor-pointer"
						onMouseEnter={() => setHovered(star)}
						onMouseLeave={() => setHovered(null)}
						onClick={() => onChange(value === star ? null : star)}
					>
						{star <= displayValue && (
							<div className="absolute inset-0.5 rounded-full bg-neon-amber/15 shadow-[0_0_16px_rgba(255,184,0,0.4)]" />
						)}
						<span
							className={`text-[2rem] leading-none relative z-10 transition-transform duration-100 ${
								star <= displayValue
									? "text-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.7)] scale-115"
									: "text-cream/10"
							}`}
						>
							★
						</span>
					</button>
				))}
			</div>
			<div className="font-display text-sm text-neon-amber/60 tracking-wider">
				{displayValue > 0 ? ratingLabels[displayValue] : ""}
			</div>
		</div>
	);
}
