// The inventory matrix: which route is driven in which state, by which actor, and how to reach it.
import type { Page } from "playwright-core";
import { arcade, type CellSpec, type Fixture, type State } from "./inventory-lib.ts";

const clickButton = (name: string | RegExp) => async (page: Page) => {
	await page.getByRole("button", { name }).first().click({ timeout: 15000 });
	await page.waitForTimeout(900);
};
const clickText = (text: string) => async (page: Page) => {
	await page.getByText(text, { exact: true }).first().click({ timeout: 15000 });
	await page.waitForTimeout(900);
};
const openEllipsis = async (page: Page) => {
	await page.locator("button:has(svg.lucide-ellipsis)").first().click({ timeout: 20000 });
	await page.waitForTimeout(900);
};
const openBell = async (page: Page) => {
	await page.locator("button:has(svg.lucide-bell)").first().click({ timeout: 15000 });
	await page.waitForTimeout(1200);
};
const openArcade = (label: string) => async (page: Page) => {
	await arcade(page, label).click({ timeout: 20000 });
	await page.waitForTimeout(1300);
};

type Target = Pick<CellSpec, "slug" | "route" | "url"> & Partial<Pick<CellSpec, "act" | "via" | "actor" | "settleMs" | "viewport">>;

const ids = (fx: Fixture) => ({
	vera: fx.users.vera ?? "vp-user-vera",
	felix: fx.users.felix ?? "vp-user-felix",
	stella: fx.users.stella ?? "missing-stella",
	rita: fx.users.rita ?? "missing-rita",
	blake: fx.users.blake ?? "missing-blake",
});

/** One row per screen; the first eighteen are the routes every data state covers. */
export function coreTargets(fx: Fixture): Target[] {
	const u = ids(fx);
	return [
		{ slug: "watchlists", route: "/app/watchlists", url: "/app/watchlists" },
		{ slug: "watchlist-detail", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.empty ?? "missing"}` },
		{ slug: "feed", route: "/app/feed", url: "/app/feed" },
		{ slug: "search", route: "/app/search", url: "/app/search" },
		{ slug: "search-results", route: "/app/search", url: "/app/search?q=matrix" },
		{ slug: "search-no-results", route: "/app/search", url: "/app/search?q=zzqxjvkw" },
		{ slug: "shuffle", route: "/app/shuffle", url: "/app/shuffle", settleMs: 3500 },
		{ slug: "shuffle-hidden", route: "/app/shuffle/hidden", url: "/app/shuffle/hidden" },
		{ slug: "title-movie", route: "/app/title/movie/$id", url: "/app/title/movie/603" },
		{ slug: "title-tv", route: "/app/title/tv/$id", url: "/app/title/tv/1396" },
		{ slug: "tracker", route: "/app/tracker", url: "/app/tracker" },
		{ slug: "tracker-journal", route: "/app/tracker", url: "/app/tracker", act: clickText("Journal") },
		{ slug: "tracker-detail", route: "/app/tracker/$id", url: "/app/tracker/1396" },
		{ slug: "friends", route: "/app/friends", url: "/app/friends" },
		{ slug: "profile-self", route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}` },
		{ slug: "profile-friend", route: "/app/profile/$id (friend)", url: `/app/profile/${u.felix}` },
		{ slug: "profile-stranger", route: "/app/profile/$id (stranger)", url: `/app/profile/${u.stella}` },
		{ slug: "settings", route: "/app/settings", url: "/app/settings" },
		{ slug: "settings-blocked", route: "/app/settings/blocked", url: "/app/settings/blocked" },
	];
}

