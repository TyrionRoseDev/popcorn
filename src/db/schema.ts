import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
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

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	genres: many(userGenre),
	titles: many(userTitle),
	ownedWatchlists: many(watchlist),
	watchlistMemberships: many(watchlistMember),
	swipes: many(shuffleSwipe),
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
