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
ALTER TABLE "watchlist" ADD COLUMN "type" text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
UPDATE "watchlist" SET "type" = CASE WHEN "is_default" = true THEN 'default' ELSE 'custom' END;--> statement-breakpoint
ALTER TABLE "watchlist" DROP COLUMN "is_default";--> statement-breakpoint
ALTER TABLE "shuffle_swipe" ADD CONSTRAINT "shuffle_swipe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shuffle_swipe" ADD CONSTRAINT "shuffle_swipe_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shuffle_swipe_unique" ON "shuffle_swipe" USING btree ("user_id","tmdb_id","media_type","watchlist_id");--> statement-breakpoint
CREATE INDEX "shuffle_swipe_userId_idx" ON "shuffle_swipe" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shuffle_swipe_watchlistId_idx" ON "shuffle_swipe" USING btree ("watchlist_id");
