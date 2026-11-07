import { writeFileSync } from "node:fs";

const token = process.env.TMDB_READ_ACCESS_TOKEN;
if (!token) throw new Error("TMDB_READ_ACCESS_TOKEN is required");

const titles: Array<[string, number]> = [
	["movie", 603],
	["movie", 693134],
	["movie", 496243],
	["movie", 666277],
	["tv", 95396],
	["tv", 136315],
	["movie", 965150],
	["movie", 976893],
	["movie", 329865],
	["movie", 346648],
	["movie", 129],
	["movie", 843],
	["tv", 126308],
	["movie", 915935],
	["movie", 840430],
	["movie", 1022789],
	["movie", 438631],
	["tv", 1396],
];

const out: Record<string, unknown> = {};
for (const [type, id] of titles) {
	const res = await fetch(
		`https://api.themoviedb.org/3/${type}/${id}?append_to_response=credits,release_dates,content_ratings`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!res.ok) throw new Error(`${type}/${id} ${res.status}`);
	const d = await res.json();
	const director =
		d.credits?.crew?.find((c: { job: string }) => c.job === "Director")?.name ??
		d.created_by?.[0]?.name ??
		null;
	const usRelease = d.release_dates?.results?.find(
		(r: { iso_3166_1: string }) => r.iso_3166_1 === "US",
	);
	const certification =
		usRelease?.release_dates?.find(
			(x: { certification: string }) => x.certification,
		)?.certification ??
		d.content_ratings?.results?.find(
			(r: { iso_3166_1: string }) => r.iso_3166_1 === "US",
		)?.rating ??
		null;
	out[`${type}/${id}`] = {
		id,
		type,
		title: d.title ?? d.name,
		year: (d.release_date ?? d.first_air_date ?? "").slice(0, 4),
		runtime: d.runtime ?? null,
		seasons: d.number_of_seasons ?? null,
		episodes: d.number_of_episodes ?? null,
		tagline: d.tagline || null,
		overview: d.overview,
		poster: d.poster_path,
		backdrop: d.backdrop_path,
		genres: d.genres.map((g: { name: string }) => g.name),
		director,
		certification,
		vote: Math.round(d.vote_average * 10) / 10,
		cast: (d.credits?.cast ?? [])
			.slice(0, 8)
			.map(
				(c: {
					name: string;
					character: string;
					profile_path: string | null;
				}) => ({
					name: c.name,
					character: c.character,
					profile: c.profile_path,
				}),
			),
	};
}
writeFileSync(
	new URL("./-fixtures.json", import.meta.url),
	`${JSON.stringify(out, null, "\t")}\n`,
);
console.log(Object.keys(out).length, "titles written");
