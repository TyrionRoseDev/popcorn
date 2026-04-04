import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { titleQuote } from "#/db/schema";

const WIKIQUOTE_API = "https://en.wikiquote.org/w/api.php";
const QUOTE_PARSER_VERSION = 1;
const WIKIQUOTE_TIMEOUT_MS = 1200;

type MediaType = "movie" | "tv";
type TitleQuoteResult = { quote: string; character: string | null };
type WikiquoteRequestResult<T> =
	| { status: "ok"; data: T | null }
	| { status: "error"; error: unknown };
type WikiquoteLookupResult =
	| { status: "found"; result: TitleQuoteResult }
	| { status: "miss" }
	| { status: "error"; error: unknown };

export async function getTitleQuote(
	tmdbId: number,
	mediaType: MediaType,
	titleName: string,
	year: string,
): Promise<TitleQuoteResult | null> {
	const cached = await db.query.titleQuote.findFirst({
		where: and(
			eq(titleQuote.tmdbId, tmdbId),
			eq(titleQuote.mediaType, mediaType),
		),
	});

	if (cached && cached.parserVersion === QUOTE_PARSER_VERSION) {
		if (!cached.quote) return null;

		return { quote: cached.quote, character: cached.character };
	}

	const staleCachedQuote = cached?.quote
		? { quote: cached.quote, character: cached.character }
		: null;

	try {
		const lookup = await fetchWikiquote(titleName, year, mediaType);

		if (lookup.status === "error") {
			console.error("[title-quote] Wikiquote lookup failed", {
				tmdbId,
				mediaType,
				titleName,
				year,
				error: lookup.error,
			});
			return staleCachedQuote;
		}

		await db
			.insert(titleQuote)
			.values({
				tmdbId,
				mediaType,
				quote: lookup.status === "found" ? lookup.result.quote : null,
				character: lookup.status === "found" ? lookup.result.character : null,
				parserVersion: QUOTE_PARSER_VERSION,
				checkedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: [titleQuote.tmdbId, titleQuote.mediaType],
				set: {
					quote: lookup.status === "found" ? lookup.result.quote : null,
					character: lookup.status === "found" ? lookup.result.character : null,
					parserVersion: QUOTE_PARSER_VERSION,
					checkedAt: new Date(),
				},
			});

		return lookup.status === "found" ? lookup.result : null;
	} catch (error) {
		console.error("[title-quote] Failed to cache Wikiquote result", {
			tmdbId,
			mediaType,
			titleName,
			year,
			error,
		});
		return staleCachedQuote;
	}
}

// ---------------------------------------------------------------------------
// Wikiquote fetching
// ---------------------------------------------------------------------------

async function fetchWikiquote(
	title: string,
	year: string,
	mediaType: MediaType,
): Promise<WikiquoteLookupResult> {
	const kind = mediaType === "tv" ? "TV series" : "film";

	const candidates = [
		title,
		`${title} (${kind})`,
		`${title} (${year} ${kind})`,
	];
	let hadRequestError = false;

	const candidateResults = await Promise.all(
		candidates.map((pageName) => getWikitext(pageName)),
	);

	for (const result of candidateResults) {
		if (result.status === "error") {
			hadRequestError = true;
			continue;
		}

		if (result.data && !isDisambiguation(result.data)) {
			const parsed = parseFirstQuote(result.data);
			if (parsed) return { status: "found", result: parsed };
		}
	}

	const searchResult = await searchWikiquote(`${title} ${year} ${kind}`);
	if (searchResult.status === "error") {
		hadRequestError = true;
	} else if (searchResult.data && !candidates.includes(searchResult.data)) {
		const wikitext = await getWikitext(searchResult.data);
		if (wikitext.status === "error") {
			hadRequestError = true;
		} else if (wikitext.data && !isDisambiguation(wikitext.data)) {
			const parsed = parseFirstQuote(wikitext.data);
			if (parsed) return { status: "found", result: parsed };
		}
	}

	if (hadRequestError) {
		return {
			status: "error",
			error: new Error("Wikiquote lookup did not complete cleanly"),
		};
	}

	return { status: "miss" };
}

