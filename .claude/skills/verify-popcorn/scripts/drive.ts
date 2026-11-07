// Runs one journey: `bun drive.ts <journey.ts> [args...]` (invoked by `verify-popcorn drive`).
// A journey module default-exports `async (vp, args) => void`; throwing fails the journey.
import { basename } from "node:path";
import { createVp } from "./lib/vp.ts";

const [file, ...args] = process.argv.slice(2);
if (!file) {
	console.error("usage: bun drive.ts <journey.ts> [args...]");
	process.exit(2);
}
const name = basename(file, ".ts");
const { default: journey } = await import(file);
const { vp, close } = await createVp(name);
let ok = false;
try {
	await journey(vp, args);
	ok = true;
} catch (err) {
	console.error(`JOURNEY ${name} FAILED: ${(err as Error).stack ?? err}`);
} finally {
	await close(ok);
	console.log(`${ok ? "PASS" : "FAIL"} ${name}  evidence: ${vp.dir}`);
}
process.exit(ok ? 0 : 1);
