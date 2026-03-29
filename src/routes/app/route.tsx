import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useMatches,
} from "@tanstack/react-router";
import { Bookmark, Search } from "lucide-react";
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

function AppLayout() {
	const matches = useMatches();
	const isTitlePage = matches.some(
		(m) => m.routeId === "/app/title/$mediaType/$tmdbId",
	);

	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			{!isTitlePage && <RetroOverlays />}

			{/* Navbar */}
			<header className="sticky top-0 z-50 border-b border-cream/8 bg-drive-in-bg/80 backdrop-blur-lg">
				<nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
					{/* Logo */}
					<Link
						to="/app/search"
						search={{ q: "", type: "all", sort: "relevance", page: 1 }}
						className="flex items-center gap-2 no-underline"
					>
						<span
							className="font-logo text-2xl leading-none"
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

					{/* Nav links */}
					<div className="flex items-center gap-1">
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-cyan [&.active]:bg-neon-cyan/8"
						>
							<Search className="h-3.5 w-3.5" />
							Search
						</Link>
						<Link
							to="/app/watchlists"
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-pink [&.active]:bg-neon-pink/8"
						>
							<Bookmark className="h-3.5 w-3.5" />
							Watchlists
						</Link>
					</div>

					{/* Spacer + Auth */}
					<div className="ml-auto">
						<BetterAuthHeader />
					</div>
				</nav>
			</header>

			{/* Page content */}
			<div className="relative z-10">
				<Outlet />
			</div>
		</div>
	);
}