function populatedExtras(fx: Fixture): Target[] {
	const u = ids(fx);
	const profileTab = (label: string) => clickButton(label);
	return [
		{ slug: "profile-blocked", route: "/app/profile/$id (blocked)", url: `/app/profile/${u.blake}` },
		{ slug: "profile-blocked-by", route: "/app/profile/$id (blocked)", url: `/app/profile/${u.vera}`, actor: "blake" },
		{ slug: "profile-request-received", route: "/app/profile/$id (stranger)", url: `/app/profile/${u.rita}` },
		{ slug: "profile-self-journal", viewport: true, route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}`, act: profileTab("Journal") },
		{ slug: "profile-self-watchlists", viewport: true, route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}`, act: profileTab("Watchlists") },
		{ slug: "profile-friend-watchlists", viewport: true, route: "/app/profile/$id (friend)", url: `/app/profile/${u.felix}`, act: profileTab("Watchlists") },
		{ slug: "title-movie-unwatched", route: "/app/title/movie/$id", url: "/app/title/movie/949" },
		{ slug: "title-movie-no-review", route: "/app/title/movie/$id", url: "/app/title/movie/27205" },
		{ slug: "title-tv-finished", route: "/app/title/tv/$id", url: "/app/title/tv/87739" },
		{ slug: "tracker-detail-finished", route: "/app/tracker/$id", url: "/app/tracker/87739" },
		{ slug: "tracker-detail-rewatching", route: "/app/tracker/$id", url: "/app/tracker/87108" },
		{ slug: "watchlist-default", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.myPicks}` },
		{ slug: "watchlist-shared", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.shared}` },
		{ slug: "watchlist-friend-public", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.felixPublic}` },
		{ slug: "shuffle-group", route: "/app/shuffle", url: `/app/shuffle?watchlistId=${fx.watchlists.shared}`, settleMs: 3500 },
		{ slug: "feed-mine", route: "/app/feed", url: "/app/feed", act: async (p) => { await p.locator("select").first().selectOption("mine"); await p.waitForTimeout(2500); } },
	];
}

function withState(t: Target[], state: State, extra: Partial<CellSpec> = {}): CellSpec[] {
	return t.map((x) => ({ actor: "vera", ...x, state, ...extra }));
}

const titleTargets = (t: Target[]) =>
	t.map((x) => (x.slug.startsWith("title-") ? { ...x, via: "client" as const, settleMs: x.settleMs } : x));

export function emptySpecs(fx: Fixture): CellSpec[] {
	const core = coreTargets(fx);
	return withState(core, "empty");
}

export function populatedSpecs(fx: Fixture): CellSpec[] {
	const core = coreTargets({ ...fx, watchlists: { ...fx.watchlists, empty: fx.watchlists.horror } });
	return [...withState(core, "populated"), ...withState(populatedExtras(fx), "populated")];
}

function faultTargets(fx: Fixture): Target[] {
	const core = coreTargets({ ...fx, watchlists: { ...fx.watchlists, empty: fx.watchlists.horror } });
	return titleTargets(core.filter((t) => t.slug !== "search-no-results"));
}

export function loadingSpecs(fx: Fixture): CellSpec[] {
	const t = faultTargets(fx);
	return withState(t, "loading", { fault: "hold-trpc", settleMs: 1500 });
}

const TMDB_SLUGS = new Set([
	"search", "search-results", "shuffle", "shuffle-hidden", "title-movie", "title-tv", "tracker", "tracker-detail",
	"watchlists", "watchlist-detail", "feed", "profile-self",
]);

export function errorSpecs(fx: Fixture): CellSpec[] {
	const t = faultTargets(fx);
	const hardTitle: Target = { slug: "title-movie-hard-load", route: "/app/title/movie/$id", url: "/app/title/movie/603" };
	return withState([...t, hardTitle], "error-500", { fault: "trpc-500" });
}

export function tmdbSpecs(fx: Fixture): CellSpec[] {
	const t = faultTargets(fx).filter((x) => TMDB_SLUGS.has(x.slug));
	return withState(t, "error-tmdb", { fault: "tmdb-down" });
}

export function badUrlSpecs(fx: Fixture): CellSpec[] {
	const t: Target[] = [
		{ slug: "title-movie-unknown-id", route: "/app/title/movie/$id", url: "/app/title/movie/99999999" },
		{ slug: "title-tv-unknown-id", route: "/app/title/tv/$id", url: "/app/title/tv/99999999" },
		{ slug: "title-movie-non-numeric", route: "/app/title/movie/$id", url: "/app/title/movie/abc" },
		{ slug: "title-bad-media-type", route: "/app/title/$mediaType/$id", url: "/app/title/podcast/603" },
		{ slug: "title-unknown-client-nav", route: "/app/title/movie/$id", url: "/app/title/movie/99999999", via: "client" },
		{ slug: "tracker-unknown-id", route: "/app/tracker/$id", url: "/app/tracker/99999999" },
		{ slug: "tracker-non-numeric", route: "/app/tracker/$id", url: "/app/tracker/abc" },
		{ slug: "tracker-movie-id", route: "/app/tracker/$id", url: "/app/tracker/603" },
		{ slug: "profile-unknown", route: "/app/profile/$id", url: "/app/profile/no-such-user" },
		{ slug: "watchlist-unknown", route: "/app/watchlists/$id", url: "/app/watchlists/no-such-list" },
		{ slug: "watchlist-other-private", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.felixPrivate}` },
		{ slug: "shuffle-unknown-watchlist", route: "/app/shuffle", url: "/app/shuffle?watchlistId=no-such-list", settleMs: 3500 },
		{ slug: "shuffle-other-private", route: "/app/shuffle", url: `/app/shuffle?watchlistId=${fx.watchlists.felixPrivate}`, settleMs: 3500 },
		{ slug: "search-bad-params", route: "/app/search", url: "/app/search?page=abc" },
		{ slug: "unknown-root-path", route: "(no route)", url: "/does-not-exist" },
		{ slug: "unknown-app-path", route: "(no route)", url: "/app/does-not-exist" },
		{ slug: "onboarding-when-complete", route: "/onboarding", url: "/onboarding" },
		{ slug: "login-when-signed-in", route: "/login", url: "/login" },
		{ slug: "landing-when-signed-in", route: "/", url: "/" },
	];
	return withState(t, "bad-url");
}

