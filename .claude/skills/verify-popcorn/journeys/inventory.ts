// Screen and state inventory. Drives the matrix in inventory-matrix.ts at 390x844 and 1440x900.
// Usage: verify-popcorn drive <abs path>/inventory.ts <group> [group...]
//   groups: empty | first-run | onboarding-faults | onboarding-taste-retry | populated | loading | error | tmdb | bad-url | signed-out | overlay
// Full run on a fresh `vp up`, in this order (data states depend on it):
//   inventory-fixture.ts users
//   inventory.ts empty first-run
//   inventory-fixture.ts films tv tv-extras lists felix social shuffle past-year
//   inventory.ts populated loading error tmdb bad-url signed-out overlay onboarding-faults
//   inventory-sheets.ts   (contact sheets)      inventory-report.ts (json + counts, plain bun)
// Before calling a cell blank, broken or not reached, retry it once with longer waits:
//   inventory.ts <group> --only=<slug regex> --retry
//   inventory.ts onboarding-taste-retry --retry   (needs fresh users, so edit the emails on a second use)
import type { Page, Route } from "playwright-core";
import type { Vp } from "../scripts/lib/vp.ts";
import { createHarness, createWatchlist, type Fault, type Harness, pickTaste, VIEWPORTS } from "./inventory-lib.ts";
import {
	badUrlSpecs, coreTargets, emptySpecs, errorSpecs, loadingSpecs, overlaySpecs, populatedSpecs, signedOutSpecs, tmdbSpecs,
} from "./inventory-matrix.ts";

async function runEmpty(h: Harness) {
	const { vp } = h;
	const fx = h.fixture();
	vp.expect(vp.sql(`select count(*) from watch_event where user_id='vp-user-vera'`, "empty precondition")[0][0] === "0", "Vera has no watch events");
	vp.expect(vp.sql(`select count(*) from earned_achievement where user_id='vp-user-vera'`, "empty precondition")[0][0] === "0", "Vera has no achievements");
	const specs = emptySpecs(fx);
	// Sequential on purpose: two sessions hitting lazy creators at once produced duplicate My Picks lists.
	await h.run(specs.filter((s) => s.slug !== "watchlist-detail"), false);
	await h.run([{ slug: "watchlists-after-visits", route: "/app/watchlists", url: "/app/watchlists", state: "empty", actor: "vera" }], false);
	const page = await h.newPage("vera", 1440);
	await h.open(page, "/app/watchlists");
	await createWatchlist(h, page, "Empty List", false);
	await page.close();
	fx.watchlists.empty = vp.sql(`select id from watchlist where owner_id='vp-user-vera' and name='Empty List'`, "empty list id")[0][0];
	h.saveFixture(fx);
	await h.run(emptySpecs(fx).filter((s) => s.slug === "watchlist-detail"), false);
}

