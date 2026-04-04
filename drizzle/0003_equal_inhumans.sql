CREATE TABLE "title_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"quote" text,
	"character" text,
	"parser_version" integer DEFAULT 1 NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "title_quote_unique" ON "title_quote" USING btree ("tmdb_id","media_type");