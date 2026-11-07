// Reproduces audit findings F52 (private title in the heatmap) and F57 (unvalidated companion id).
// Usage: verify-popcorn drive privacy-repro. Needs a fresh run. Expectations assert the safe behaviour,
// so this journey FAILS while a finding is live and passes once it is fixed.
import type { Vp } from "../scripts/lib/vp.ts";

const PRIVATE_TITLE = "The Matrix";

async function trpcQuery(vp: Vp, path: string, input: unknown) {
	return vp.page.evaluate(
		async ([p, i]) => {
			const q = encodeURIComponent(JSON.stringify({ json: i }));
			const r = await fetch(`/api/trpc/${p}?input=${q}`);
			return { status: r.status, body: await r.text() };
		},
		[path, input] as const,
	);
}

async function trpcMutation(vp: Vp, path: string, input: unknown) {
	return vp.page.evaluate(
		async ([p, i]) => {
			const r = await fetch(`/api/trpc/${p}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ json: i }),
			});
			return { status: r.status, body: await r.text() };
		},
		[path, input] as const,
	);
}

async function switchUser(vp: Vp, email: string) {
	await vp.context.clearCookies();
	await vp.signIn(email);
}

export default async function privacyRepro(vp: Vp) {
	const { page } = vp;
	vp.sql(
		`insert into "user" (id, name, email, email_verified, username, onboarding_completed, created_at, updated_at)
		 values ('vp-user-mallory','Mallory','mallory@popcorn.test',true,'mallory',true,now(),now())
		 on conflict (email) do nothing`,
		"setup: a stranger with no friendship to Vera",
	);
	vp.sql(
		`insert into block (id, blocker_id, blocked_id, created_at)
		 values ('vp-block-vera-mallory','vp-user-vera','vp-user-mallory',now()) on conflict do nothing`,
		"setup: Vera has blocked Mallory",
	);

	vp.step("Vera logs The Matrix as Private through the UI");
	await vp.signIn("vera@popcorn.test");
	await vp.goto("/app/title/movie/603");
	const watched = page.locator("div.text-center", { has: page.getByText("Watched", { exact: true }) }).getByRole("button");
	await watched.waitFor({ timeout: 30000 });
	await page.waitForLoadState("networkidle");
	await watched.click();
	const dialog = page.getByRole("dialog", { name: "Review" });
	await dialog.waitFor();
	await dialog.getByRole("button", { name: "Rate 4 stars" }).click();
	await dialog.getByPlaceholder("Share your thoughts…").fill("private thoughts");
	await dialog.getByRole("button", { name: /^Private/ }).click();
	await vp.capture("vera-private-selected");
	await dialog.getByRole("button", { name: "Save & Done" }).click();
	await dialog.waitFor({ state: "hidden", timeout: 15000 });
	const rows = vp.sql(
		`select title_name, visibility from watch_event where user_id='vp-user-vera' and tmdb_id=603`,
		"precondition: the log is stored as private",
	);
	vp.expect(rows.length === 1 && rows[0][1] === "private", `Vera's log is private (got ${JSON.stringify(rows)})`);

	vp.step("Felix, a friend, opens Vera's profile and reads watch activity");
	await switchUser(vp, "felix@popcorn.test");
	await vp.goto("/app/profile/vp-user-vera");
	await vp.capture("felix-views-vera-profile");
	const activity = await trpcQuery(vp, "friend.watchActivity", { userId: "vp-user-vera" });
	vp.sql(`select 'friend.watchActivity as Felix: ${activity.body.replaceAll("'", "''").slice(0, 400)}'`, "F52 response body");
	const f52Safe = !activity.body.includes(PRIVATE_TITLE);

	vp.step("Mallory, blocked by Vera and not a friend, sends a crafted watchEvent.create");
	await switchUser(vp, "mallory@popcorn.test");
	await vp.goto("/app/search");
	const before = vp.sql(`select count(*) from watch_event where user_id='vp-user-vera'`, "F57 before: Vera's events")[0][0];
	const beforeN = vp.sql(`select count(*) from notification where recipient_id='vp-user-vera'`, "F57 before: Vera's notifications")[0][0];
	const crafted = await trpcMutation(vp, "watchEvent.create", {
		tmdbId: 550,
		mediaType: "movie",
		titleName: "Fight Club",
		visibility: "public",
		companions: [{ friendId: "vp-user-vera", name: "Vera" }],
	});
	vp.step(`crafted call returned HTTP ${crafted.status}`);
	const after = vp.sql(
		`select count(*) from watch_event where user_id='vp-user-vera'`,
		"F57 after: Vera's events",
	)[0][0];
	const afterN = vp.sql(`select count(*) from notification where recipient_id='vp-user-vera'`, "F57 after: Vera's notifications")[0][0];
	vp.sql(
		`select title_name, visibility, origin_event_id is not null as reciprocal from watch_event where user_id='vp-user-vera' order by created_at`,
		"F57 rows now in Vera's diary",
	);
	vp.sql(`select type, actor_id from notification where recipient_id='vp-user-vera' order by created_at`, "F57 notifications");
	const f57Safe = before === after && beforeN === afterN;

	vp.step("Vera sees what Mallory wrote into her account");
	await switchUser(vp, "vera@popcorn.test");
	await vp.goto("/app/profile/vp-user-vera");
	await vp.capture("vera-after-crafted-call");

	const f52 = `F52: a friend's watchActivity omits Vera's private title (response: ${activity.body.slice(0, 200)})`;
	const f57 = `F57: a blocked stranger cannot write to Vera's account (events ${before} to ${after}, notifications ${beforeN} to ${afterN})`;
	vp.step(`${f52Safe ? "SAFE" : "LIVE"} ${f52}`);
	vp.step(`${f57Safe ? "SAFE" : "LIVE"} ${f57}`);
	vp.expect(f52Safe && f57Safe, "F52 and F57 are both fixed");
}
