CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block" (
	"id" text PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "block_no_self_relation" CHECK ("block"."blocker_id" <> "block"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "episode_watch" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"runtime" integer NOT NULL,
	"watched_at" timestamp DEFAULT now() NOT NULL,
	"watch_event_id" text,
	"watch_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendship" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_no_self_relation" CHECK ("friendship"."requester_id" <> "friendship"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title_name" text NOT NULL,
	"scope" text NOT NULL,
	"season_number" integer,
	"episode_number" integer,
	"note" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"watch_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_id" text NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"action_taken" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"title_name" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shuffle_swipe" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"watchlist_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"username" text,
	"avatar_url" text,
	"onboarding_completed" boolean DEFAULT false,
	"bio" text,
	"favourite_film_tmdb_id" integer,
	"favourite_film_media_type" text,
	"favourite_genre_id" integer,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_genre" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"genre_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_title" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_watch_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"title_name" text NOT NULL,
	"rating" integer,
	"review_text" text,
	"review_public" boolean DEFAULT true NOT NULL,
	"title" text,
	"note" text,
	"poster_path" text,
	"scope" text,
	"scope_season_number" integer,
	"scope_episode_number" integer,
	"watch_number" integer DEFAULT 1 NOT NULL,
	"genre_ids" jsonb,
	"watched_at" timestamp NOT NULL,
	"review_reminder_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "watch_event_rating_range" CHECK ("watch_event"."rating" IS NULL OR ("watch_event"."rating" >= 1 AND "watch_event"."rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "watch_event_companion" (
	"id" text PRIMARY KEY NOT NULL,
	"watch_event_id" text NOT NULL,
	"friend_id" text,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"type" text DEFAULT 'custom' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"watchlist_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"title" text,
	"poster_path" text,
	"added_by" text NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
	"recommended_by" text,
	"recommendation_message" text,
	"title_name" text,
	"kept_in_watchlist" boolean DEFAULT false NOT NULL,
	"runtime" integer,
	"watched_seasons" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_member" (
	"id" text PRIMARY KEY NOT NULL,
	"watchlist_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_watch" ADD CONSTRAINT "episode_watch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_watch" ADD CONSTRAINT "episode_watch_watch_event_id_watch_event_id_fk" FOREIGN KEY ("watch_event_id") REFERENCES "public"."watch_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_addressee_id_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffle_swipe" ADD CONSTRAINT "shuffle_swipe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffle_swipe" ADD CONSTRAINT "shuffle_swipe_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_genre" ADD CONSTRAINT "user_genre_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_title" ADD CONSTRAINT "user_title_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_event" ADD CONSTRAINT "watch_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_event_companion" ADD CONSTRAINT "watch_event_companion_watch_event_id_watch_event_id_fk" FOREIGN KEY ("watch_event_id") REFERENCES "public"."watch_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_event_companion" ADD CONSTRAINT "watch_event_companion_friend_id_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_recommended_by_user_id_fk" FOREIGN KEY ("recommended_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_member" ADD CONSTRAINT "watchlist_member_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_member" ADD CONSTRAINT "watchlist_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "block_blocker_blocked_idx" ON "block" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "block_blocked_id_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_watch_unique" ON "episode_watch" USING btree ("user_id","tmdb_id","season_number","episode_number","watch_number");--> statement-breakpoint
CREATE INDEX "episode_watch_userId_idx" ON "episode_watch" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "episode_watch_tmdbId_idx" ON "episode_watch" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendship_addressee_id_idx" ON "friendship" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "journal_entry_userId_idx" ON "journal_entry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "journal_entry_tmdbId_idx" ON "journal_entry" USING btree ("user_id","tmdb_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_id_idx" ON "notification" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "recommendation_recipientId_idx" ON "recommendation" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "recommendation_senderId_idx" ON "recommendation" USING btree ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_user_title_unique" ON "review" USING btree ("user_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "review_user_id_idx" ON "review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shuffle_swipe_unique" ON "shuffle_swipe" USING btree ("user_id","tmdb_id","media_type","watchlist_id");--> statement-breakpoint
CREATE INDEX "shuffle_swipe_userId_idx" ON "shuffle_swipe" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shuffle_swipe_watchlistId_idx" ON "shuffle_swipe" USING btree ("watchlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_genre_unique" ON "user_genre" USING btree ("user_id","genre_id");--> statement-breakpoint
CREATE INDEX "user_genre_userId_idx" ON "user_genre" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_title_unique" ON "user_title" USING btree ("user_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "user_title_userId_idx" ON "user_title" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "watch_event_userId_idx" ON "watch_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watch_event_tmdbId_idx" ON "watch_event" USING btree ("user_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "watch_event_reminder_idx" ON "watch_event" USING btree ("review_reminder_at");--> statement-breakpoint
CREATE INDEX "watch_event_companion_event_idx" ON "watch_event_companion" USING btree ("watch_event_id");--> statement-breakpoint
CREATE INDEX "watchlist_owner_id_idx" ON "watchlist" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_item_unique" ON "watchlist_item" USING btree ("watchlist_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "watchlist_item_watchlist_id_idx" ON "watchlist_item" USING btree ("watchlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_member_unique" ON "watchlist_member" USING btree ("watchlist_id","user_id");--> statement-breakpoint
CREATE INDEX "watchlist_member_watchlist_id_idx" ON "watchlist_member" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlist_member_user_id_idx" ON "watchlist_member" USING btree ("user_id");