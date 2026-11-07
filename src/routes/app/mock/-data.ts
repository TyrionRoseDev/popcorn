import raw from "./-fixtures.json";

export type Title = {
	id: number;
	type: "movie" | "tv";
	title: string;
	year: string;
	runtime: number | null;
	seasons: number | null;
	episodes: number | null;
	tagline: string | null;
	overview: string;
	poster: string;
	backdrop: string;
	genres: string[];
	director: string | null;
	certification: string | null;
	vote: number;
	cast: Array<{ name: string; character: string; profile: string | null }>;
};

const titles = raw as unknown as Record<string, Title>;

export function t(key: string): Title {
	const found = titles[key];
	if (!found) throw new Error(`missing fixture ${key}`);
	return found;
}

export const img = (
	path: string,
	size: "w92" | "w185" | "w342" | "w780" | "w1280",
) => `https://image.tmdb.org/t/p/${size}${path}`;

export type Person = { id: string; name: string; handle: string; hue: number };

export const people: Record<string, Person> = {
	vera: { id: "vera", name: "Vera", handle: "veraverify", hue: 38 },
	felix: { id: "felix", name: "Felix", handle: "felixfriend", hue: 190 },
	maya: { id: "maya", name: "Maya", handle: "mayareels", hue: 330 },
	sam: { id: "sam", name: "Sam", handle: "samwatches", hue: 140 },
	jo: { id: "jo", name: "Jo", handle: "jo.at.the.pictures", hue: 260 },
};

export type Entry = {
	kind: "entry";
	no: number;
	title: Title;
	date: string;
	rating: number | null;
	note: string | null;
	rewatch: number | null;
	with: Person[];
	scope?: string;
	visibility: "Friends" | "Only me";
};

export type ProgressLine = {
	kind: "progress";
	title: Title;
	date: string;
	count: number;
	range: string;
};

export type DiaryItem = Entry | ProgressLine;

export const diary: Array<{ month: string; items: DiaryItem[] }> = [
	{
		month: "November 2026",
		items: [
			{
				kind: "entry",
				no: 128,
				title: t("movie/693134"),
				date: "2026-11-07",
				rating: 5,
				note: "Saw it on the biggest screen I could find. The sandworm ride made the whole row gasp.",
				rewatch: 2,
				with: [people.felix],
				visibility: "Friends",
			},
			{
				kind: "progress",
				title: t("tv/95396"),
				date: "2026-11-06",
				count: 3,
				range: "S2 E2 to E4",
			},
			{
				kind: "entry",
				no: 127,
				title: t("movie/603"),
				date: "2026-11-06",
				rating: 4,
				note: "Still the best lobby scene ever filmed. Rewatched the bullet time twice.",
				rewatch: 2,
				with: [],
				visibility: "Friends",
			},
			{
				kind: "entry",
				no: 126,
				title: t("movie/666277"),
				date: "2026-11-03",
				rating: 5,
				note: "The bar scene at the end. I sat through the credits without moving.",
				rewatch: null,
				with: [people.maya],
				visibility: "Only me",
			},
			{
				kind: "entry",
				no: 125,
				title: t("movie/346648"),
				date: "2026-11-01",
				rating: 4,
				note: null,
				rewatch: null,
				with: [],
				visibility: "Friends",
			},
		],
	},
	{
		month: "October 2026",
		items: [
			{
				kind: "entry",
				no: 124,
				title: t("tv/136315"),
				date: "2026-10-29",
				rating: 4,
				note: "Season 3 slows down and I liked it more for that.",
				rewatch: null,
				with: [],
				scope: "Season 3",
				visibility: "Friends",
			},
			{
				kind: "entry",
				no: 123,
				title: t("movie/965150"),
				date: "2026-10-24",
				rating: 5,
				note: "Under Pressure. That is all.",
				rewatch: null,
				with: [people.sam, people.jo],
				visibility: "Friends",
			},
			{
				kind: "progress",
				title: t("tv/126308"),
				date: "2026-10-19",
				count: 5,
				range: "S1 E6 to E10",
			},
			{
				kind: "entry",
				no: 122,
				title: t("movie/915935"),
				date: "2026-10-12",
				rating: 3,
				note: null,
				rewatch: null,
				with: [],
				visibility: "Friends",
			},
		],
	},
];

export const watching = [
	{ title: t("tv/95396"), next: "S2 E5", seen: 14, total: 19, airs: null },
	{
		title: t("tv/136315"),
		next: "S4 E1",
		seen: 28,
		total: 38,
		airs: "in 6 days",
	},
];

export type FeedItem =
	| {
			kind: "entry";
			who: Person;
			no: number;
			title: Title;
			rating: number | null;
			note: string | null;
			with: Person[];
			rewatch: boolean;
			saved: boolean;
	  }
	| {
			kind: "list";
			who: Person;
			name: string;
			count: number;
			posters: Title[];
	  };

export const feed: Array<{ day: string; items: FeedItem[] }> = [
	{
		day: "Today",
		items: [
			{
				kind: "entry",
				who: people.felix,
				no: 311,
				title: t("movie/693134"),
				rating: 5,
				note: "Vera made me go a second time and she was right. Go big screen or go home.",
				with: [people.vera],
				rewatch: true,
				saved: false,
			},
			{
				kind: "entry",
				who: people.maya,
				no: 88,
				title: t("movie/976893"),
				rating: 5,
				note: "A man cleans toilets in Tokyo and I cried three times. Watch it on a quiet night.",
				with: [],
				rewatch: false,
				saved: true,
			},
		],
	},
	{
		day: "Yesterday",
		items: [
			{
				kind: "entry",
				who: people.sam,
				no: 402,
				title: t("movie/329865"),
				rating: 4,
				note: null,
				with: [],
				rewatch: true,
				saved: false,
			},
			{
				kind: "list",
				who: people.jo,
				name: "Cosy winter films",
				count: 12,
				posters: [
					t("movie/346648"),
					t("movie/129"),
					t("movie/840430"),
					t("movie/1022789"),
				],
			},
		],
	},
	{
		day: "Thursday 5 November",
		items: [
			{
				kind: "entry",
				who: people.jo,
				no: 57,
				title: t("movie/843"),
				rating: 5,
				note: "Every frame is a painting. The corridor shots live in my head now.",
				with: [],
				rewatch: false,
				saved: false,
			},
			{
				kind: "entry",
				who: people.felix,
				no: 310,
				title: t("tv/1396"),
				rating: 4,
				note: "Finished it at last. Ozymandias is as good as everyone said.",
				with: [],
				rewatch: false,
				saved: false,
			},
		],
	},
];

export const friends = [people.felix, people.maya, people.sam, people.jo];

export const matrixEntries = [
	{
		no: 127,
		date: "6 Nov 2026",
		rating: 4,
		note: "Still the best lobby scene ever filmed. Rewatched the bullet time twice.",
		label: "Rewatch 2",
	},
	{
		no: 64,
		date: "14 Mar 2025",
		rating: 4,
		note: "Watched with the commentary on. The roof chase holds up.",
		label: "Rewatch 1",
	},
	{ no: 3, date: "2 Jan 2024", rating: 5, note: null, label: "First watch" },
];

export const matrixFriends = [
	{ who: people.felix, rating: 4 },
	{ who: people.sam, rating: 5 },
	{ who: people.jo, rating: 3 },
];