export function signedOutSpecs(fx: Fixture): CellSpec[] {
	const core = coreTargets({ ...fx, watchlists: { ...fx.watchlists, empty: fx.watchlists.horror } })
		.filter((t) => !["search-no-results", "search-results", "tracker-journal", "profile-friend", "profile-stranger"].includes(t.slug))
		.map(({ slug, route, url }) => ({ slug: `redirect-${slug}`, route, url }));
	const publicRoutes: Target[] = [
		{ slug: "landing", route: "/", url: "/" },
		{ slug: "login", route: "/login", url: "/login" },
		{ slug: "onboarding-signed-out", route: "/onboarding", url: "/onboarding" },
		{ slug: "public-title-deep-link", route: "/app/title/movie/$id", url: "/app/title/movie/603" },
	];
	const login = async (page: Page) => {
		await page.getByPlaceholder("you@email.com").fill("anyone@popcorn.test");
		await page.getByRole("button", { name: "Send Magic Link" }).click();
		await page.waitForTimeout(1500);
	};
	return [
		...withState([...publicRoutes, ...core], "signed-out", { actor: "anon" }),
		{ slug: "login-submitting", route: "/login", url: "/login", state: "loading", actor: "anon", fault: "hold-auth", settleMs: 3000, act: login },
		{ slug: "login-send-failed", route: "/login", url: "/login", state: "error-500", actor: "anon", fault: "auth-500", settleMs: 3000, act: login },
		{ slug: "login-invalid-email-blocked", route: "/login", url: "/login", state: "signed-out", actor: "anon",
			act: async (page) => {
				await page.getByPlaceholder("you@email.com").fill("not-an-email");
				await page.getByRole("button", { name: "Send Magic Link" }).click();
				await page.waitForTimeout(800);
			} },
	];
}

