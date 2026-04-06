import { createFileRoute, Link } from "@tanstack/react-router";
import { FilmStrip } from "#/components/film-strip";
import { MarqueeBoard, MarqueeBoardRow } from "#/components/marquee-board";
import { RetroOverlays } from "#/components/retro-overlays";
import { Spotlights } from "#/components/spotlight";
import { TicketStub } from "#/components/ticket-stub";

export const Route = createFileRoute("/")({
	component: LandingPage,
	head: () => ({
		meta: [
			{ title: "Popcorn — Your Drive-In Film Diary" },
			{
				name: "description",
				content:
					"Track films, build watchlists, and get smart picks. Best enjoyed with popcorn.",
			},
		],
	}),
});

const FEATURES = [
	{ label: "Film Diary", status: "Now Showing" },
	{ label: "Episode Tracker", status: "Now Showing" },
	{ label: "Watchlists", status: "Now Showing" },
	{ label: "Showtime Shuffle", status: "Now Showing" },
	{ label: "Reviews", status: "Now Showing" },
	{ label: "Friends & Feed", status: "Now Showing" },
	{ label: "Achievements", status: "Now Showing" },
	{ label: "Journal", status: "Now Showing" },
	{ label: "Discovery", status: "Now Showing" },
	{ label: "Stats & Wrapped", status: "Now Showing" },
] as const;

function LandingPage() {
	return (
		<div
			className="relative min-h-screen bg-drive-in-bg text-cream/85"
			style={{ overflowX: "clip" }}
		>
			<RetroOverlays />

			{/* ========== HERO ========== */}
			<section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-20">
				{/* Vignette */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
						zIndex: 1,
					}}
				/>

				{/* Ambient bottom glow */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse 100% 50% at 50% 110%, rgba(255,45,120,0.06) 0%, transparent 70%)",
						zIndex: 1,
					}}
				/>

				{/* Bottom gradient bridge — blends warm black into cool navy */}
				<div
					className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
					style={{
						background:
							"linear-gradient(to bottom, transparent 0%, rgba(7,7,20,0.4) 40%, rgba(10,10,30,0.85) 75%, #0a0a1e 100%)",
						zIndex: 2,
					}}
				/>

				{/* POPCORN logo */}
				<h1
					className="relative z-10 font-logo text-[clamp(4rem,16vw,10rem)] leading-none"
					style={{
						animationName: "neon-cycle",
						animationDuration: "6s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					}}
				>
					POPCORN
				</h1>

				{/* CTA */}
				<div className="relative z-10 mt-20">
					<Link
						to="/login"
						className="cta-push font-display text-sm tracking-wider text-neon-pink"
						style={{ textShadow: "0 0 10px rgba(255,45,120,0.4)" }}
					>
						Get Started
					</Link>
				</div>
			</section>

			{/* ========== TICKET → PROGRAMME SCROLL STORY ========== */}
			<section
				className="relative overflow-clip"
				style={{ background: "#0a0a1e" }}
			>
				<div className="relative px-4 sm:px-8">
					{/* Sticky ticket — stays pinned, slides BEHIND the board */}
					<div className="sticky top-[28vh] z-10 -mt-12 pb-6">
						<TicketStub />
					</div>

					{/* Programme board — scrolls up OVER the ticket */}
					<div className="relative z-20 mx-auto max-w-[700px] bg-[#0a0a1e] pb-24 pt-8">
						{/* Fade zone — dissolves the ticket as it approaches the board */}
						<div
							className="pointer-events-none absolute inset-x-0 bottom-full h-48"
							style={{
								background:
									"linear-gradient(to bottom, transparent 30%, #0a0a1e 100%)",
							}}
						/>
						<MarqueeBoard title="Tonight's Programme">
							{FEATURES.map((feature, i) => (
								<MarqueeBoardRow
									key={feature.label}
									label={feature.label}
									status={feature.status}
									index={i}
								/>
							))}
						</MarqueeBoard>
					</div>
				</div>

				<Spotlights />

				{/* Vignette */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse at center, transparent 30%, rgba(8,8,26,0.4) 100%)",
						zIndex: 3,
					}}
				/>
			</section>

			<FilmStrip />

			{/* ========== FOOTER ========== */}
			<footer className="bg-[#0a0a12] px-4 py-16 text-center">
				<p
					className="font-display text-xl text-neon-pink"
					style={{
						textShadow:
							"0 0 10px rgba(255,45,120,0.3), 0 0 30px rgba(255,45,120,0.15)",
						animationName: "footer-flicker",
						animationDuration: "4s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					}}
				>
					best enjoyed with popcorn.
				</p>
			</footer>
		</div>
	);
}
