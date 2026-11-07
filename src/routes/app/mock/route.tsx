import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { Bookmark, BookOpen, Search, Tv, Users } from "lucide-react";
import "./-tokens.css";
import "./-mock.css";
import { people } from "./-data";
import { Avatar } from "./-ui";

type MockSearch = { d: "restrained" | "literal"; state?: "empty" };

export const Route = createFileRoute("/app/mock")({
	validateSearch: (s: Record<string, unknown>): MockSearch => ({
		d: s.d === "literal" ? "literal" : "restrained",
		...(s.state === "empty" ? { state: "empty" as const } : {}),
	}),
	component: MockLayout,
});

const screens = [
	{ to: "/app/mock/diary", label: "Diary" },
	{ to: "/app/mock/title", label: "Title page" },
	{ to: "/app/mock/feed", label: "Friends feed" },
] as const;

function MockLayout() {
	const { d, state } = Route.useSearch();
	const { pathname } = useLocation();
	const tab = pathname.endsWith("/feed")
		? "friends"
		: pathname.endsWith("/diary")
			? "diary"
			: "";

	return (
		<div className="pc" data-dir={d}>
			<section className="pc-mockbar" aria-label="Mock-up controls">
				<strong style={{ color: "#fff" }}>Mock-up, fixture data</strong>
				<span className="pc-mockbar__group">
					Direction
					{(["restrained", "literal"] as const).map((dir) => (
						<Link
							key={dir}
							to="."
							search={{ d: dir, state }}
							aria-current={d === dir}
						>
							{dir === "restrained" ? "Restrained" : "Literal"}
						</Link>
					))}
				</span>
				<span className="pc-mockbar__group">
					Screen
					{screens.map((s) => (
						<Link
							key={s.to}
							to={s.to}
							search={{ d }}
							aria-current={pathname === s.to}
						>
							{s.label}
						</Link>
					))}
				</span>
			</section>
			<header className="pc-top">
				<Link
					to="/app/mock/diary"
					search={{ d }}
					className="pc-logo"
					aria-label="Popcorn, Diary"
				>
					POPCORN
				</Link>
				<nav className="pc-nav" aria-label="Main">
					<Link
						to="/app/mock/diary"
						search={{ d }}
						aria-current={tab === "diary" ? "page" : undefined}
					>
						Diary
					</Link>
					<a href="#watching">Watching</a>
					<a href="#want">Want to watch</a>
					<Link
						to="/app/mock/feed"
						search={{ d }}
						aria-current={tab === "friends" ? "page" : undefined}
					>
						Friends
					</Link>
				</nav>
				<div className="pc-top__right">
					<button type="button" className="pc-searchbox">
						<Search size={16} aria-hidden="true" /> Search films and shows
					</button>
					<button
						type="button"
						className="pc-iconbtn pc-iconbtn--search"
						aria-label="Search"
					>
						<Search size={20} />
					</button>
					<button
						type="button"
						className="pc-iconbtn"
						aria-label="Your profile"
					>
						<Avatar person={people.vera} size={32} />
					</button>
				</div>
			</header>
			<div className="pc-bulbstrip" aria-hidden="true" />
			<div className="pc-sky" aria-hidden="true" />
			<main className="pc-main">
				<Outlet />
			</main>
			<nav className="pc-tabbar" aria-label="Main">
				<Link
					to="/app/mock/diary"
					search={{ d }}
					aria-current={tab === "diary" ? "page" : undefined}
				>
					<BookOpen size={20} aria-hidden="true" />
					Diary
				</Link>
				<a href="#watching">
					<Tv size={20} aria-hidden="true" />
					Watching
				</a>
				<a href="#want">
					<Bookmark size={20} aria-hidden="true" />
					Want to watch
				</a>
				<Link
					to="/app/mock/feed"
					search={{ d }}
					aria-current={tab === "friends" ? "page" : undefined}
				>
					<Users size={20} aria-hidden="true" />
					Friends
				</Link>
			</nav>
		</div>
	);
}
