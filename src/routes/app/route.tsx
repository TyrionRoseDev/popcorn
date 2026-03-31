import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { Bookmark, Search, Shuffle, Users } from "lucide-react";
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

function AppLayout() {
	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			<RetroOverlays />

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
							to="/app/shuffle"
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-pink [&.active]:bg-neon-pink/8"
						>
							<Shuffle className="h-3.5 w-3.5" />
							Shuffle
						</Link>
						<Link
							to="/app/watchlists"
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-pink [&.active]:bg-neon-pink/8"
						>
							<Bookmark className="h-3.5 w-3.5" />
							Watchlists
						</Link>
						<Link
							to="/app/friends"
							className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/80 [&.active]:text-neon-amber [&.active]:bg-neon-amber/8"
						>
							<Users className="h-3.5 w-3.5" />
							Friends
						</Link>
					</div>

					{/* Spacer + Auth */}
					<div className="ml-auto flex items-center gap-3">
						<NotificationBell />
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
