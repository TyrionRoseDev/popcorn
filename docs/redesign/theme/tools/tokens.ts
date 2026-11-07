// Proposed semantic tokens and the contrast check behind docs/redesign/theme/TOKENS.md.
import { writeFileSync } from "node:fs";

// Run: bun docs/redesign/theme/tools/tokens.ts            prints the contrast table, exits 1 on a failure
//      bun docs/redesign/theme/tools/tokens.ts --css <out> also writes the tokens as CSS variables

export const colour = {
	bg: "#08080F",
	"surface-1": "#11111D",
	"surface-2": "#1A1A2A",
	"surface-3": "#24243A",
	border: "#2C2C44",
	"border-strong": "#6A6888",
	"text-1": "#F4EFE3",
	"text-2": "#C4BEB0",
	"text-3": "#9D988D",
	accent: "#FFB800",
	"accent-text": "#FFC53D",
	"on-accent": "#1B1300",
	danger: "#FF7A7A",
	"on-danger": "#1F0606",
	success: "#5DD39E",
	focus: "#00E5FF",
	"neon-pink": "#FF2D78",
	"neon-cyan": "#00E5FF",
	bulb: "#FFB800",
	"bulb-off": "#5A4515",
	"marquee-panel": "#F6EFD9",
	"marquee-letter": "#14110A",
	"marquee-letter-red": "#A3121A",
	ticket: "#EFD9A0",
	"ticket-ink": "#2A1C02",
	"ticket-ink-2": "#6A5020",
} as const;

type Token = keyof typeof colour;
type Kind = "text" | "large" | "ui";

const MIN: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 };

const pairs: Array<[Token, Token, Kind, string]> = [
	["text-1", "bg", "text", "Body text on the page"],
	["text-1", "surface-1", "text", "Body text on a card"],
	["text-1", "surface-2", "text", "Body text in a dialog or input"],
	["text-1", "surface-3", "text", "Body text on a hovered or selected row"],
	["text-2", "bg", "text", "Secondary text on the page"],
	["text-2", "surface-1", "text", "Secondary text on a card"],
	["text-2", "surface-2", "text", "Secondary text in a dialog"],
	["text-2", "surface-3", "text", "Secondary text on a selected row"],
	["text-3", "bg", "text", "Meta text and placeholders on the page"],
	["text-3", "surface-1", "text", "Meta text on a card"],
	["text-3", "surface-2", "text", "Placeholder in an input"],
	["text-3", "surface-3", "text", "Meta text on a selected row"],
	["on-accent", "accent", "text", "Primary button label"],
	["accent-text", "bg", "text", "Amber text, active nav, on the page"],
	["accent-text", "surface-1", "text", "Amber text and stars on a card"],
	["accent-text", "surface-2", "text", "Amber text in a dialog"],
	["danger", "bg", "text", "Error text on the page"],
	["danger", "surface-1", "text", "Error text on a card"],
	["danger", "surface-2", "text", "Error text in a dialog or under an input"],
	["on-danger", "danger", "text", "Destructive confirm button label"],
	["success", "surface-1", "text", "Success text on a card"],
	["success", "surface-2", "text", "Success text in a toast"],
	["neon-pink", "bg", "large", "Neon display text, landing and celebrations"],
	["neon-cyan", "bg", "large", "Neon display text"],
	["marquee-letter", "marquee-panel", "text", "Marquee letters on the lit panel"],
	["marquee-letter-red", "marquee-panel", "large", "Red second line on the lit panel, 20 px bold"],
	["ticket-ink", "ticket", "text", "Stub text"],
	["ticket-ink-2", "ticket", "text", "Stub meta text"],
	["focus", "bg", "ui", "Focus ring against the page"],
	["focus", "surface-2", "ui", "Focus ring against a dialog"],
	["border-strong", "surface-1", "ui", "Input and secondary button edge on a card"],
	["border-strong", "surface-2", "ui", "Input edge in a dialog"],
	["accent", "bg", "ui", "Primary button edge against the page"],
	["bulb", "bg", "ui", "Lit bulb against the page"],
];

function channel(v: number) {
	const c = v / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
	const n = Number.parseInt(hex.slice(1), 16);
	return (
		0.2126 * channel((n >> 16) & 255) +
		0.7152 * channel((n >> 8) & 255) +
		0.0722 * channel(n & 255)
	);
}

export function contrast(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const rows = pairs.map(([fg, bg, kind, use]) => {
	const ratio = contrast(colour[fg], colour[bg]);
	return { fg, bg, kind, use, ratio, pass: ratio >= MIN[kind] };
});

console.log("| Foreground | Background | Use | Ratio | Needs | Result |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
	console.log(
		`| \`${r.fg}\` ${colour[r.fg]} | \`${r.bg}\` ${colour[r.bg]} | ${r.use} | ${r.ratio.toFixed(2)}:1 | ${MIN[r.kind]}:1 | ${r.pass ? "Pass" : "FAIL"} |`,
	);
}

const cssFlag = process.argv.indexOf("--css");
if (cssFlag !== -1) {
	const out = process.argv[cssFlag + 1];
	const vars = Object.entries(colour)
		.map(([k, v]) => `\t--pc-${k}: ${v};`)
		.join("\n");
	writeFileSync(out, `.pc {\n${vars}\n}\n`);
}

const failures = rows.filter((r) => !r.pass);
if (failures.length > 0) {
	console.error(`${failures.length} pair(s) below the minimum`);
	process.exit(1);
}
