export const ACHIEVEMENT_CATEGORIES = [
	"watching",
	"time-based",
	"social",
	"discovery",
	"watchlists",
	"recommendations",
	"reviews",
	"tracker",
	"journal",
	"profile",
	"meta",
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export type AchievementCondition =
	| { type: "watchedCount"; threshold: number }
	| { type: "genreCount"; threshold: number }
	| { type: "genreCountAll" }
	| { type: "watchedAtTime"; after: string; before: string }
	| { type: "watchedWithinWindow"; hours: number; count: number }
	| { type: "friendCount"; threshold: number }
	| { type: "joinedCollabWatchlist" }
	| { type: "sameTitleSameDay" }
	| { type: "totalSwipes"; threshold: number }
	| { type: "shuffleToWatchlist" }
	| { type: "watchlistCount"; threshold: number }
	| { type: "clearedWatchlist"; minItems: number }
	| { type: "rewatch" }
	| { type: "sentRecommendation" }
	| { type: "recWatched" }
	| { type: "recRatedHighly"; minRating: number }
	| { type: "firstReview" }
	| { type: "reviewCount"; threshold: number }
	| { type: "onboardingCompleted" }
	| { type: "achievementCount"; threshold: number }
	| { type: "trackedShowCount"; threshold: number }
	| { type: "episodeWatchCount"; threshold: number }
	| { type: "completedSeriesCount"; threshold: number }
	| { type: "startedRewatch" }
	| { type: "bingeWatchSeason" }
	| { type: "journalEntryCount"; threshold: number }
	| { type: "journalAllScopes" }
	| { type: "reviewGenreCountAll" }
	| { type: "achievementCountAll" };

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: AchievementCategory;
	condition: AchievementCondition;
}

export const ACTION_CONTEXT_MAP: Record<
	string,
	AchievementCondition["type"][]
> = {
	watched: [
		"watchedCount",
		"genreCount",
		"genreCountAll",
		"watchedAtTime",
		"watchedWithinWindow",
		"clearedWatchlist",
		"rewatch",
		"sameTitleSameDay",
		"recWatched",
		"recRatedHighly",
		"achievementCount",
		"achievementCountAll",
	],
	friend: ["friendCount", "achievementCount", "achievementCountAll"],
	watchlist_created: [
		"watchlistCount",
		"achievementCount",
		"achievementCountAll",
	],
	watchlist_joined: [
		"joinedCollabWatchlist",
		"achievementCount",
		"achievementCountAll",
	],
	swipe: ["totalSwipes", "achievementCount", "achievementCountAll"],
	shuffle_to_watchlist: [
		"shuffleToWatchlist",
		"achievementCount",
		"achievementCountAll",
	],
	recommendation_sent: [
		"sentRecommendation",
		"achievementCount",
		"achievementCountAll",
	],
	review: [
		"firstReview",
		"reviewCount",
		"reviewGenreCountAll",
		"recRatedHighly",
		"achievementCount",
		"achievementCountAll",
	],
	onboarding: [
		"onboardingCompleted",
		"achievementCount",
		"achievementCountAll",
	],
	episode_marked: [
		"trackedShowCount",
		"episodeWatchCount",
		"completedSeriesCount",
		"bingeWatchSeason",
		"achievementCount",
		"achievementCountAll",
	],
	show_tracked: ["trackedShowCount", "achievementCount", "achievementCountAll"],
	rewatch_started: [
		"startedRewatch",
		"achievementCount",
		"achievementCountAll",
	],
	journal_entry: [
		"journalEntryCount",
		"journalAllScopes",
		"achievementCount",
		"achievementCountAll",
	],
};
export type ActionContext = keyof typeof ACTION_CONTEXT_MAP;

