# Worker contract

Every agent that changes Popcorn follows this page. Your kickoff names your slice. This page names the rules every slice shares.

## The goal

Popcorn is a film and TV diary with a drive-in theme. The owner wants it to work end to end and feel like one app. Read `docs/redesign/program/PLAN.md` for the program and `docs/redesign/phase-1/00-gate-1.md` for the diagnosis. Finding ids such as F52 refer to `docs/redesign/phase-1/04-logic-audit.md`.

## Before you change anything

1. Read `AGENTS.md` and load the skills it lists for the areas you touch.
2. Read `.claude/skills/verify-popcorn/SKILL.md` and `features/README.md` beside it.
3. Run `bun install` in your checkout.
4. Record the current behaviour of the flow you will change. Write or reuse a journey in `.claude/skills/verify-popcorn/journeys/`, run it, and keep the evidence path. A journey asserts the behaviour the user should get, so it fails before your fix and passes after.

## Rules

- Use Bun.
- Change only the files your kickoff allows. If you must touch another file, say why in your report.
- Keep the change to the slice. Note anything else you find as a follow-up in your report. Do not fix it.
- Make illegal states unrepresentable where the types allow it. Validate at the tRPC boundary and trust internal types.
- Write no comments that narrate. Keep a comment only for a reason the code cannot show.
- Never touch production, `popcorn.tyrion.uk`, or the `DATABASE_URL` in `.env`.
- Never merge to `main`, deploy, or force-push a shared branch.

## Running the app

- Always pass `VP_RUN_ID` with the id that `vp up` printed. Never rely on the shared current pointer.
- Never bring down a run you did not start. Run `vp down` on yours when you finish, including after a failure.
- The machine is shared with other workers. Run one browser at a time, at device scale 1.
- If a check times out, retry once before you call it a product failure.

## Proof

Your PR is ready only when all of these hold:

- `bun run typecheck`, `bunx biome ci .` and `bun run test` pass. If a failure existed before your change, show that it fails on your base too.
- The journey that records the flow fails on your base and passes on your head. Paste both RESULT lines.
- A `vp sql` check shows the DB rows match what the UI shows.
- Screenshots at 390 and 1440 wide show the changed screens.

## Delivering

- Branch from the commit your checkout starts on. Name the branch `<type>/<slice>`.
- Use Conventional Commits. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Open one PR into `next` with `gh pr create --base next`, ready and not draft. Use the sections Why, What changed, Scope, Blast radius and Verification. Keep it under 40 lines. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Your final reply is under 30 lines. It says what changed, the failing and passing RESULT lines, and any follow-ups. The last line is `PR <full URL>, head <SHA>, checks and reviews <state>`.
