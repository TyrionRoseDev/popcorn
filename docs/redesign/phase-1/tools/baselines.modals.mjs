// One entry per modal type. open(page, h) must leave it open and return a CSS selector for its root.
// Keep this registry in step with the UI: an entry that cannot open is reported as skipped, not as clean.
export const MODAL_ACTOR = { key: "modal", id: "vp-user-mia", email: "mia@popcorn.test", username: "miamodal", name: "Mia Modal" };

const SCOPE = "[data-baseline-scope]";
const TITLE = "/app/title/movie/603";
const SHOW = "/app/tracker/1396";

export function resetModalActor(sql) {
	const id = MODAL_ACTOR.id;
	sql(`delete from notification where actor_id='${id}' or recipient_id='${id}';
		delete from earned_achievement where user_id='${id}';
		delete from watch_event where user_id='${id}';
		delete from episode_watch where user_id='${id}';
		delete from user_title where user_id='${id}';
		delete from watchlist where owner_id='${id}';`);
}

async function mark(locator) {
	await locator.waitFor({ timeout: 15000 });
	await locator.evaluate((el) => el.setAttribute("data-baseline-scope", ""));
	return SCOPE;
}

async function visit(page, h, path, wait) {
	await page.goto(path);
	await h.settle(page, wait);
}

const arcade = (page, label) => page.locator("div.text-center", { has: page.getByText(label, { exact: true }) }).getByRole("button");
const dialog = (page, name) => page.getByRole("dialog", { name });
const alertOrDialog = (page) => page.locator('[role="dialog"], [role="alertdialog"]').last();

async function openReview(page, h) {
	resetModalActor(h.sql);
	await visit(page, h, TITLE);
	await arcade(page, "Watched").click();
	const review = dialog(page, "Review");
	await review.waitFor({ timeout: 15000 });
	return review;
}

const settingsRow = (id, name) => ({
	id: `settings-${id}`,
	async open(page, h) {
		await visit(page, h, "/app/settings");
		await page.getByRole("button", { name }).first().click();
		return mark(alertOrDialog(page));
	},
});

