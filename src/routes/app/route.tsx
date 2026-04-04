import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import {
	Bookmark,
	Menu,
	Rss,
	Search,
	Shuffle,
	Tv,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "#/components/notifications/notification-bell";
import { RetroOverlays } from "#/components/retro-overlays";
import BetterAuthHeader from "#/integrations/better-auth/header-user";
import { getSession } from "#/lib/auth-session";

export const Route = createFileRoute("/app")({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session?.user) {
			throw redirect({ to: "/login" });
		}

		if (!session.user.onboardingCompleted) {
			throw redirect({ to: "/onboarding" });
		}

		return { user: session.user };
	},
	component: AppLayout,
});

const navLinkClass =
	"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80";

const mobileNavLinkClass =
	"flex flex-col items-center gap-0.5 text-[10px] font-medium text-cream/40 no-underline transition-colors";

function AppLayout() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			<RetroOverlays />

			{/* Desktop Navbar */}
			<header className="sticky top-0 z-50 border-b border-cream/8 bg-drive-in-bg/80 backdrop-blur-lg">
				<nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 2xl:max-w-[1600px]">
					{/* Logo */}
					<Link
						to="/app/search"
						search={{ q: "", type: "all", sort: "relevance", page: 1 }}
						className="flex items-center gap-2 no-underline"
					>
						<span
							className="font-logo text-lg leading-none md:text-2xl"
							style={{
								animationName: "neon-cycle",
								animationDuration: "6s",
								animationTimingFunction: "ease-in-out",
								animationIterationCount: "infinite",
							}}
						>
							POPCORN
						</span>
					</Link>

					{/* Desktop nav links - hidden on mobile */}
					<div className="hidden items-center gap-1 md:flex">
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
						>
							<Search className="h-3.5 w-3.5" />
							Search
						</Link>
						<Link
							to="/app/shuffle"
							className={`${navLinkClass} [&.active]:bg-neon-pink/8 [&.active]:text-neon-pink`}
						>
							<Shuffle className="h-3.5 w-3.5" />
							Shuffle
						</Link>
						<Link
							to="/app/watchlists"
							className={`${navLinkClass} [&.active]:bg-neon-pink/8 [&.active]:text-neon-pink`}
						>
							<Bookmark className="h-3.5 w-3.5" />
							Watchlists
						</Link>
						<Link
							to="/app/friends"
							className={`${navLinkClass} [&.active]:bg-neon-amber/8 [&.active]:text-neon-amber`}
						>
							<Users className="h-3.5 w-3.5" />
							Friends
						</Link>
						<Link
							to="/app/feed"
							className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
						>
							<Rss className="h-3.5 w-3.5" />
							Feed
						</Link>
						<Link
							to="/app/tracker"
							className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
						>
							<Tv className="h-3.5 w-3.5" />
							Tracker
						</Link>
					</div>

					{/* Spacer + Auth */}
					<div className="ml-auto flex items-center gap-3">
						<NotificationBell />
						<BetterAuthHeader />
						{/* Mobile menu toggle */}
						<button
							type="button"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="rounded-lg p-1.5 text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/80 md:hidden"
						>
							{mobileMenuOpen ? (
								<X className="h-5 w-5" />
							) : (
								<Menu className="h-5 w-5" />
							)}
						</button>
					</div>
				</nav>

				{/* Mobile dropdown menu */}
				{mobileMenuOpen && (
					<div className="border-t border-cream/8 bg-drive-in-bg/95 backdrop-blur-lg md:hidden">
						<div className="flex flex-col gap-1 px-4 py-3">
							<Link
								to="/app/search"
								search={{ q: "", type: "all", sort: "relevance", page: 1 }}
								className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Search className="h-3.5 w-3.5" />
								Search
							</Link>
							<Link
								to="/app/shuffle"
								className={`${navLinkClass} [&.active]:bg-neon-pink/8 [&.active]:text-neon-pink`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Shuffle className="h-3.5 w-3.5" />
								Shuffle
							</Link>
							<Link
								to="/app/watchlists"
								className={`${navLinkClass} [&.active]:bg-neon-pink/8 [&.active]:text-neon-pink`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Bookmark className="h-3.5 w-3.5" />
								Watchlists
							</Link>
							<Link
								to="/app/friends"
								className={`${navLinkClass} [&.active]:bg-neon-amber/8 [&.active]:text-neon-amber`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Users className="h-3.5 w-3.5" />
								Friends
							</Link>
							<Link
								to="/app/feed"
								className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Rss className="h-3.5 w-3.5" />
								Feed
							</Link>
							<Link
								to="/app/tracker"
								className={`${navLinkClass} [&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan`}
								onClick={() => setMobileMenuOpen(false)}
							>
								<Tv className="h-3.5 w-3.5" />
								Tracker
							</Link>
						</div>
					</div>
				)}
			</header>

			{/* Page content - add bottom padding on mobile for tab bar */}
			<div className="relative z-10 pb-16 md:pb-0">
				<Outlet />
			</div>

			{/* Mobile bottom tab bar */}
			<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-cream/8 bg-drive-in-bg/95 backdrop-blur-lg md:hidden">
				<div className="flex items-stretch justify-around px-2 py-1.5">
					<Link
						to="/app/search"
						search={{ q: "", type: "all", sort: "relevance", page: 1 }}
						className={`${mobileNavLinkClass} [&.active]:text-neon-cyan`}
					>
						<Search className="h-5 w-5" />
						Search
					</Link>
					<Link
						to="/app/shuffle"
						className={`${mobileNavLinkClass} [&.active]:text-neon-pink`}
					>
						<Shuffle className="h-5 w-5" />
						Shuffle
					</Link>
					<Link
						to="/app/watchlists"
						className={`${mobileNavLinkClass} [&.active]:text-neon-pink`}
					>
						<Bookmark className="h-5 w-5" />
						Lists
					</Link>
					<Link
						to="/app/friends"
						className={`${mobileNavLinkClass} [&.active]:text-neon-amber`}
					>
						<Users className="h-5 w-5" />
						Friends
					</Link>
					<Link
						to="/app/feed"
						className={`${mobileNavLinkClass} [&.active]:text-neon-cyan`}
					>
						<Rss className="h-5 w-5" />
						Feed
					</Link>
					<Link
						to="/app/tracker"
						className={`${mobileNavLinkClass} [&.active]:text-neon-cyan`}
					>
						<Tv className="h-5 w-5" />
						Tracker
					</Link>
				</div>
			</nav>
		</div>
	);
}
