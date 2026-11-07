#!/usr/bin/env bash
# Regenerates docs/redesign/phase-1/06-baselines.json. Read docs/redesign/phase-1/06-baselines.md first.
# Needs a verify-popcorn run:  VP_RUN_ID=<id> docs/redesign/phase-1/tools/baselines.sh all
# Subcommands: tools copy build build-map prod-up prod-down seed static tests axe lighthouse runtime keyboard motion timing merge tables all
set -euo pipefail

TOOLS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS_SRC/../../../.." && pwd)"
VP="$REPO/.claude/skills/verify-popcorn/scripts/verify-popcorn"
: "${VP_RUN_ID:?set VP_RUN_ID to a live verify-popcorn run; never use the shared current pointer}"
export VP_RUN_ID

VP_HOME="${VERIFY_POPCORN_HOME:-$HOME/.cache/verify-popcorn}"
RUN_ENV="$VP_HOME/runs/$VP_RUN_ID/env"
[[ -f "$RUN_ENV" ]] || { echo "no run state at $RUN_ENV" >&2; exit 1; }
# shellcheck disable=SC1090
source "$RUN_ENV"

WORK="${BASELINE_WORK:-$EVIDENCE/baselines}"
COPY="${BASELINE_COPY:-$WORK/build-copy}"
TOOLS="${BASELINE_TOOLS:-$VP_HOME/baseline-tools}"
MAP_COPY="${BASELINE_MAP_COPY:-$COPY-map}"
PROD_ENV="$WORK/prod.env"
OUT_JSON="$REPO/docs/redesign/phase-1/06-baselines.json"
mkdir -p "$WORK/sections" "$WORK/auth" "$WORK/shots" "$WORK/lighthouse"

chromium() {
	find "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}" -maxdepth 4 -type f \
		\( -name chrome-headless-shell -o -name headless_shell \) | sort -V | tail -1
}

tmdb_token() {
	[[ -n "${TMDB_READ_ACCESS_TOKEN:-}" ]] && { echo "$TMDB_READ_ACCESS_TOKEN"; return; }
	grep -E '^TMDB_READ_ACCESS_TOKEN=' "$REPO/.env" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'
}

cmd_tools() {
	mkdir -p "$TOOLS"
	[[ -f "$TOOLS/package.json" ]] || echo '{"name":"popcorn-baseline-tools","private":true,"type":"module"}' >"$TOOLS/package.json"
	(cd "$TOOLS" && PUPPETEER_SKIP_DOWNLOAD=1 bun add axe-core@4.11.0 lighthouse@12.8.2 playwright-core@1.64.1 >/dev/null)
}

cmd_copy() {
	mkdir -p "$COPY"
	rsync -a --delete --exclude node_modules --exclude .git --exclude .output --exclude dist \
		--exclude '.env' --exclude '.env.*' --exclude .tanstack "$REPO/" "$COPY/"
	[[ -d "$COPY/node_modules" ]] || cp -cR "$REPO/node_modules" "$COPY/node_modules"
}

cmd_build() {
	cmd_copy
	(cd "$COPY" && rm -rf .output dist && bun run build) >"$WORK/build.log" 2>&1
	echo "build ok, log at $WORK/build.log"
}

cmd_build_map() {
	# Sourcemapped twin of the build, used only to attribute bytes to packages. Never served or measured.
	mkdir -p "$MAP_COPY"
	rsync -a --delete --exclude node_modules --exclude .output --exclude dist "$COPY/" "$MAP_COPY/"
	[[ -d "$MAP_COPY/node_modules" ]] || cp -cR "$COPY/node_modules" "$MAP_COPY/node_modules"
	(cd "$MAP_COPY" && rm -rf .output dist && bun x vite build --sourcemap) >"$WORK/build-map.log" 2>&1
	echo "sourcemapped build ok"
}

prod_pid() { [[ -f "$PROD_ENV" ]] && grep -E '^PROD_PID=' "$PROD_ENV" | cut -d= -f2 || true; }

