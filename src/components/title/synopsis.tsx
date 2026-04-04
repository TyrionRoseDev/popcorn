import { useState } from "react";

interface SynopsisProps {
	overview: string;
	featuredLine?: string | null;
	quoteCharacter?: string | null;
}

const MAX_LENGTH = 300;

export function Synopsis({
	overview,
	featuredLine,
	quoteCharacter,
}: SynopsisProps) {
	const [expanded, setExpanded] = useState(false);
	const needsTruncation = overview.length > MAX_LENGTH;
	const displayText =
		needsTruncation && !expanded
			? `${overview.slice(0, MAX_LENGTH)}...`
			: overview;

	return (
		<div>
			{featuredLine && (
				<p className="italic text-base text-cream/50 border-l-[3px] border-neon-pink pl-4 mb-[18px] [box-shadow:-3px_0_15px_rgba(255,45,120,0.15)]">
					{featuredLine.startsWith("\u201C") || featuredLine.startsWith('"')
						? featuredLine
						: `\u201C${featuredLine}\u201D`}
					{quoteCharacter && (
						<span className="not-italic text-sm text-cream/35">
							{" "}
							— {quoteCharacter}
						</span>
					)}
				</p>
			)}
			<p className="text-[15px] leading-[1.9] text-cream/70">{displayText}</p>
			{needsTruncation && (
				<button
					type="button"
					onClick={() => setExpanded(!expanded)}
					className="text-neon-cyan text-[13px] mt-1.5 [text-shadow:0_0_8px_rgba(0,229,255,0.3)] cursor-pointer"
				>
					{expanded ? "Show less" : "Read more"}
				</button>
			)}
		</div>
	);
}
