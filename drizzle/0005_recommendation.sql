CREATE TABLE "recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "friendship_requester_addressee_idx";--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "recommended_by" text;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "recommendation_message" text;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_sender_id_idx" ON "recommendation" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "recommendation_recipient_id_idx" ON "recommendation" USING btree ("recipient_id");--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_recommended_by_user_id_fk" FOREIGN KEY ("recommended_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_blocked_id_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_no_self_relation" CHECK ("block"."blocker_id" <> "block"."blocked_id");--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_no_self_relation" CHECK ("friendship"."requester_id" <> "friendship"."addressee_id");