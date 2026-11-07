// Feature: phase-1 probe. A private log of a film on a shared list, seen from the friend's side.
// Usage: verify-popcorn drive probe-private-shared-list
import type { Vp } from "../scripts/lib/vp.ts";
import { actor, addToList, arcade, bodyText, capture, fixtureUser, psql, runFlow } from "./flow-lib.ts";

export default async function probe(vp: Vp) {
	const key = `leak${Date.now().toString(36)}`;
	fixtureUser(`${key}pal`);
	fixtureUser(key, [`${key}pal`]);
	const a = await actor(vp, key);
	const pal = await actor(vp, `${key}pal`);
	const rec = await runFlow(vp, a, { job: "probe", entry: "private log on a shared list, friend's view before and after", start: "/app/watchlists" }, async (f) => {
		await a.goto("/app/watchlists");
		await f.popup();
		await a.page.getByRole("button", { name: /New Watchlist/ }).click();
		await a.page.getByPlaceholder("e.g. Friday Night Horror").fill("Together");
		await a.page.getByPlaceholder("Search username...").fill(pal.username);
		await a.settle();
		await a.page.getByRole("button", { name: new RegExp(pal.username) }).first().click();
		await a.page.getByRole("button", { name: "Create", exact: true }).click();
		await a.settle();
		await addToList(a, f, { type: "movie", id: 603, name: "The Matrix" }, "Together");
		const list = psql(`select id from watchlist where owner_id='${a.id}' and name='Together'`)[0][0];
		const items = () => psql(`select wi.tmdb_id, wi.watched from watchlist_item wi where wi.watchlist_id='${list}'`);
		const g = f.as(pal);
		await pal.goto(`/app/watchlists/${list}`);
		await g.popup();
		f.observe("friendSeesTitleBefore", (await bodyText(pal.page)).includes("The Matrix"));
		f.observe("itemsBefore", items());
		f.rec.evidence.push(`${f.rec.journey}/${await capture(vp, pal, "friend-list-before")}.png`);

		await a.goto("/app/title/movie/603");
		await f.popup();
		await arcade(a.page, "Watched").click();
		const d = a.page.getByRole("dialog", { name: "Review" });
		await d.waitFor();
		await d.getByRole("button", { name: "Rate 4 stars" }).click();
		await d.getByRole("button", { name: /^Private/ }).click();
		await d.getByRole("button", { name: "Save & Done" }).click();
		await d.waitFor({ state: "hidden" });
		await a.settle();
		await f.popup();
		f.observe("visibility", psql(`select visibility from watch_event where user_id='${a.id}'`));
		f.observe("itemsAfter", items());

		await pal.goto(`/app/watchlists/${list}`);
		await g.popup();
		f.observe("friendSeesTitleAfter", (await bodyText(pal.page)).includes("The Matrix"));
		f.rec.evidence.push(`${f.rec.journey}/${await capture(vp, pal, "friend-list-after")}.png`);
		await pal.goto("/app/search");
		await g.popup();
		await pal.page.getByRole("banner").getByRole("button").nth(1).click();
		await pal.settle();
		await pal.page.getByText(/marked The Matrix as watched/).waitFor();
		const text = (await bodyText(pal.page)).replace(/\s+/g, " ");
		f.observe("friendBell", text.slice(Math.max(0, text.indexOf("Notifications")), text.indexOf("Notifications") + 300));
		f.observe("friendNotificationRows", psql(`select type, data->>'titleName' from notification where recipient_id='${pal.id}' and type='item_watched'`));
		f.rec.evidence.push(`${f.rec.journey}/${await capture(vp, pal, "friend-bell")}.png`);
	}, [pal]);
	console.log(JSON.stringify(rec.observations, null, 1));
	await a.ctx.close();
	await pal.ctx.close();
}
