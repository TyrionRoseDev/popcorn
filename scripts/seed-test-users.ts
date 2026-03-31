import "dotenv/config";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// Find the current (real) user
const { rows: realUsers } = await client.query(
	`SELECT id, name, username FROM "user" WHERE email NOT LIKE '%@test.com' ORDER BY created_at LIMIT 1`,
);

if (realUsers.length === 0) {
	console.error("No real user found in the database. Sign in first, then run this script.");
	await client.end();
	process.exit(1);
}

const me = realUsers[0];
console.log(`Found your account: ${me.name} (@${me.username})\n`);

const testUsers = [
	{
		id: crypto.randomUUID(),
		name: "Alice Chen",
		email: "alice@test.com",
		username: "alicechen",
		bio: "Horror and sci-fi enthusiast",
		onboarding_completed: true,
		friendship: "accepted", // friend
	},
	{
		id: crypto.randomUUID(),
		name: "Bob Martinez",
		email: "bob@test.com",
		username: "bobmart",
		bio: "Documentary lover and film nerd",
		onboarding_completed: true,
		friendship: "accepted", // friend
	},
	{
		id: crypto.randomUUID(),
		name: "Charlie Kim",
		email: "charlie@test.com",
		username: "charliek",
		bio: "Action movies are my thing",
		onboarding_completed: true,
		friendship: "accepted", // friend
	},
	{
		id: crypto.randomUUID(),
		name: "Diana Patel",
		email: "diana@test.com",
		username: "dianap",
		bio: "Indie film connoisseur",
		onboarding_completed: true,
		friendship: "pending-incoming", // incoming request (they sent to you)
	},
	{
		id: crypto.randomUUID(),
		name: "Ethan Nowak",
		email: "ethan@test.com",
		username: "ethannow",
		bio: "Comedy and rom-com fan",
		onboarding_completed: true,
		friendship: "pending-incoming", // incoming request (they sent to you)
	},
];

console.log("Seeding test users...\n");

for (const u of testUsers) {
	// Upsert user — on conflict, grab the existing id back
	const { rows } = await client.query(
		`INSERT INTO "user" (id, name, email, email_verified, username, bio, onboarding_completed, created_at, updated_at)
		 VALUES ($1, $2, $3, true, $4, $5, $6, NOW(), NOW())
		 ON CONFLICT (email) DO UPDATE SET name = $2, username = $4, bio = $5
		 RETURNING id`,
		[u.id, u.name, u.email, u.username, u.bio, u.onboarding_completed],
	);
	const userId = rows[0].id;
	console.log(`  ✓ ${u.name} (@${u.username})`);

	// Set up friendship
	const status = u.friendship === "accepted" ? "accepted" : "pending";
	// For incoming requests, they are the requester; for accepted friends, either direction works
	const requesterId = u.friendship === "pending-incoming" ? userId : me.id;
	const addresseeId = u.friendship === "pending-incoming" ? me.id : userId;

	await client.query(
		`INSERT INTO friendship (id, requester_id, addressee_id, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())
		 ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = $4`,
		[crypto.randomUUID(), requesterId, addresseeId, status],
	);
	const label = status === "accepted" ? "friend" : "incoming request";
	console.log(`    ↳ ${label}`);
}

console.log("\nDone!");
console.log("  • 3 accepted friends: Alice, Bob, Charlie");
console.log("  • 2 pending incoming requests: Diana, Ethan");

await client.end();
