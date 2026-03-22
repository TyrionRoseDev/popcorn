import { useState } from "react";

interface SynopsisProps {
  overview: string;
}

const MAX_LENGTH = 300;

export function Synopsis({ overview }: SynopsisProps) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = overview.length > MAX_LENGTH;
  const displayText =
    needsTruncation && !expanded
      ? `${overview.slice(0, MAX_LENGTH)}...`
      : overview;

  return (
    <div>
      <div className="font-mono-retro text-[11px] text-neon-pink uppercase tracking-[2px] mb-2 [text-shadow:0_0_10px_rgba(255,45,120,0.3)]">
        Synopsis
      </div>
      <p className="text-[15px] leading-[1.7] text-cream/80">{displayText}</p>
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
