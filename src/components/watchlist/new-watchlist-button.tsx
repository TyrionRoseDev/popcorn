import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

const FULL_TEXT = "New Watchlist";
const TYPING_SPEED = 100; // ms per character
const CURSOR_LINGER = 500; // ms after typing before switching to shimmer

export function NewWatchlistButton({ onClick }: { onClick: () => void }) {
	const [charCount, setCharCount] = useState(0);
	const [phase, setPhase] = useState<"typing" | "cursor-linger" | "shimmer">(
		"typing",
	);

	useEffect(() => {
		if (phase !== "typing") return;

		if (charCount >= FULL_TEXT.length) {
			setPhase("cursor-linger");
			return;
		}

		const timer = setInterval(() => {
			setCharCount((c) => {
				if (c >= FULL_TEXT.length) {
					clearInterval(timer);
					return c;
				}
				return c + 1;
			});
		}, TYPING_SPEED);

		return () => clearInterval(timer);
	}, [phase, charCount]);

	useEffect(() => {
		if (phase !== "cursor-linger") return;

		const timer = setTimeout(() => {
			setPhase("shimmer");
		}, CURSOR_LINGER);

		return () => clearTimeout(timer);
	}, [phase]);

	return (
		<div className="mt-6 flex justify-center">
			<button
				type="button"
				onClick={onClick}
				className="new-watchlist-btn relative flex items-center gap-1.5 overflow-hidden transition-colors hover:bg-[rgba(255,184,0,0.18)]"
				style={{
					border: "1.5px solid rgba(255,184,0,0.45)",
					background: "rgba(255,184,0,0.1)",
					color: "#FFB800",
					borderRadius: "20px",
					padding: "8px 18px",
					fontSize: "13px",
					fontWeight: 700,
					cursor: "pointer",
				}}
			>
				<Plus className="h-3.5 w-3.5 shrink-0" />
				<span className="relative">
					{phase === "shimmer" ? FULL_TEXT : FULL_TEXT.slice(0, charCount)}
					{phase !== "shimmer" && (
						<span
							className="inline-block"
							style={{
								animationName: "blink-cursor",
								animationDuration: "0.8s",
								animationTimingFunction: "step-end",
								animationIterationCount: "infinite",
								opacity: phase === "cursor-linger" ? undefined : 1,
								...(phase === "cursor-linger"
									? {
											animationName: "fade-cursor",
											animationDuration: "0.5s",
											animationFillMode: "forwards",
											animationIterationCount: "1",
										}
									: {}),
							}}
						>
							|
						</span>
					)}
				</span>

				{/* Shimmer overlay */}
				{phase === "shimmer" && (
					<span
						className="pointer-events-none absolute inset-0"
						style={{
							background:
								"linear-gradient(90deg, transparent, rgba(255,220,100,0.12), transparent)",
							animationName: "shimmer-sweep",
							animationDuration: "3.5s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
						}}
					/>
				)}
			</button>
		</div>
	);
}