cmd_prod_up() {
	local pid; pid="$(prod_pid)"
	if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then echo "prod already up"; cat "$PROD_ENV"; return; fi
	local port secret
	port="$(bun -e 'const s=Bun.listen({hostname:"127.0.0.1",port:0,socket:{data(){}}});console.log(s.port);s.stop(true)')"
	secret="$(openssl rand -hex 32)"
	(
		cd "$COPY"
		env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production \
			DATABASE_URL="$DB_URL" \
			BETTER_AUTH_URL="http://localhost:$port" \
			BETTER_AUTH_SECRET="$secret" \
			PORT="$port" \
			RESEND_API_KEY=re_verify_popcorn_dummy \
			RESEND_BASE_URL="http://127.0.0.1:$MAIL_PORT" \
			RESEND_FROM_EMAIL=verify@popcorn.test \
			UPLOADTHING_TOKEN=placeholder \
			CRON_SECRET=verify-popcorn-cron \
			TMDB_READ_ACCESS_TOKEN="$(tmdb_token)" \
			nohup bun --no-env-file .output/server/index.mjs >"$WORK/prod.log" 2>&1 &
		printf 'PROD_PID=%s\nPROD_PORT=%s\nPROD_URL=http://localhost:%s\n' "$!" "$port" "$port" >"$PROD_ENV"
	)
	for _ in $(seq 1 60); do
		[[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/api/health")" == 200 ]] && { cat "$PROD_ENV"; return; }
		sleep 0.5
	done
	tail -30 "$WORK/prod.log" >&2
	exit 1
}

cmd_prod_down() {
	local pid; pid="$(prod_pid)"
	[[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
	rm -f "$PROD_ENV"
}

browser() {
	# shellcheck disable=SC1090
	source "$PROD_ENV"
	env BASELINE_WORK="$WORK" BASELINE_TOOLS="$TOOLS" BASELINE_APP="$PROD_URL" BASELINE_PROD_PID="$PROD_PID" \
		BASELINE_CHROMIUM="$(chromium)" BASELINE_CONTAINER="$CONTAINER" BASELINE_MAIL_DIR="$MAIL_DIR" \
		BASELINE_TMDB="$(tmdb_token)" \
		node "$TOOLS_SRC/baselines.browser.mjs" "$@"
}

cmd_static() { env BASELINE_WORK="$WORK" BASELINE_COPY="$COPY" BASELINE_MAP_COPY="$MAP_COPY" BASELINE_REPO="$REPO" bun "$TOOLS_SRC/baselines.static.ts" static; }
cmd_tests() { env BASELINE_WORK="$WORK" BASELINE_COPY="$COPY" BASELINE_REPO="$REPO" bun "$TOOLS_SRC/baselines.static.ts" tests; }
# Quiet-machine re-run of everything measured in time. Other sections stay as merged in 06-baselines.json.
cmd_timing() {
	cmd_tools
	[[ -d "$COPY/.output/public/assets" ]] || cmd_build
	cmd_prod_up
	trap cmd_prod_down EXIT
	browser seed
	browser runtime
	browser lighthouse perf ${BASELINE_LH_ROUTES:-}
	cmd_merge
}

cmd_tables() { env BASELINE_WORK="$WORK" BASELINE_OUT="$OUT_JSON" BASELINE_REPO="$REPO" bun "$TOOLS_SRC/baselines.static.ts" tables; }
cmd_merge() { env BASELINE_WORK="$WORK" BASELINE_OUT="$OUT_JSON" BASELINE_REPO="$REPO" bun "$TOOLS_SRC/baselines.static.ts" merge; }

case "${1:-}" in
	tools) cmd_tools ;;
	copy) cmd_copy ;;
	build) cmd_build ;;
	build-map) cmd_build_map ;;
	prod-up) cmd_prod_up ;;
	prod-down) cmd_prod_down ;;
	static) cmd_static ;;
	tests) cmd_tests ;;
	merge) cmd_merge ;;
	tables) cmd_tables ;;
	seed | axe | lighthouse | runtime | keyboard | motion) shift_cmd="$1"; shift; browser "$shift_cmd" "$@" ;;
	timing) cmd_timing ;;
	all)
		cmd_tools
		cmd_build
		cmd_build_map
		cmd_static
		cmd_tests
		cmd_prod_up
		trap cmd_prod_down EXIT
		for s in seed runtime keyboard motion axe; do browser "$s"; done
		browser lighthouse quality
		browser lighthouse perf
		cmd_merge
		;;
	*) sed -n 2,4p "${BASH_SOURCE[0]}"; exit 2 ;;
esac
