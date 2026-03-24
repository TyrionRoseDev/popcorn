CREATE TABLE "watchlist" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"watchlist_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"added_by" text NOT NULL,
	"watched" boolean DEFAULT false NOT NULL,
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
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_member" ADD CONSTRAINT "watchlist_member_watchlist_id_watchlist_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_member" ADD CONSTRAINT "watchlist_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watchlist_owner_id_idx" ON "watchlist" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_item_unique" ON "watchlist_item" USING btree ("watchlist_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "watchlist_item_watchlist_id_idx" ON "watchlist_item" USING btree ("watchlist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_member_unique" ON "watchlist_member" USING btree ("watchlist_id","user_id");--> statement-breakpoint
CREATE INDEX "watchlist_member_watchlist_id_idx" ON "watchlist_member" USING btree ("watchlist_id");--> statement-breakpoint
CREATE INDEX "watchlist_member_user_id_idx" ON "watchlist_member" USING btree ("user_id");