async function getWikitext(
	pageName: string,
): Promise<WikiquoteRequestResult<string>> {
	const params = new URLSearchParams({
		action: "parse",
		page: pageName,
		prop: "wikitext",
		format: "json",
	});

	try {
		const res = await fetch(`${WIKIQUOTE_API}?${params}`, {
			signal: AbortSignal.timeout(WIKIQUOTE_TIMEOUT_MS),
		});
		if (!res.ok) {
			return {
				status: "error",
				error: new Error(`Wikiquote parse request failed with ${res.status}`),
			};
		}

		const data = await res.json();
		return { status: "ok", data: data?.parse?.wikitext?.["*"] ?? null };
	} catch (error) {
		return { status: "error", error };
	}
}

async function searchWikiquote(
	query: string,
): Promise<WikiquoteRequestResult<string>> {
	const params = new URLSearchParams({
		action: "opensearch",
		search: query,
		limit: "1",
		format: "json",
	});

	try {
		const res = await fetch(`${WIKIQUOTE_API}?${params}`, {
			signal: AbortSignal.timeout(WIKIQUOTE_TIMEOUT_MS),
		});
		if (!res.ok) {
			return {
				status: "error",
				error: new Error(`Wikiquote search request failed with ${res.status}`),
			};
		}

		const data = await res.json();
		return { status: "ok", data: data?.[1]?.[0] ?? null };
	} catch (error) {
		return { status: "error", error };
	}
}

function isDisambiguation(wikitext: string): boolean {
	const start = wikitext.slice(0, 500).toLowerCase();
	return (
		start.includes("may refer to") ||
		start.includes("disambiguation") ||
		start.includes("{{disambig")
	);
}

// ---------------------------------------------------------------------------
// Wikitext parsing — priority: AFI rank > image captions > bold > regular
// ---------------------------------------------------------------------------

const SKIP_SECTIONS =
	/^(dialogue|tagline|cast|see also|external|about|season|episode|quote|credit|trailer|series|feature|miscellaneous|other adaptations)/i;

function parseFirstQuote(wikitext: string): TitleQuoteResult | null {
	const lines = wikitext.split("\n");

	// --- Pass 1: AFI-ranked quotes (definitively most famous) ---
	const afiResult = findAfiQuote(lines);
	if (afiResult) return afiResult;

	// --- Pass 2: Image captions in character sections ---
	const captionResult = findCaptionQuote(lines, "sections");
	if (captionResult) return captionResult;

	// --- Pass 3: Image captions at the top of the page ---
	const topCaptionResult = findCaptionQuote(lines, "top");
	if (topCaptionResult) return topCaptionResult;

	// --- Pass 4: Bold or regular quotes in character sections ---
	return findTextQuote(lines);
}

function findAfiQuote(lines: string[]): TitleQuoteResult | null {
	let best: TitleQuoteResult | null = null;
	let bestRank = Infinity;

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].includes("AFI") && !lines[i].includes("100 Years")) continue;

		const rankMatch = lines[i].match(/Ranked?\s*#(\d+)/i);
		const rank = rankMatch ? Number.parseInt(rankMatch[1], 10) : 999;
		if (rank >= bestRank) continue;

		const prevLine = lines[i - 1];

		// Extract bold quote from previous line
		const boldParts = prevLine.match(/'''(.+?)'''/g);
		if (boldParts) {
			for (const bp of boldParts) {
				const q = cleanQuote(cleanWikitext(bp));
				if (q.length < 10) continue;
				if (isGoodQuote(q)) {
					const character = findCharacterContext(lines, i - 1);
					best = { quote: q, character };
					bestRank = rank;
				}
			}
		}

		// Or a bullet quote
		if (!best || rank < bestRank) {
			const bulletQ = prevLine.match(/^\*\s+(.+)/);
			if (bulletQ) {
				const q = cleanQuote(cleanWikitext(bulletQ[1]));
				if (isGoodQuote(q)) {
					const character = findCharacterContext(lines, i - 1);
					best = { quote: q, character };
					bestRank = rank;
				}
			}
		}
	}

	return best;
}

