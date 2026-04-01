DROP INDEX "friendship_requester_addressee_idx";--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "poster_path" text;--> statement-breakpoint
CREATE INDEX "block_blocked_id_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_no_self_relation" CHECK ("block"."blocker_id" <> "block"."blocked_id");--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_no_self_relation" CHECK ("friendship"."requester_id" <> "friendship"."addressee_id");