async function runFirstRun(h: Harness) {
	const { vp } = h;
	const fresh = () => vp.context.browser()?.newContext({ baseURL: vp.appUrl, viewport: VIEWPORTS[1440] });
	const ctx = await fresh();
	if (!ctx) throw new Error("no browser");
	const page = await ctx.newPage();
	const snap = (slug: string, route = "/onboarding") => h.snap(page, { slug, route, state: "first-run", actor: "newbie" });

	await h.open(page, "/login");
	await page.getByPlaceholder("you@email.com").fill("newbie@popcorn.test");
	const mailArrives = vp.waitForMail("newbie@popcorn.test", 30000);
	await page.getByRole("button", { name: "Send Magic Link" }).click();
	await page.getByRole("heading", { name: "Magic link sent!" }).waitFor();
	await snap("login-magic-link-sent", "/login");
	const mail = await mailArrives;
	await page.goto(mail.link as string);
	await page.waitForURL("**/onboarding", { timeout: 30000 });
	await h.settle(page);
	await snap("onboarding-1-username");

	await page.getByPlaceholder("cinephile42").fill("veraverify");
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForTimeout(1500);
	await snap("onboarding-1-username-taken");
	await page.getByPlaceholder("cinephile42").fill("newbienate");
	await page.getByRole("button", { name: "Continue" }).click();
	await page.getByRole("heading", { name: "Add a photo" }).waitFor({ timeout: 20000 });
	await page.waitForTimeout(900);
	await snap("onboarding-2-avatar");
	await page.locator('input[type="file"]').setInputFiles({
		name: "a.png",
		mimeType: "image/png",
		buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"),
	});
	await page.waitForTimeout(5000);
	await snap("onboarding-2-avatar-upload-attempt");
	if (await page.getByPlaceholder("cinephile42").isVisible()) {
		vp.step("page reloaded after the upload attempt and onboarding restarted at step 1");
		await page.getByPlaceholder("cinephile42").fill("newbienate");
		await page.getByRole("button", { name: "Continue" }).click();
		await page.waitForTimeout(1500);
		await snap("onboarding-1-reentered-own-username");
		await page.getByRole("heading", { name: "Add a photo" }).waitFor({ timeout: 20000 });
	}
	await page.getByRole("button", { name: "Skip for now" }).click({ timeout: 30000 });
	await page.getByRole("heading", { name: "What do you love watching?" }).waitFor({ timeout: 20000 });
	await page.waitForTimeout(2500);
	await snap("onboarding-3-taste");
	await pickTaste(page);
	await page.getByRole("button", { name: "Skip for now" }).waitFor({ timeout: 30000 });
	await page.waitForTimeout(1000);
	await snap("onboarding-4-favourite");
	await page.getByPlaceholder("Search movies & shows...").fill("Alien");
	await page.waitForTimeout(2500);
	await snap("onboarding-4-favourite-search");
	await page.getByRole("button", { name: "Skip for now" }).click();
	await page.waitForTimeout(1000);
	await snap("onboarding-5-genre");
	await page.getByRole("button", { name: "Skip for now" }).click();
	await page.waitForTimeout(1000);
	await snap("onboarding-6-bio");
	await page.getByPlaceholder("horror enthusiast. no spoilers.").fill("Just got here.");
	await page.getByRole("button", { name: "Finish" }).click();
	await page.waitForURL("**/app/search**", { timeout: 30000 });
	await h.settle(page);
	await page.waitForTimeout(2000);
	await snap("after-onboarding-first-landing", "/app/search");
	await ctx.storageState({ path: `${process.env.VP_STATE}/inventory-auth/newbie.json` });
	await ctx.close();

	const newbieId = vp.sql(`select id from "user" where email='newbie@popcorn.test'`, "newbie id")[0][0];
	const keep = new Set(["watchlists", "feed", "shuffle", "tracker", "tracker-journal", "friends", "settings"]);
	const targets = coreTargets(h.fixture()).filter((t) => keep.has(t.slug));
	await h.run([
		...targets.map((t) => ({ ...t, state: "first-run" as const, actor: "newbie" as const, slug: `after-onboarding-${t.slug}` })),
		{ slug: "after-onboarding-profile-self", route: "/app/profile/$id (self)", url: `/app/profile/${newbieId}`, state: "first-run", actor: "newbie" },
	], false);

	await onboardingFaultCell(h, "onboarder1@popcorn.test", "onboarderone", "loading", "hold-trpc");
	await onboardingFaultCell(h, "onboarder2@popcorn.test", "onboardertwo", "error-500", "trpc-500");
	await onboardingFaultCell(h, "onboarder3@popcorn.test", "onboarderthree", "error-tmdb", "tmdb-down");
}

async function onboardingFaultCell(h: Harness, email: string, username: string, state: "loading" | "error-500" | "error-tmdb", fault: Fault) {
	const { vp } = h;
	const ctx = await vp.context.browser()?.newContext({ baseURL: vp.appUrl, viewport: VIEWPORTS[1440] });
	if (!ctx) throw new Error("no browser");
	const page = await ctx.newPage();
	await h.signInReal(email, page);
	await page.getByPlaceholder("cinephile42").fill(username);
	await page.getByRole("button", { name: "Continue" }).click();
	await page.getByRole("heading", { name: "Add a photo" }).waitFor({ timeout: 20000 });
	await injectFaultForTaste(page, fault);
	await page.getByRole("button", { name: "Skip for now" }).click();
	await page.getByRole("heading", { name: "What do you love watching?" }).waitFor({ timeout: 20000 });
	await page.waitForTimeout((fault === "hold-trpc" ? 2500 : 9000) + (h.retryMode ? 10000 : 0));
	if (fault === "tmdb-down") {
		const genres = page.getByRole("button", { name: /^(Action|Comedy|Drama|Horror|Thriller)$/ });
		for (let i = 0; i < 3; i++) await genres.nth(i).click();
		await page.waitForTimeout(9000);
	}
	await h.snap(page, { slug: "onboarding-3-taste", route: "/onboarding", state, actor: "anon" });
	await ctx.close();
}

