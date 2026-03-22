import { Link, createFileRoute } from "@tanstack/react-router";
import { FilmStrip } from "#/components/film-strip";
import { MarqueeBoard, MarqueeBoardRow } from "#/components/marquee-board";
import { RetroOverlays } from "#/components/retro-overlays";
import { Spotlights } from "#/components/spotlight";
import { TicketStub } from "#/components/ticket-stub";

export const Route = createFileRoute("/")({ component: LandingPage });

const FEATURES = [
	"Film Diary",
	"Watchlist",
	"Smart Picks",
	"Stats & Wrapped",
	"Social Reviews",
] as const;

function LandingPage() {
	return (
		<div className="relative min-h-screen bg-drive-in-bg text-cream/85" style={{ overflowX: "clip" }}>
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

				{/* NOW SHOWING marquee */}
				<div
					className="relative z-10 mb-10 inline-block border-[1.5px] border-neon-amber/50 px-6 py-2 font-mono-retro text-[11px] uppercase tracking-[6px] text-neon-amber"
					style={{
						textShadow: "0 0 8px rgba(255,184,0,0.4)",
						animationName: "marquee-pulse",
						animationDuration: "3s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					}}
				>
					✦ Now Showing ✦
				</div>

				{/* POPCORN logo */}
				<h1
					className="relative z-10 font-logo text-[clamp(3rem,12vw,6rem)] leading-none"
					style={{
						animationName: "neon-cycle",
						animationDuration: "6s",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					}}
				>
					POPCORN
				</h1>

				{/* CTA buttons */}
				<div className="relative z-10 mt-14 flex gap-4">
					<Link
						to="/login"
						className="rounded border-[1.5px] border-neon-pink/50 px-8 py-3.5 font-display text-[15px] tracking-wide text-neon-pink no-underline transition-all duration-300 hover:bg-neon-pink/8 hover:shadow-[0_0_25px_rgba(255,45,120,0.3)]"
						style={{
							boxShadow: "0 0 12px rgba(255,45,120,0.15)",
						}}
					>
						Log In
					</Link>
					<Link
						to="/signup"
						className="rounded border-[1.5px] border-neon-cyan/25 px-8 py-3.5 font-display text-[15px] tracking-wide text-neon-cyan/60 no-underline transition-all duration-300 hover:border-neon-cyan/45 hover:text-neon-cyan/85 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]"
					>
						Create an Account
					</Link>
				</div>
			</section>

			{/* ========== TICKET → PROGRAMME SCROLL STORY ========== */}
			<section
				className="relative"
				style={{ background: "#0a0a1e" }}
			>
				<div className="relative px-4 sm:px-8">
					{/* Sticky ticket — stays pinned, slides BEHIND the board */}
					<div className="sticky top-[28vh] z-10 -mt-12 pb-6">
						<TicketStub />
					</div>

					{/* Programme board — scrolls up OVER the ticket */}
					<div className="relative z-20 mx-auto max-w-[550px] pb-24 pt-8">
						<MarqueeBoard title="Tonight's Programme">
							{FEATURES.map((feature, i) => (
								<MarqueeBoardRow
									key={feature}
									label={feature}
									status="Coming Soon"
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
