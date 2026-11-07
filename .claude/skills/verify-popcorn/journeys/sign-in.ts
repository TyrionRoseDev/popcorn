// Feature: sign-in (features/sign-in.md). Usage: verify-popcorn login [email]
// Signs in through /login + the captured magic link and saves the session for later journeys.
import type { Vp } from "../scripts/lib/vp.ts";

export default async function signIn(vp: Vp, args: string[]) {
	const email = args[0] ?? "vera@popcorn.test";
	await vp.context.clearCookies();
	vp.step("unauthenticated /app/feed redirects to /login");
	await vp.goto("/app/feed");
	await vp.page.waitForURL((u) => u.pathname === "/login");
	vp.expect(new URL(vp.page.url()).pathname === "/login", "auth guard sent anonymous user to /login");

	const landed = await vp.signIn(email);
	const path = new URL(landed).pathname;
	vp.expect(path === "/app/search" || path === "/onboarding", `landed on ${path} after magic link`);
	await vp.capture("signed-in");

	const rows = vp.sql(
		`select u.email, count(s.id) from "user" u join session s on s.user_id = u.id where u.email = '${email}' group by u.email`,
		"session row for signed-in user",
	);
	vp.expect(rows.length === 1 && Number(rows[0][1]) >= 1, `DB has a session row for ${email}`);
}