async function runOnboardingFaults(h: Harness) {
	const { vp } = h;
	const ctx = await vp.context.browser()?.newContext({ baseURL: vp.appUrl, viewport: VIEWPORTS[1440] });
	if (!ctx) throw new Error("no browser");
	const page = await ctx.newPage();
	const snap = (slug: string, state: "loading" | "error-500") => h.snap(page, { slug, route: "/onboarding", state, actor: "anon" });
	const trpc = /\/api\/trpc\//;
	const fail = (r: Route) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" });

	await h.signInReal("onboarder5@popcorn.test", page);
	await page.getByPlaceholder("cinephile42").fill("onboarderfive");
	await page.getByRole("button", { name: "Continue" }).click();
	await page.getByRole("heading", { name: "Add a photo" }).waitFor({ timeout: 20000 });
	await page.getByRole("button", { name: "Skip for now" }).click();

	await page.route(/saveTasteProfile/, fail);
	await pickTaste(page);
	await page.waitForTimeout(3000);
	await snap("onboarding-3-taste-save-failed", "error-500");
	await page.unroute(/saveTasteProfile/);
	// The error toast sits over Continue and hovering pauses its timer, so leave it before clicking.
	await page.mouse.move(5, 5);
	await page.waitForTimeout(6000);
	await page.getByRole("button", { name: /Continue/ }).click();
	await page.getByRole("button", { name: "Skip for now" }).waitFor({ timeout: 30000 });

	await page.route(trpc, () => {});
	await page.getByPlaceholder("Search movies & shows...").fill("Alien");
	await page.waitForTimeout(3000);
	await snap("onboarding-4-favourite-search", "loading");
	await page.unroute(trpc);
	await page.route(trpc, fail);
	await page.getByPlaceholder("Search movies & shows...").fill("Aliens");
	await page.waitForTimeout(10000);
	await snap("onboarding-4-favourite-search", "error-500");
	await page.getByRole("button", { name: "Skip for now" }).click();
	await page.waitForTimeout(1000);
	await page.getByRole("button", { name: "Skip for now" }).click();
	await page.waitForTimeout(1000);
	await page.getByPlaceholder("horror enthusiast. no spoilers.").fill("Trying to finish.");
	await page.getByRole("button", { name: "Finish" }).click();
	await page.waitForTimeout(3000);
	await snap("onboarding-6-bio-save-failed", "error-500");
	await ctx.close();
}

async function injectFaultForTaste(page: Page, fault: Fault) {
	if (fault === "hold-trpc") await page.route(/\/api\/trpc\//, () => {});
	if (fault === "trpc-500") await page.route(/\/api\/trpc\//, (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
	if (fault === "tmdb-down") {
		await page.route(/image\.tmdb\.org/, (r) => r.abort());
		await page.route(/\/api\/trpc\/.*tasteProfile\.(getFeed|search)/, (r) => r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
	}
}

const GROUPS: Record<string, (h: Harness) => Promise<void>> = {
	empty: runEmpty,
	"first-run": runFirstRun,
	"onboarding-faults": runOnboardingFaults,
	"onboarding-taste-retry": async (h) => {
		await onboardingFaultCell(h, "onboarder6@popcorn.test", "onboardersix", "loading", "hold-trpc");
		await onboardingFaultCell(h, "onboarder7@popcorn.test", "onboarderseven", "error-500", "trpc-500");
	},
	populated: (h) => h.run(populatedSpecs(h.fixture())),
	loading: (h) => h.run(loadingSpecs(h.fixture())),
	error: (h) => h.run(errorSpecs(h.fixture())),
	tmdb: (h) => h.run(tmdbSpecs(h.fixture())),
	"bad-url": (h) => h.run(badUrlSpecs(h.fixture())),
	"signed-out": (h) => h.run(signedOutSpecs(h.fixture())),
	overlay: (h) => h.run(overlaySpecs(h.fixture())),
};

export default async function inventory(vp: Vp, args: string[]) {
	const h = await createHarness(vp, args.includes("--retry"));
	const only = args.find((a) => a.startsWith("--only="))?.slice(7);
	try {
		for (const group of args.filter((a) => !a.startsWith("--"))) {
			vp.step(`inventory group ${group}`);
			vp.expect(!!GROUPS[group], `known group ${group}`);
			if (only) {
				const pick = { populated: populatedSpecs, loading: loadingSpecs, error: errorSpecs, tmdb: tmdbSpecs, "bad-url": badUrlSpecs, "signed-out": signedOutSpecs, overlay: overlaySpecs, empty: emptySpecs }[group];
				const re = new RegExp(only);
				await h.run((pick as typeof populatedSpecs)(h.fixture()).filter((s) => re.test(s.slug)));
			} else {
				await GROUPS[group](h);
			}
		}
	} finally {
		await h.close();
	}
}
