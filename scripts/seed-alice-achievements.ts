import "dotenv/config";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

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

// Give Alice a mix of achievements (some overlapping with common ones, some unique)
const achievementIds = [
	"now-showing",
	"episode-one",
	"season-pass",
	"marathon-runner",
	"first-watch",
	"ten-spot",
	"century-club",
	"night-owl",
	"dear-diary",
	"frequent-writer",
	"opening-review",
	"five-star-critic",
	"plus-one",
	"inner-circle",
	"coming-attractions",
	"channel-surfer",
	"ticket-holder",
	"rerun",
	"genre-hopper",
	"back-to-back",
];

let inserted = 0;
for (const achievementId of achievementIds) {
	const res = await client.query(
		`INSERT INTO earned_achievement (id, user_id, achievement_id, earned_at)
		 VALUES (gen_random_uuid(), $1, $2, NOW() - interval '1 day' * (random() * 60)::int)
		 ON CONFLICT DO NOTHING`,
		[aliceId, achievementId],
	);
	if (res.rowCount && res.rowCount > 0) inserted++;
}

console.log(`Inserted ${inserted} achievements for Alice (${achievementIds.length} attempted, duplicates skipped)`);
await client.end();