function findCaptionQuote(
	lines: string[],
	mode: "sections" | "top",
): TitleQuoteResult | null {
	let currentCharacter: string | null = null;
	let inCharSection = false;

	for (const line of lines) {
		const sectionMatch = line.match(
			/^={2,3}\s*(?:\[\[(?:w:)?[^\]|]*\|)?([^\]=]+?)\]?\]?\s*={2,3}\s*$/,
		);
		if (sectionMatch) {
			if (mode === "top") return null; // past the intro
			const heading = sectionMatch[1].trim();
			inCharSection = !SKIP_SECTIONS.test(heading);
			currentCharacter = inCharSection
				? heading.replace(/\/.*$/, "").trim()
				: null;
			continue;
		}

		const shouldCheck =
			mode === "top" || (mode === "sections" && inCharSection);
		if (!shouldCheck) continue;

		if (line.includes("[[File:") || line.includes("[[Image:")) {
			const caption = extractImageCaption(line);
			if (!caption) continue;

			const { text, attribution } = splitAttribution(caption);
			const q = cleanQuote(text);
			if (isGoodQuote(q)) {
				return {
					quote: q,
					character: attribution ?? currentCharacter,
				};
			}
		}
	}

	return null;
}

function findTextQuote(lines: string[]): TitleQuoteResult | null {
	let currentCharacter: string | null = null;
	let bestBold: TitleQuoteResult | null = null;
	let firstRegular: TitleQuoteResult | null = null;

	for (const line of lines) {
		const sectionMatch = line.match(
			/^={2,3}\s*(?:\[\[(?:w:)?[^\]|]*\|)?([^\]=]+?)\]?\]?\s*={2,3}\s*$/,
		);
		if (sectionMatch) {
			const heading = sectionMatch[1].trim();
			currentCharacter = !SKIP_SECTIONS.test(heading)
				? heading.replace(/\/.*$/, "").trim()
				: null;
			continue;
		}

		// Bullet lines
		const bulletMatch = line.match(/^\*\s+(.+)/);
		if (bulletMatch && currentCharacter) {
			const raw = bulletMatch[1];

			// * '''CharName''': quote
			const charBullet = raw.match(/^'''([^']+)'''\s*:\s*(.+)/);
			if (charBullet) {
				const charName = cleanWikitext(charBullet[1]);
				const quoteText = charBullet[2];
				const boldInQuote = quoteText.match(/'''(.+?)'''/);
				if (boldInQuote) {
					const q = cleanQuote(cleanWikitext(boldInQuote[1]));
					if (isGoodQuote(q) && !bestBold)
						bestBold = { quote: q, character: charName };
				} else {
					const q = cleanQuote(cleanWikitext(quoteText));
					if (isGoodQuote(q) && !firstRegular)
						firstRegular = { quote: q, character: charName };
				}
				continue;
			}

			// * '''Bold quote'''
			const fullBold = raw.match(/^'''(.+?)'''/);
			if (fullBold && !raw.match(/^'''[^']+'''\s*:/)) {
				const q = cleanQuote(cleanWikitext(fullBold[1]));
				if (isGoodQuote(q) && !bestBold)
					bestBold = { quote: q, character: currentCharacter };
				continue;
			}

			// * Regular quote
			const q = cleanQuote(cleanWikitext(raw));
			if (isGoodQuote(q) && !firstRegular)
				firstRegular = { quote: q, character: currentCharacter };
			continue;
		}

		// Dialogue lines with bold quotes
		const dialogueMatch = line.match(/^:\s*'''([^']+)'''\s*:\s*(.+)/);
		if (dialogueMatch) {
			const charName = cleanWikitext(dialogueMatch[1]);
			const quoteText = dialogueMatch[2];
			const boldInQuote = quoteText.match(/'''(.+?)'''/);
			if (boldInQuote) {
				const q = cleanQuote(cleanWikitext(boldInQuote[1]));
				if (isGoodQuote(q) && !bestBold)
					bestBold = { quote: q, character: charName };
			}
		}
	}

	return bestBold ?? firstRegular ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findCharacterContext(
	lines: string[],
	fromIndex: number,
): string | null {
	// Check dialogue format on the line itself: :'''Character''': ...
	const dialogueChar = lines[fromIndex].match(/^:\s*'''([^']+?)'''\s*:/);
	if (dialogueChar) return cleanWikitext(dialogueChar[1]);

	// Walk backwards to find section heading
	for (let j = fromIndex - 1; j >= 0; j--) {
		const secMatch = lines[j].match(
			/^={2,3}\s*(?:\[\[(?:w:)?[^\]|]*\|)?([^\]=]+?)\]?\]?\s*={2,3}\s*$/,
		);
		if (secMatch) {
			const heading = secMatch[1].trim();
			if (!SKIP_SECTIONS.test(heading))
				return heading.replace(/\/.*$/, "").trim();
			return null;
		}
	}
	return null;
}

