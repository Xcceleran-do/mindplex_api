CREATE TABLE "post_stats" (
	"post_id" integer PRIMARY KEY,
	"like_count" integer DEFAULT 0 NOT NULL,
	"dislike_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"peoples_choice_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_stats" ADD CONSTRAINT "post_stats_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;