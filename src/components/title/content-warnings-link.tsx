import { Heart } from "lucide-react";

const DTDD_HOME = "https://www.doesthedogdie.com";

interface ContentWarningsLinkProps {
	title: string;
	dtddUrl: string | null;
}

export function ContentWarningsLink({
	title,
	dtddUrl,
}: ContentWarningsLinkProps) {
	return (
		<div
			className="mt-5 rounded-lg px-5 py-4"
			style={{
				background:
					"linear-gradient(135deg, rgba(255,184,0,0.04) 0%, rgba(255,184,0,0.02) 100%)",
				border: "1px solid rgba(255,184,0,0.10)",
			}}
		>
			<div className="flex items-start gap-3">
				<Heart
					className="mt-0.5 h-[14px] w-[14px] flex-shrink-0 text-neon-amber/50"
					strokeWidth={2}
				/>
				<p className="text-[13px] leading-relaxed text-cream/45">
					Feeling unsure about{" "}
					<span className="italic text-cream/55">{title}</span>? That's okay.{" "}
					<a
						href={dtddUrl ?? DTDD_HOME}
						target="_blank"
						rel="noreferrer"
						className="text-neon-amber/70 underline decoration-neon-amber/25 underline-offset-2 transition-colors hover:text-neon-amber hover:decoration-neon-amber/50"
					>
						Check for content warnings
					</a>{" "}
					before watching.
				</p>
			</div>
		</div>
	);
}