function extractImageCaption(line: string): string | null {
	const fileStart = line.search(/\[\[(?:File|Image):/i);
	if (fileStart === -1) return null;

	// Match brackets with depth tracking to handle nested [[links]]
	let depth = 0;
	let end = -1;
	for (let i = fileStart; i < line.length - 1; i++) {
		if (line[i] === "[" && line[i + 1] === "[") {
			depth++;
			i++;
		} else if (line[i] === "]" && line[i + 1] === "]") {
			depth--;
			if (depth === 0) {
				end = i;
				break;
			}
			i++;
		}
	}
	if (end === -1) return null;

	const content = line.slice(fileStart + 2, end);

	// Split on | at top level only
	const parts: string[] = [];
	let current = "";
	let innerDepth = 0;
	for (const ch of content) {
		if (ch === "[") innerDepth++;
		else if (ch === "]") innerDepth--;
		else if (ch === "|" && innerDepth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	parts.push(current);

	if (parts.length < 3) return null;
	const caption = parts[parts.length - 1];
	if (
		/^\d+(?:x\d+)?px$|^(thumb|right|left|center|upright|frameless)$/i.test(
			caption.trim(),
		)
	)
		return null;

	return cleanWikitext(caption);
}

/** Split "Quote text ~ Character Name" or "Quote text. — Character" */
function splitAttribution(text: string): {
	text: string;
	attribution: string | null;
} {
	const match = text.match(/^(.+?)\s*[~—–-]\s+([A-Z][a-zA-Z\s.]+)$/);
	if (match) return { text: match[1].trim(), attribution: match[2].trim() };
	return { text, attribution: null };
}

function cleanQuote(text: string): string {
	return (
		text
			// Strip leading/trailing quotes and ellipsis
			.replace(/^["\u201C\u201D\u2018\u2019….\s]+/, "")
			.replace(/["\u201C\u201D\u2018\u2019…\s]+$/, "")
			.trim()
	);
}

function isGoodQuote(text: string): boolean {
	if (text.length < 12 || text.length > 200) return false;
	if (text.split(/\s+/).length < 3) return false;
	// Skip all-caps
	if (text === text.toUpperCase() && text.length > 20) return false;
	// Skip parsing artifacts
	if (/^\(/.test(text)) return false;
	// Skip things that read like descriptions rather than dialogue
	if (
		/^(this|the|a|an|in|it|directed|written|produced)\s/i.test(text) &&
		text.length > 80
	)
		return false;
	// Skip multi-line content that leaked in (lyrics, poems)
	if ((text.match(/\n/g) || []).length > 1) return false;
	return true;
}

function cleanWikitext(text: string): string {
	return (
		text
			// Remove stage directions: ''[to someone]''
			.replace(/''\[.*?\]''\s*/g, "")
			// Remove wiki links: [[Target|Display]] → Display, [[Simple]] → Simple
			.replace(/\[\[(?:w:)?(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
			// Remove bold/italic markers
			.replace(/'{2,3}/g, "")
			// Remove <ref> tags
			.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
			.replace(/<ref[^>]*\/>/gi, "")
			// Remove HTML tags
			.replace(/<[^>]+>/g, "")
			// Collapse <br> to space
			.replace(/<br\s*\/?>/gi, " ")
			.trim()
	);
}

export const __test = {
	parseFirstQuote,
};