export const MODALS = [
	{
		id: "review",
		async open(page, h) {
			return mark(await openReview(page, h));
		},
	},
	{
		id: "watched-with",
		async open(page, h) {
			const review = await openReview(page, h);
			await review.getByRole("button", { name: /watched with|who.*with/i }).first().click();
			return mark(dialog(page, "Watched With"));
		},
	},
	{
		id: "achievement-popup",
		async open(page, h) {
			const review = await openReview(page, h);
			await review.getByRole("button", { name: "Rate 4 stars" }).click();
			await review.getByRole("button", { name: /^Public/ }).click();
			await review.getByRole("button", { name: "Save & Done" }).click();
			const popup = dialog(page, /Achievements? Unlocked/);
			await popup.waitFor({ timeout: 15000 });
			await page.waitForTimeout(1500);
			return mark(popup);
		},
	},
	{
		id: "add-to-watchlist-popover",
		async open(page, h) {
			await visit(page, h, TITLE);
			await arcade(page, "Watchlist").click();
			return mark(page.locator('[data-slot="popover-content"]'));
		},
	},
	{
		id: "create-watchlist",
		async open(page, h) {
			await visit(page, h, "/app/watchlists");
			await page.getByRole("button", { name: /new watchlist/i }).click();
			return mark(dialog(page, /create new watchlist/i));
		},
	},
	{
		id: "recommend",
		async open(page, h) {
			await visit(page, h, TITLE);
			await arcade(page, "Invite").click();
			return mark(alertOrDialog(page));
		},
	},
	{
		id: "hide-confirm",
		async open(page, h) {
			await visit(page, h, TITLE);
			await page.getByRole("button", { name: "Hide", exact: true }).click();
			return mark(dialog(page, /hide this title/i));
		},
	},
	{
		id: "watchlist-removal",
		async open(page, h) {
			resetModalActor(h.sql);
			await visit(page, h, TITLE);
			const ctx = page.context();
			for (const name of ["Alpha", "Beta"]) {
				const wl = await h.trpc(ctx, "watchlist.create", { name, isPublic: false, memberIds: [] });
				await h.trpc(ctx, "watchlist.addItem", { watchlistId: wl.id, tmdbId: 603, mediaType: "movie", titleName: "The Matrix" });
			}
			await visit(page, h, TITLE);
			await arcade(page, "Watched").click();
			const review = dialog(page, "Review");
			await review.waitFor({ timeout: 15000 });
			await page.keyboard.press("Escape");
			await review.waitFor({ state: "hidden", timeout: 8000 });
			const popup = dialog(page, /Achievements? Unlocked/);
			await page.waitForTimeout(2000);
			if (await popup.isVisible()) await popup.getByRole("button", { name: /continue/i }).click();
			return mark(dialog(page, "Remove from Watchlists"));
		},
	},
	{
		id: "watchlist-invite",
		actor: "populated",
		async open(page, h) {
			const id = h.sql(`select id from watchlist where owner_id='vp-user-vera' and type='custom' limit 1`)[0][0];
			await visit(page, h, `/app/watchlists/${id}`);
			await page.getByRole("button", { name: /invite/i }).first().click();
			return mark(dialog(page, /invite to/i));
		},
	},
	{
		id: "notifications-popover",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/feed");
			await page.locator("button:has(svg.lucide-bell)").first().click();
			return mark(page.locator('[data-slot="popover-content"]'));
		},
	},
	{
		id: "user-menu",
		async open(page, h) {
			await visit(page, h, "/app/feed");
			await page.getByRole("button", { name: "Open user menu" }).first().click();
			return mark(page.getByRole("menu"));
		},
	},
	{
		id: "nav-drawer",
		viewport: "mobile",
		async open(page, h) {
			await visit(page, h, "/app/feed");
			await page.locator("button:has(svg.lucide-menu)").first().click();
			return mark(dialog(page, "Navigation"));
		},
	},
	{
		id: "search-filters-sheet",
		viewport: "mobile",
		async open(page, h) {
			await visit(page, h, "/app/search?q=matrix");
			await page.getByRole("button", { name: /filter/i }).first().click();
			return mark(alertOrDialog(page));
		},
	},
	settingsRow("avatar", /profile picture/i),
	settingsRow("username", /username/i),
	settingsRow("email", /^email/i),
	settingsRow("genres", /genres/i),
	settingsRow("favourite-film", /favou?rite film/i),
	settingsRow("favourite-genre", /favou?rite genre/i),
	settingsRow("bio", /bio/i),
	settingsRow("delete-account", /delete/i),
	{
		id: "profile-achievements",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/profile/vp-user-vera");
			await page.getByRole("button", { name: /achievements/i }).first().click();
			return mark(dialog(page, "Achievements"));
		},
	},
	{
		id: "profile-watch-history",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/profile/vp-user-vera");
			await page.getByRole("button", { name: /see previous years/i }).first().click();
			return mark(dialog(page, "Watch History"));
		},
	},
	{
		id: "profile-star-ratings",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/profile/vp-user-vera");
			await page.locator('button:has-text("5"):not(:has(a))').filter({ has: page.locator("svg.lucide-star") }).first().click();
			return mark(dialog(page, "Star Ratings"));
		},
	},
	{
		id: "watch-event-menu",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, TITLE);
			await page.locator("button:has(svg.lucide-ellipsis)").first().click();
			return mark(page.locator('[data-slot="popover-content"]'));
		},
	},
	{
		id: "tracker-write-about",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, SHOW);
			await page.getByRole("button", { name: /^write/i }).first().click();
			return mark(dialog(page, "Write About"));
		},
	},
	{
		id: "tracker-rewatch-confirm",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, SHOW);
			await page.getByRole("button", { name: /^rewatch/i }).first().click();
			return mark(dialog(page, "Start Rewatch"));
		},
	},
	{
		id: "tracker-journal-menu",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/tracker");
			await page.getByRole("button", { name: /journal/i }).first().click();
			await page.getByRole("button", { name: "More actions" }).first().click({ timeout: 8000 });
			return mark(page.locator('[data-slot="popover-content"]'));
		},
	},
	{
		id: "tracker-edit-note",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, SHOW);
			await page.locator("button:has(svg.lucide-pencil)").first().click({ timeout: 8000 });
			return mark(dialog(page, "Edit Note"));
		},
	},
	{
		id: "tracker-completion",
		async open(page, h) {
			resetModalActor(h.sql);
			await visit(page, h, "/app/feed");
			await h.trpc(page.context(), "episodeTracker.addShow", { tmdbId: 87108, seasonEpisodeCounts: { 1: 5 } });
			await visit(page, h, "/app/tracker/87108");
			await page.getByRole("button", { name: /mark all/i }).first().click();
			const popup = page.locator('[role="dialog"]').last();
			await popup.waitFor({ timeout: 10000 });
			await page.waitForTimeout(1500);
			return mark(popup);
		},
	},
	{
		id: "shuffle-card-detail",
		actor: "populated",
		async open(page, h) {
			await visit(page, h, "/app/shuffle", 5000);
			const vp = page.viewportSize();
			await page.mouse.click(vp.width / 2, vp.height * 0.42);
			return mark(page.locator('[role="dialog"]').last());
		},
	},
];

export const MODALS_NOT_REACHED = [
	{ id: "match-celebration", why: "needs two members swiping right on the same title in a shared shuffle list; no journey written" },
	{ id: "season-picker-modal", why: "src/components/watched/season-picker-modal.tsx has no caller, so no user can open it" },
	{ id: "watchlist-review-dialog", why: "src/components/watchlist/review-dialog.tsx has no caller, so no user can open it" },
	{ id: "command-dialog", why: "src/components/ui/command.tsx CommandDialog has no caller" },
];