export function overlaySpecs(fx: Fixture): CellSpec[] {
	const u = ids(fx);
	const settingsRow = (label: string) => clickText(label);
	const t: Target[] = [
		{ slug: "notifications-popover", route: "(shell)", url: "/app/feed", act: openBell },
		{ slug: "user-menu", route: "(shell)", url: "/app/feed", act: clickButton("Open user menu") },
		{ slug: "review-modal-edit", route: "/app/title/movie/$id", url: "/app/title/movie/603",
			// The watch event menu trigger has no accessible name, only the ellipsis icon.
			act: async (p) => {
				await p.locator("button:has(svg.lucide-ellipsis)").first().click({ timeout: 20000 });
				await p.getByRole("button", { name: "Edit" }).click({ timeout: 10000 });
				await p.waitForTimeout(1200);
			} },
		{ slug: "recommend-modal", route: "/app/title/movie/$id", url: "/app/title/movie/603", act: openArcade("Invite") },
		{ slug: "watchlist-popover", route: "/app/title/movie/$id", url: "/app/title/movie/603", act: openArcade("Watchlist") },
		{ slug: "write-about-modal", route: "/app/tracker/$id", url: "/app/tracker/1396", act: clickButton("Write") },
		{ slug: "rewatch-confirm-partial", route: "/app/tracker/$id", url: "/app/tracker/1396", act: clickButton("Rewatch") },
		{ slug: "create-watchlist-dialog", route: "/app/watchlists", url: "/app/watchlists", act: clickButton(/New Watchlist|^\+|^N/) },
		{ slug: "invite-member-modal", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.shared}`, act: clickButton("Invite") },
		{ slug: "shuffle-card-detail", route: "/app/shuffle", url: "/app/shuffle", settleMs: 3500,
			act: async (p) => { const box = await p.getByRole("button", { name: "Yes — add to watchlist" }).boundingBox(); if (!box) throw new Error("no card"); await p.mouse.click(p.viewportSize()!.width / 2, box.y - 200); await p.waitForTimeout(1300); } },
		{ slug: "shuffle-hide-confirm", route: "/app/shuffle", url: "/app/shuffle", settleMs: 3500, act: clickButton("Hide") },
		{ slug: "achievement-grid", route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}`, act: clickText("Achievements") },
		{ slug: "watch-history-dialog", route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}`,
			// Only renders once a watch event sits in a past year. The past-year fixture phase provides one.
			act: clickButton("See previous years") },
		{ slug: "star-ratings-dialog", route: "/app/profile/$id (self)", url: `/app/profile/${u.vera}`,
			act: async (p) => { await p.locator("button.flex-1.flex-col:not([disabled])").last().click({ timeout: 15000 }); await p.waitForTimeout(1200); } },
		{ slug: "watch-event-menu", route: "/app/title/movie/$id", url: "/app/title/movie/603", act: openEllipsis, viewport: true },
		{ slug: "title-trailer", route: "/app/title/movie/$id", url: "/app/title/movie/603", act: clickButton(/trailer/i), settleMs: 2500, viewport: true },
		{ slug: "edit-note-modal", route: "/app/tracker/$id", url: "/app/tracker/1396",
			act: async (p) => { await p.locator("button:has(svg.lucide-pencil)").last().click({ timeout: 20000 }); await p.waitForTimeout(1200); } },
		{ slug: "tracker-rewatching", route: "/app/tracker/$id", url: "/app/tracker/87108" },
		{ slug: "watchlist-rename", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.horror}`,
			act: async (p) => { await p.locator("button:has(svg.lucide-pencil)").first().click({ timeout: 15000 }); await p.waitForTimeout(900); }, viewport: true },
		{ slug: "watchlist-delete-confirm", route: "/app/watchlists/$id", url: `/app/watchlists/${fx.watchlists.horror}`,
			act: async (p) => { await p.locator("button:has(svg.lucide-trash-2)").first().click({ timeout: 15000 }); await p.waitForTimeout(900); }, viewport: true },
		{ slug: "friend-block-confirm", route: "/app/profile/$id (friend)", url: `/app/profile/${u.felix}`, act: clickButton("Block"), viewport: true },
		{ slug: "settings-avatar", route: "/app/settings", url: "/app/settings", act: settingsRow("Profile Picture") },
		{ slug: "settings-username", route: "/app/settings", url: "/app/settings", act: settingsRow("Username") },
		{ slug: "settings-email", route: "/app/settings", url: "/app/settings", act: settingsRow("Email") },
		{ slug: "settings-genres", route: "/app/settings", url: "/app/settings", act: clickButton(/^Favourite Genres/) },
		{ slug: "settings-favourite-film", route: "/app/settings", url: "/app/settings", act: clickButton(/^Favorite Film/) },
		{ slug: "settings-favourite-genre", route: "/app/settings", url: "/app/settings", act: settingsRow("Favourite Genre") },
		{ slug: "settings-bio", route: "/app/settings", url: "/app/settings", act: clickButton(/^Bio/) },
		{ slug: "settings-delete", route: "/app/settings", url: "/app/settings", act: clickButton("Delete Account") },
	];
	const drawer: CellSpec = {
		slug: "mobile-nav-drawer", route: "(shell)", url: "/app/feed", state: "overlay", actor: "vera", widths: [390],
		act: async (p) => { await p.locator("button:has(svg.lucide-menu)").first().click({ timeout: 15000 }); await p.waitForTimeout(900); },
	};
	const filters: CellSpec = {
		slug: "search-filters", route: "/app/search", url: "/app/search?q=matrix", state: "overlay", actor: "vera", widths: [390], act: clickButton("Filters"),
	};
	// Each width consumes a film, because watching it twice would take the other path through title-actions.
	const removal = (width: 390 | 1440, film: number): CellSpec => ({
		slug: "watchlist-removal-dialog", route: "/app/title/movie/$id", url: `/app/title/movie/${film}`, state: "overlay", actor: "vera", widths: [width],
		act: async (p) => {
			await openArcade("Watchlist")(p);
			await p.getByText("Date Night").first().click({ timeout: 15000 });
			await p.waitForTimeout(1500);
			await p.keyboard.press("Escape");
			await arcade(p, "Watched").click({ timeout: 15000 });
			await p.getByRole("button", { name: /skip/i }).first().click({ timeout: 20000 });
			await p.waitForTimeout(2500);
		},
	});
	return [...withState(t, "overlay"), drawer, filters, removal(390, 694), removal(1440, 348)];
}
