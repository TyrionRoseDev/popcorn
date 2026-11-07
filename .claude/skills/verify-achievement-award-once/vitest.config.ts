// Standalone vitest config for this verification only, so the repo's normal
// `bun run test` never picks up the check and the check never loads the app's
// Vite plugins (TanStack Start, nitro, tailwind).
import { resolve } from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const repoRoot = resolve(__dirname, "../../..");

export default defineConfig({
	root: repoRoot,
	plugins: [tsconfigPaths({ projects: [resolve(repoRoot, "tsconfig.json")] })],
	test: {
		include: [".claude/skills/verify-achievement-award-once/check/*.verify.ts"],
		environment: "node",
	},
});
