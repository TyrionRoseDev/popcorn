import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name"),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	username: text("username").unique(),
	avatarUrl: text("avatar_url"),
	onboardingCompleted: boolean("onboarding_completed").default(false),
	bio: text("bio"),
	favouriteFilmTmdbId: integer("favourite_film_tmdb_id"),
	favouriteFilmMediaType: text("favourite_film_media_type"),
	favouriteGenreId: integer("favourite_genre_id"),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userGenre = pgTable(
	"user_genre",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		genreId: integer("genre_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("user_genre_unique").on(table.userId, table.genreId),
		index("user_genre_userId_idx").on(table.userId),
	],
);

export const userTitle = pgTable(
	"user_title",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(), // 'movie' | 'tv'
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("user_title_unique").on(
			table.userId,
			table.tmdbId,
			table.mediaType,
		),
		index("user_title_userId_idx").on(table.userId),
	],
);

export const watchlist = pgTable(
	"watchlist",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text("name").notNull(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		isPublic: boolean("is_public").default(false).notNull(),
		type: text("type").notNull().default("custom"), // 'default' | 'shuffle' | 'custom'
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("watchlist_owner_id_idx").on(table.ownerId)],
);

export const watchlistItem = pgTable(
	"watchlist_item",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		watchlistId: text("watchlist_id")
			.notNull()
			.references(() => watchlist.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		addedBy: text("added_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		watched: boolean("watched").default(false).notNull(),
		recommendedBy: text("recommended_by").references(() => user.id, {
			onDelete: "set null",
		}),
		recommendationMessage: text("recommendation_message"),
		titleName: text("title_name"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("watchlist_item_unique").on(
			table.watchlistId,
			table.tmdbId,
			table.mediaType,
		),
		index("watchlist_item_watchlist_id_idx").on(table.watchlistId),
	],
);

export const watchlistMember = pgTable(
	"watchlist_member",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		watchlistId: text("watchlist_id")
			.notNull()
			.references(() => watchlist.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("member"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("watchlist_member_unique").on(table.watchlistId, table.userId),
		index("watchlist_member_watchlist_id_idx").on(table.watchlistId),
		index("watchlist_member_user_id_idx").on(table.userId),
	],
);

export const shuffleSwipe = pgTable(
	"shuffle_swipe",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		watchlistId: text("watchlist_id")
			.notNull()
			.references(() => watchlist.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(), // 'movie' | 'tv'
		action: text("action").notNull(), // 'yes' | 'no' | 'hide'
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("shuffle_swipe_unique").on(
			table.userId,
			table.tmdbId,
			table.mediaType,
			table.watchlistId,
		),
		index("shuffle_swipe_userId_idx").on(table.userId),
		index("shuffle_swipe_watchlistId_idx").on(table.watchlistId),
	],
);

export const notification = pgTable(
	"notification",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, {
			onDelete: "set null",
		}),
		type: text("type").notNull(),
		data: jsonb("data").notNull().default({}),
		read: boolean("read").notNull().default(false),
		actionTaken: text("action_taken"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("notification_recipient_id_idx").on(table.recipientId),
		index("notification_created_at_idx").on(table.createdAt),
	],
);

export const watchEvent = pgTable(
	"watch_event",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		titleName: text("title_name").notNull(),
		rating: integer("rating"),
		reviewText: text("review_text"),
		reviewPublic: boolean("review_public").default(true).notNull(),
		watchedAt: timestamp("watched_at").notNull(),
		reviewReminderAt: timestamp("review_reminder_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("watch_event_userId_idx").on(table.userId),
		index("watch_event_tmdbId_idx").on(
			table.userId,
			table.tmdbId,
			table.mediaType,
		),
		index("watch_event_reminder_idx").on(table.reviewReminderAt),
		check(
			"watch_event_rating_range",
			sql`${table.rating} IS NULL OR (${table.rating} >= 1 AND ${table.rating} <= 5)`,
		),
	],
);

export const recommendation = pgTable(
	"recommendation",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		senderId: text("sender_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientId: text("recipient_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbId: integer("tmdb_id").notNull(),
		mediaType: text("media_type").notNull(),
		titleName: text("title_name").notNull(),
		message: text("message"),
		status: text("status").notNull().default("pending"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("recommendation_recipientId_idx").on(table.recipientId),
		index("recommendation_senderId_idx").on(table.senderId),
	],
);

export const friendship = pgTable(
	"friendship",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		requesterId: text("requester_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		addresseeId: text("addressee_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status", { enum: ["pending", "accepted"] })
			.notNull()
			.default("pending"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("friendship_pair_idx").using(
			"btree",
			sql`least(${table.requesterId}, ${table.addresseeId})`,
			sql`greatest(${table.requesterId}, ${table.addresseeId})`,
		),
		index("friendship_addressee_id_idx").on(table.addresseeId),
		check(
			"friendship_no_self_relation",
			sql`${table.requesterId} <> ${table.addresseeId}`,
		),
	],
);

export const block = pgTable(
	"block",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		blockerId: text("blocker_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		blockedId: text("blocked_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("block_blocker_blocked_idx").on(
			table.blockerId,
			table.blockedId,
		),
		index("block_blocked_id_idx").on(table.blockedId),
		check(
			"block_no_self_relation",
			sql`${table.blockerId} <> ${table.blockedId}`,
		),
	],
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	genres: many(userGenre),
	titles: many(userTitle),
	ownedWatchlists: many(watchlist),
	watchlistMemberships: many(watchlistMember),
	swipes: many(shuffleSwipe),
	notificationsReceived: many(notification, {
		relationName: "notificationRecipient",
	}),
	notificationsActed: many(notification, { relationName: "notificationActor" }),
	friendshipsRequested: many(friendship, {
		relationName: "friendshipRequester",
	}),
	friendshipsReceived: many(friendship, {
		relationName: "friendshipAddressee",
	}),
	blocksCreated: many(block, { relationName: "blockBlocker" }),
	blocksReceived: many(block, { relationName: "blockBlocked" }),
	watchEvents: many(watchEvent),
	sentRecommendations: many(recommendation, {
		relationName: "sentRecommendations",
	}),
	receivedRecommendations: many(recommendation, {
		relationName: "receivedRecommendations",
	}),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
}));

export const userGenreRelations = relations(userGenre, ({ one }) => ({
	user: one(user, {
		fields: [userGenre.userId],
		references: [user.id],
	}),
}));

export const userTitleRelations = relations(userTitle, ({ one }) => ({
	user: one(user, {
		fields: [userTitle.userId],
		references: [user.id],
	}),
}));

export const watchlistRelations = relations(watchlist, ({ one, many }) => ({
	owner: one(user, { fields: [watchlist.ownerId], references: [user.id] }),
	items: many(watchlistItem),
	members: many(watchlistMember),
	swipes: many(shuffleSwipe),
}));

export const watchlistItemRelations = relations(watchlistItem, ({ one }) => ({
	watchlist: one(watchlist, {
		fields: [watchlistItem.watchlistId],
		references: [watchlist.id],
	}),
	addedByUser: one(user, {
		fields: [watchlistItem.addedBy],
		references: [user.id],
	}),
	recommendedByUser: one(user, {
		fields: [watchlistItem.recommendedBy],
		references: [user.id],
		relationName: "recommendedByUser",
	}),
}));

export const watchlistMemberRelations = relations(
	watchlistMember,
	({ one }) => ({
		watchlist: one(watchlist, {
			fields: [watchlistMember.watchlistId],
			references: [watchlist.id],
		}),
		user: one(user, {
			fields: [watchlistMember.userId],
			references: [user.id],
		}),
	}),
);

export const shuffleSwipeRelations = relations(shuffleSwipe, ({ one }) => ({
	user: one(user, {
		fields: [shuffleSwipe.userId],
		references: [user.id],
	}),
	watchlist: one(watchlist, {
		fields: [shuffleSwipe.watchlistId],
		references: [watchlist.id],
	}),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
	recipient: one(user, {
		fields: [notification.recipientId],
		references: [user.id],
		relationName: "notificationRecipient",
	}),
	actor: one(user, {
		fields: [notification.actorId],
		references: [user.id],
		relationName: "notificationActor",
	}),
}));

export const friendshipRelations = relations(friendship, ({ one }) => ({
	requester: one(user, {
		fields: [friendship.requesterId],
		references: [user.id],
		relationName: "friendshipRequester",
	}),
	addressee: one(user, {
		fields: [friendship.addresseeId],
		references: [user.id],
		relationName: "friendshipAddressee",
	}),
}));

export const blockRelations = relations(block, ({ one }) => ({
	blocker: one(user, {
		fields: [block.blockerId],
		references: [user.id],
		relationName: "blockBlocker",
	}),
	blocked: one(user, {
		fields: [block.blockedId],
		references: [user.id],
		relationName: "blockBlocked",
	}),
}));

export const watchEventRelations = relations(watchEvent, ({ one }) => ({
	user: one(user, {
		fields: [watchEvent.userId],
		references: [user.id],
	}),
}));

export const recommendationRelations = relations(recommendation, ({ one }) => ({
	sender: one(user, {
		fields: [recommendation.senderId],
		references: [user.id],
		relationName: "sentRecommendations",
	}),
	recipient: one(user, {
		fields: [recommendation.recipientId],
		references: [user.id],
		relationName: "receivedRecommendations",
	}),
}));
