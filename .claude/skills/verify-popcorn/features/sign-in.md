# Sign in

A visitor enters their email on `/login` and receives a magic link. Opening the link signs them in. An onboarded user lands on `/app/search` and a new user lands on `/onboarding`. Anonymous visits to any `/app/*` page redirect to `/login`.

## Sub-features

- `signin-guard`: anonymous `/app/*` redirects to `/login`.
- `signin-request`: submitting the email shows "Magic link sent!" and sends one email.
- `signin-verify`: opening the emailed link creates a session and lands on `/app/search`.
- `signin-new-user`: an unknown email creates the account and lands on `/onboarding` (Username step).
- `signin-resend`: "Didn't get it? Resend" sends a second email.
- `signout`: Sign out (header menu or mobile drawer) returns to `/`.

## How to get to it (user POV)

- Open `/login` directly, or follow the sign-in link on the landing page `/`.
- Open any `/app/...` URL while signed out, which redirects to `/login`.

## Driving it with verify-popcorn

Preconditions:

- `vp doctor` exits 0.
- `vera@popcorn.test` exists and is onboarded (seed).

- **Guard.** Open `/app/feed` signed out. Run `vp login` (journey `sign-in.ts`, step 1). The URL ends at `/login`.
- **Request link.** Fill the `you@email.com` placeholder and click the button `Send Magic Link`. The heading `Magic link sent!` appears. `vp mail --last` shows subject `Your Popcorn sign-in link` and a `link` of the form `<APP_URL>/api/auth/magic-link/verify?token=…&callbackURL=/app/search`.
- **Verify.** Open the captured link. The browser lands on `/app/search?q=&type=all&sort=relevance&page=1`. `vp sql "select count(*) from session s join \"user\" u on u.id=s.user_id where u.email='vera@popcorn.test'"` returns at least 1.
- **New user (not yet run).** Run `vp login newbie@popcorn.test`. The journey accepts `/onboarding` as a landing page. The page shows the Username step, and `vp sql "select onboarding_completed from \"user\" where email='newbie@popcorn.test'"` returns `f`.
- **Proof.** The whole flow is proven by `vp login`. Evidence is `sign-in/01-magic-link-sent.png`, `02-signed-in.png`, `mail.json` and the session-row check in `db.log`. The resend and sign-out paths have no script yet.

## Gotchas

- Wait for hydration with `vp.goto`/`vp.settled`. Filling the email before React hydrates leaves the input empty, and the click does nothing.
- Emails only reach the local mail sink. If `vp mail` is empty, check `vp logs mail` and `vp logs app` for `Failed to send magic link email`.
- `BETTER_AUTH_URL` is the run's `http://localhost:<port>`. Links point at `localhost`, not `127.0.0.1`, and cookies are host-scoped, so always use `APP_URL` exactly.
- Sign-in saves `runs/<RUN_ID>/auth.json`. Later journeys reuse that session. Set `VP_FRESH_SESSION=1` to start a journey signed out.
