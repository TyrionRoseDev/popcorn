import "dotenv/config";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// Get Alice's ID
const { rows } = await client.query(
	`SELECT id FROM "user" WHERE email = 'alice@test.com'`,
);
if (!rows.length) {
	console.error("Alice not found");
	await client.end();
	process.exit(1);
}
const aliceId = rows[0].id;
console.log("Alice ID:", aliceId);

// Update Alice's profile: favourite film (The Shining = 694), favourite genre (Horror = 27)
await client.query(
	`UPDATE "user" SET favourite_film_tmdb_id = 694, favourite_genre_id = 27, bio = 'Horror and sci-fi enthusiast. Always watching something.' WHERE id = $1`,
	[aliceId],
);
console.log("Updated profile fields");

// Add genre preferences (Horror=27, Sci-Fi=878, Thriller=53, Mystery=9648)
const genres = [27, 878, 53, 9648];
for (const g of genres) {
	await client.query(
		`INSERT INTO user_genre (id, user_id, genre_id, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) ON CONFLICT DO NOTHING`,
		[aliceId, g],
	);
}
console.log("Added genres");

// Add some titles to Alice's collection (popular horror/sci-fi movies)
const titles = [
	{ tmdbId: 694, mediaType: "movie" }, // The Shining
	{ tmdbId: 348, mediaType: "movie" }, // Alien
	{ tmdbId: 424, mediaType: "movie" }, // Schindler's List
	{ tmdbId: 603, mediaType: "movie" }, // The Matrix
	{ tmdbId: 27205, mediaType: "movie" }, // Inception
	{ tmdbId: 157336, mediaType: "movie" }, // Interstellar
	{ tmdbId: 496243, mediaType: "movie" }, // Parasite
	{ tmdbId: 438631, mediaType: "movie" }, // Dune
	{ tmdbId: 1396, mediaType: "tv" }, // Breaking Bad
	{ tmdbId: 66732, mediaType: "tv" }, // Stranger Things
];
for (const t of titles) {
	await client.query(
		`INSERT INTO user_title (id, user_id, tmdb_id, media_type, created_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW()) ON CONFLICT DO NOTHING`,
		[aliceId, t.tmdbId, t.mediaType],
	);
}
console.log("Added titles");

// Create a public watchlist for Alice
const { rows: wl } = await client.query(
	`INSERT INTO watchlist (id, name, owner_id, is_public, type, created_at, updated_at)
	 VALUES (gen_random_uuid(), 'Horror Essentials', $1, true, 'custom', NOW(), NOW())
	 RETURNING id`,
	[aliceId],
);
if (wl.length) {
	const wlId = wl[0].id;
	const wlItems = [
		{ tmdbId: 694, mediaType: "movie" }, // The Shining
		{ tmdbId: 348, mediaType: "movie" }, // Alien
		{ tmdbId: 493922, mediaType: "movie" }, // Hereditary
		{ tmdbId: 419430, mediaType: "movie" }, // Get Out
	];
	for (const item of wlItems) {
		await client.query(
			`INSERT INTO watchlist_item (id, watchlist_id, tmdb_id, media_type, added_by, created_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
			[wlId, item.tmdbId, item.mediaType, aliceId],
		);
	}
	console.log("Created watchlist with items");
}

console.log("\nDone! Alice Chen now has a fully populated profile.");
await client.end();
