import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import {
	Bookmark,
	LogOut,
	Menu,
	Rss,
	Search,
	Settings,
	Shuffle,
	Tv,
	User,
	Users,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "#/components/notifications/notification-bell";
import { RetroOverlays } from "#/components/retro-overlays";
import { Sheet, SheetContent, SheetTitle } from "#/components/ui/sheet";
import BetterAuthHeader from "#/integrations/better-auth/header-user";
import { authClient } from "#/lib/auth-client";
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

const tabClass =
	"uppercase text-[11px] tracking-[0.12em] font-mono-retro font-bold text-cream/35 no-underline transition-all duration-200 px-4 py-2.5 border-b-2 border-transparent hover:text-cream/60";

const neonTab = {
	pink: "[&.active]:text-neon-pink [&.active]:border-neon-pink [&.active]:[box-shadow:0_4px_12px_-2px_rgba(255,45,120,0.5)]",
	cyan: "[&.active]:text-neon-cyan [&.active]:border-neon-cyan [&.active]:[box-shadow:0_4px_12px_-2px_rgba(0,229,255,0.5)]",
	amber:
		"[&.active]:text-neon-amber [&.active]:border-neon-amber [&.active]:[box-shadow:0_4px_12px_-2px_rgba(255,184,0,0.5)]",
};

const drawerLinkClass =
	"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/50 no-underline transition-colors hover:bg-cream/5 hover:text-cream/70";

const drawerNeon = {
	pink: "[&.active]:bg-neon-pink/8 [&.active]:text-neon-pink",
	cyan: "[&.active]:bg-neon-cyan/8 [&.active]:text-neon-cyan",
	amber: "[&.active]:bg-neon-amber/8 [&.active]:text-neon-amber",
};

function focusSearch() {
	window.dispatchEvent(new Event("focus-search"));
}

function AppLayout() {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();

	return (
		<div className="relative min-h-screen bg-drive-in-bg">
			<RetroOverlays />

			{/* Header */}
			<header className="relative sticky top-0 z-50 border-b border-cream/8 bg-drive-in-bg/80 backdrop-blur-lg">
				{/* Top row — logo centered */}
				<div className="relative mx-auto max-w-6xl px-4 2xl:max-w-[1600px]">
					{/* Mobile hamburger */}
					<button
						type="button"
						onClick={() => setDrawerOpen(true)}
						className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/80 md:hidden"
					>
						<Menu className="h-5 w-5" />
					</button>

					{/* Centered logo */}
					<div className="flex justify-center py-3">
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className="no-underline"
							onClick={focusSearch}
						>
							<span
								className="font-logo text-lg leading-none tracking-wide md:text-2xl"
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
					</div>
				</div>

				{/* Right-side actions — centered across full header height */}
				<div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-3">
					<NotificationBell />
					<BetterAuthHeader />
				</div>

				{/* Bottom row — desktop tab strip */}
				<nav className="hidden md:block">
					<div className="mx-auto flex max-w-6xl items-center justify-center gap-1 px-4 2xl:max-w-[1600px]">
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className={`${tabClass} ${neonTab.pink}`}
							onClick={focusSearch}
						>
							Search
						</Link>
						<Link to="/app/shuffle" className={`${tabClass} ${neonTab.cyan}`}>
							Shuffle
						</Link>
						<Link
							to="/app/watchlists"
							className={`${tabClass} ${neonTab.amber}`}
						>
							Watchlists
						</Link>
						<Link to="/app/friends" className={`${tabClass} ${neonTab.pink}`}>
							Friends
						</Link>
						<Link to="/app/feed" className={`${tabClass} ${neonTab.cyan}`}>
							Feed
						</Link>
						<Link to="/app/tracker" className={`${tabClass} ${neonTab.amber}`}>
							Tracker
						</Link>
					</div>
				</nav>
			</header>

			{/* Mobile drawer */}
			<Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="w-60 gap-0 border-r-cream/8 bg-drive-in-bg p-0"
				>
					<SheetTitle className="sr-only">Navigation</SheetTitle>

					{/* Logo — static pink on mobile */}
					<div className="px-5 pt-5 pb-3">
						<span className="font-logo text-lg tracking-wide text-neon-pink">
							POPCORN
						</span>
					</div>
					<div className="mx-4 border-t border-cream/8" />

					{/* Primary nav */}
					<nav className="flex flex-col gap-0.5 px-3 py-3">
						<Link
							to="/app/search"
							search={{ q: "", type: "all", sort: "relevance", page: 1 }}
							className={`${drawerLinkClass} ${drawerNeon.pink}`}
							onClick={() => {
								setDrawerOpen(false);
								focusSearch();
							}}
						>
							<Search className="h-4 w-4" />
							Search
						</Link>
						<Link
							to="/app/shuffle"
							className={`${drawerLinkClass} ${drawerNeon.cyan}`}
							onClick={() => setDrawerOpen(false)}
						>
							<Shuffle className="h-4 w-4" />
							Shuffle
						</Link>
						<Link
							to="/app/watchlists"
							className={`${drawerLinkClass} ${drawerNeon.amber}`}
							onClick={() => setDrawerOpen(false)}
						>
							<Bookmark className="h-4 w-4" />
							Watchlists
						</Link>
						<Link
							to="/app/friends"
							className={`${drawerLinkClass} ${drawerNeon.pink}`}
							onClick={() => setDrawerOpen(false)}
						>
							<Users className="h-4 w-4" />
							Friends
						</Link>
						<Link
							to="/app/feed"
							className={`${drawerLinkClass} ${drawerNeon.cyan}`}
							onClick={() => setDrawerOpen(false)}
						>
							<Rss className="h-4 w-4" />
							Feed
						</Link>
						<Link
							to="/app/tracker"
							className={`${drawerLinkClass} ${drawerNeon.amber}`}
							onClick={() => setDrawerOpen(false)}
						>
							<Tv className="h-4 w-4" />
							Tracker
						</Link>
					</nav>

					{/* Secondary links */}
					<div className="mt-auto">
						<div className="mx-4 border-t border-cream/8" />
						<div className="flex flex-col gap-0.5 px-3 py-3">
							<Link
								to="/app/profile/$userId"
								params={{ userId: user.id }}
								className={drawerLinkClass}
								onClick={() => setDrawerOpen(false)}
							>
								<User className="h-4 w-4" />
								Profile
							</Link>
							<Link
								to="/app/settings"
								className={drawerLinkClass}
								onClick={() => setDrawerOpen(false)}
							>
								<Settings className="h-4 w-4" />
								Settings
							</Link>
							<button
								type="button"
								className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/70"
								onClick={async () => {
									setDrawerOpen(false);
									await authClient.signOut();
									navigate({ to: "/" });
								}}
							>
								<LogOut className="h-4 w-4" />
								Sign out
							</button>
						</div>
					</div>
				</SheetContent>
			</Sheet>

			{/* Page content */}
			<div className="relative">
				<Outlet />
			</div>
		</div>
	);
}
