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
	/** Show rating label text below stars (default: true) */
	showLabel?: boolean;
	/** Show numeric "N/5" indicator (default: false) */
	showNumeric?: boolean;
	/** Allow clicking same star to deselect (default: true) */
	toggleable?: boolean;
	/** Additional className for the root container */
	className?: string;
}

export function StarRating({
	value,
	onChange,
	showLabel = true,
	showNumeric = false,
	toggleable = true,
	className = "text-center",
}: StarRatingProps) {
	const [hovered, setHovered] = useState<number | null>(null);
	const displayValue = hovered ?? value ?? 0;

	return (
		<div className={className}>
			{showLabel && (
				<div className="font-mono-retro text-[10px] tracking-[3px] uppercase text-cream/30 mb-3">
					How was it?
				</div>
			)}
			<div
				className="flex items-center gap-1.5 mb-2.5"
				role="radiogroup"
				aria-label="Star rating"
				onMouseLeave={() => setHovered(null)}
			>
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						key={star}
						type="button"
						aria-pressed={value === star}
						aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
						className="relative w-12 h-12 flex items-center justify-center cursor-pointer"
						onMouseEnter={() => setHovered(star)}
						onFocus={() => setHovered(star)}
						onBlur={() => setHovered(null)}
						onClick={() => onChange(toggleable && value === star ? null : star)}
					>
						<div
							className={`absolute inset-0.5 rounded-full bg-neon-amber/15 shadow-[0_0_16px_rgba(255,184,0,0.4)] transition-opacity duration-150 ${star <= displayValue ? "opacity-100" : "opacity-0"}`}
						/>
						<span
							className={`text-[2rem] leading-none relative z-10 transition-all duration-100 ${
								star <= displayValue
									? "text-neon-amber drop-shadow-[0_0_6px_rgba(255,184,0,0.7)]"
									: "text-cream/10"
							}`}
						>
							★
						</span>
					</button>
				))}
				{showNumeric && displayValue > 0 && (
					<span className="ml-1 font-mono text-xs text-neon-amber/70">
						{displayValue}/5
					</span>
				)}
			</div>
			{showLabel && (
				<div className="font-display text-sm text-neon-amber/60 tracking-wider h-5">
					{displayValue > 0 ? ratingLabels[displayValue] : "\u00A0"}
				</div>
			)}
		</div>
	);
}