export const ACHIEVEMENTS: AchievementDefinition[] = [
	// Watching (8)
	{
		id: "first-watch",
		name: "First Watch",
		description: "Log your first watch",
		icon: "🎬",
		category: "watching",
		condition: { type: "watchedCount", threshold: 1 },
	},
	{
		id: "ten-spot",
		name: "Ten Spot",
		description: "Log 10 watches",
		icon: "🎞️",
		category: "watching",
		condition: { type: "watchedCount", threshold: 10 },
	},
	{
		id: "century-club",
		name: "Century Club",
		description: "Log 100 watches",
		icon: "💯",
		category: "watching",
		condition: { type: "watchedCount", threshold: 100 },
	},
	{
		id: "film-buff",
		name: "Film Buff",
		description: "Log 250 watches",
		icon: "🎥",
		category: "watching",
		condition: { type: "watchedCount", threshold: 250 },
	},
	{
		id: "projectionist",
		name: "Projectionist",
		description: "Log 500 watches",
		icon: "📽️",
		category: "watching",
		condition: { type: "watchedCount", threshold: 500 },
	},
	{
		id: "curtain-call",
		name: "Curtain Call",
		description: "Log 1000 watches",
		icon: "🎭",
		category: "watching",
		condition: { type: "watchedCount", threshold: 1000 },
	},
	{
		id: "genre-hopper",
		name: "Genre Hopper",
		description: "Watch across 5 different genres",
		icon: "🔀",
		category: "watching",
		condition: { type: "genreCount", threshold: 5 },
	},
	{
		id: "well-rounded",
		name: "Well Rounded",
		description: "Watch across every genre",
		icon: "🌍",
		category: "watching",
		condition: { type: "genreCountAll" },
	},

	// Time-Based (3)
	{
		id: "night-owl",
		name: "Night Owl",
		description: "Watch something after midnight",
		icon: "🌙",
		category: "time-based",
		condition: { type: "watchedAtTime", after: "00:00", before: "04:59" },
	},
	{
		id: "early-bird",
		name: "Early Bird",
		description: "Watch something before 11:59am",
		icon: "🌅",
		category: "time-based",
		condition: { type: "watchedAtTime", after: "05:00", before: "11:59" },
	},
	{
		id: "back-to-back",
		name: "Back to Back",
		description: "Watch 2 titles within 3 hours",
		icon: "⏩",
		category: "time-based",
		condition: { type: "watchedWithinWindow", hours: 3, count: 2 },
	},

	// Social (5)
	{
		id: "plus-one",
		name: "Plus One",
		description: "Add your first friend",
		icon: "🤝",
		category: "social",
		condition: { type: "friendCount", threshold: 1 },
	},
	{
		id: "inner-circle",
		name: "Inner Circle",
		description: "Have 5 friends",
		icon: "👥",
		category: "social",
		condition: { type: "friendCount", threshold: 5 },
	},
	{
		id: "sold-out-crowd",
		name: "Sold Out Crowd",
		description: "Have 25 friends",
		icon: "🏟️",
		category: "social",
		condition: { type: "friendCount", threshold: 25 },
	},
	{
		id: "shared-popcorn",
		name: "Shared Popcorn",
		description: "Join a collaborative watchlist",
		icon: "🍿",
		category: "social",
		condition: { type: "joinedCollabWatchlist" },
	},
	{
		id: "in-sync",
		name: "In Sync",
		description: "Watch the same title as a friend on the same day",
		icon: "🔗",
		category: "social",
		condition: { type: "sameTitleSameDay" },
	},

	// Discovery (2)
	{
		id: "channel-surfer",
		name: "Channel Surfer",
		description: "Swipe through 50 titles in shuffle",
		icon: "📺",
		category: "discovery",
		condition: { type: "totalSwipes", threshold: 50 },
	},
	{
		id: "showtime-shuffle",
		name: "Showtime Shuffle",
		description: "Add a title from shuffle to a watchlist",
		icon: "🎰",
		category: "discovery",
		condition: { type: "shuffleToWatchlist" },
	},

	// Watchlists (3)
	{
		id: "coming-attractions",
		name: "Coming Attractions",
		description: "Create your first watchlist",
		icon: "📋",
		category: "watchlists",
		condition: { type: "watchlistCount", threshold: 1 },
	},
	{
		id: "completionist",
		name: "Completionist",
		description: "Clear an entire watchlist (min 5 items)",
		icon: "✅",
		category: "watchlists",
		condition: { type: "clearedWatchlist", minItems: 5 },
	},
	{
		id: "encore",
		name: "Encore",
		description: "Rewatch a title",
		icon: "🔁",
		category: "watchlists",
		condition: { type: "rewatch" },
	},

	// Recommendations (3)
	{
		id: "word-of-mouth",
		name: "Word of Mouth",
		description: "Recommend a title to a friend",
		icon: "📢",
		category: "recommendations",
		condition: { type: "sentRecommendation" },
	},
	{
		id: "trusted-critic",
		name: "Trusted Critic",
		description: "A friend watches something you recommended",
		icon: "🎯",
		category: "recommendations",
		condition: { type: "recWatched" },
	},
	{
		id: "good-taste",
		name: "Good Taste",
		description: "Recommend something and a friend rates it 4+ stars",
		icon: "👨‍🍳",
		category: "recommendations",
		condition: { type: "recRatedHighly", minRating: 4 },
	},

	// Reviews (2)
	{
		id: "opening-review",
		name: "Opening Review",
		description: "Leave your first review",
		icon: "✍️",
		category: "reviews",
		condition: { type: "firstReview" },
	},
	{
		id: "five-star-critic",
		name: "Five Star Critic",
		description: "Leave 10 reviews",
		icon: "⭐",
		category: "reviews",
		condition: { type: "reviewCount", threshold: 10 },
	},
	{
		id: "seasoned-critic",
		name: "Seasoned Critic",
		description: "Leave 25 reviews",
		icon: "🎙️",
		category: "reviews",
		condition: { type: "reviewCount", threshold: 25 },
	},
	{
		id: "review-machine",
		name: "Review Machine",
		description: "Leave 50 reviews",
		icon: "⌨️",
		category: "reviews",
		condition: { type: "reviewCount", threshold: 50 },
	},
	{
		id: "genre-critic",
		name: "Genre Critic",
		description: "Leave a review for every genre",
		icon: "📰",
		category: "reviews",
		condition: { type: "reviewGenreCountAll" },
	},

	// Tracker (9)
	{
		id: "now-showing",
		name: "Now Showing",
		description: "Add your first show to the tracker",
		icon: "📡",
		category: "tracker",
		condition: { type: "trackedShowCount", threshold: 1 },
	},
	{
		id: "episode-one",
		name: "Episode One",
		description: "Watch 50 episodes",
		icon: "▶️",
		category: "tracker",
		condition: { type: "episodeWatchCount", threshold: 50 },
	},
	{
		id: "season-pass",
		name: "Season Pass",
		description: "Watch 200 episodes",
		icon: "📺",
		category: "tracker",
		condition: { type: "episodeWatchCount", threshold: 200 },
	},
	{
		id: "marathon-runner",
		name: "Marathon Runner",
		description: "Watch 500 episodes",
		icon: "🏃",
		category: "tracker",
		condition: { type: "episodeWatchCount", threshold: 500 },
	},
	{
		id: "series-finale",
		name: "Series Finale",
		description: "Complete a full series",
		icon: "🔚",
		category: "tracker",
		condition: { type: "completedSeriesCount", threshold: 1 },
	},
	{
		id: "serial-finisher",
		name: "Serial Finisher",
		description: "Complete 5 series",
		icon: "📚",
		category: "tracker",
		condition: { type: "completedSeriesCount", threshold: 5 },
	},
	{
		id: "series-sweep",
		name: "Series Sweep",
		description: "Complete 10 series",
		icon: "🧹",
		category: "tracker",
		condition: { type: "completedSeriesCount", threshold: 10 },
	},
	{
		id: "binge-watch",
		name: "Binge Watch",
		description: "Watch an entire season in one day",
		icon: "⏭️",
		category: "tracker",
		condition: { type: "bingeWatchSeason" },
	},
	{
		id: "rerun",
		name: "Rerun",
		description: "Start a rewatch of a series",
		icon: "🔄",
		category: "tracker",
		condition: { type: "startedRewatch" },
	},

	// Journal (3)
	{
		id: "dear-diary",
		name: "Dear Diary",
		description: "Write your first journal entry",
		icon: "📝",
		category: "journal",
		condition: { type: "journalEntryCount", threshold: 1 },
	},
	{
		id: "frequent-writer",
		name: "Frequent Writer",
		description: "Write 10 journal entries",
		icon: "🖊️",
		category: "journal",
		condition: { type: "journalEntryCount", threshold: 10 },
	},
	{
		id: "triple-take",
		name: "Triple Take",
		description: "Write an episode, season, and show journal entry",
		icon: "🎯",
		category: "journal",
		condition: { type: "journalAllScopes" },
	},

	// Profile (1)
	{
		id: "ticket-holder",
		name: "Ticket Holder",
		description: "Complete onboarding",
		icon: "🎫",
		category: "profile",
		condition: { type: "onboardingCompleted" },
	},

	// Meta (3)
	{
		id: "trophy-case",
		name: "Trophy Case",
		description: "Earn 10 achievements",
		icon: "🏆",
		category: "meta",
		condition: { type: "achievementCount", threshold: 10 },
	},
	{
		id: "award-season",
		name: "Award Season",
		description: "Earn 25 achievements",
		icon: "🏅",
		category: "meta",
		condition: { type: "achievementCount", threshold: 25 },
	},
	{
		id: "hall-of-fame",
		name: "Hall of Fame",
		description: "Earn every achievement",
		icon: "👑",
		category: "meta",
		condition: { type: "achievementCountAll" },
	},
];

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_ACHIEVEMENTS = ACHIEVEMENTS.length;
