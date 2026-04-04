CREATE TABLE "earned_achievement" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_event" ALTER COLUMN "watched_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "watched_at" timestamp;--> statement-breakpoint
ALTER TABLE "earned_achievement" ADD CONSTRAINT "earned_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "earned_achievement_unique" ON "earned_achievement" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "earned_achievement_user_id_idx" ON "earned_achievement" USING btree ("user_id");