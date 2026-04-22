CREATE TYPE "public"."burn_bag_post_status" AS ENUM('queued', 'spared', 'deleted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."burn_bag_status" AS ENUM('unsealed', 'sealed', 'armed', 'executing', 'complete', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."coverage" AS ENUM('api_recent', 'archive_full', 'combined');--> statement-breakpoint
CREATE TYPE "public"."delete_job_status" AS ENUM('queued', 'running', 'paused', 'aborted', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."post_source" AS ENUM('api', 'archive');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('post', 'reply', 'repost', 'quote');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('x');--> statement-breakpoint
CREATE TYPE "public"."scan_sort" AS ENUM('reverse_chronological', 'oldest_first');--> statement-breakpoint
CREATE TYPE "public"."scan_source" AS ENUM('api', 'archive', 'both');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"connected_account_id" text,
	"delete_job_id" text,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "burn_bag_posts" (
	"burn_bag_id" text NOT NULL,
	"post_index_id" text NOT NULL,
	"provider_post_id" text NOT NULL,
	"status" "burn_bag_post_status" DEFAULT 'queued' NOT NULL,
	"failure_reason" text,
	"attempted_at" timestamp with time zone,
	CONSTRAINT "burn_bag_posts_burn_bag_id_post_index_id_pk" PRIMARY KEY("burn_bag_id","post_index_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "burn_bags" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connected_account_id" text NOT NULL,
	"scan_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"queue_hash" text NOT NULL,
	"status" "burn_bag_status" DEFAULT 'unsealed' NOT NULL,
	"source_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_start" timestamp with time zone,
	"date_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sealed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connected_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" "provider" DEFAULT 'x' NOT NULL,
	"provider_user_id" text NOT NULL,
	"handle" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delete_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"burn_bag_id" text NOT NULL,
	"user_id" text NOT NULL,
	"connected_account_id" text NOT NULL,
	"dry_run_id" text NOT NULL,
	"queue_hash" text NOT NULL,
	"status" "delete_job_status" DEFAULT 'queued' NOT NULL,
	"deleted_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"remaining_count" integer DEFAULT 0 NOT NULL,
	"typed_verse_hash" text NOT NULL,
	"last_cursor" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dry_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"burn_bag_id" text NOT NULL,
	"queue_hash" text NOT NULL,
	"would_delete" integer NOT NULL,
	"sample_reviewed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_index" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connected_account_id" text NOT NULL,
	"provider_post_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"type" "post_type" NOT NULL,
	"text_preview" text NOT NULL,
	"text_encrypted" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"repost_count" integer DEFAULT 0 NOT NULL,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"has_media" boolean DEFAULT false NOT NULL,
	"source" "post_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scans" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"connected_account_id" text NOT NULL,
	"source" "scan_source" NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" "scan_sort" DEFAULT 'reverse_chronological' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"coverage" "coverage" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "burn_bag_posts" ADD CONSTRAINT "burn_bag_posts_burn_bag_id_burn_bags_id_fk" FOREIGN KEY ("burn_bag_id") REFERENCES "public"."burn_bags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "burn_bag_posts" ADD CONSTRAINT "burn_bag_posts_post_index_id_post_index_id_fk" FOREIGN KEY ("post_index_id") REFERENCES "public"."post_index"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "burn_bags" ADD CONSTRAINT "burn_bags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "burn_bags" ADD CONSTRAINT "burn_bags_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "burn_bags" ADD CONSTRAINT "burn_bags_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delete_jobs" ADD CONSTRAINT "delete_jobs_burn_bag_id_burn_bags_id_fk" FOREIGN KEY ("burn_bag_id") REFERENCES "public"."burn_bags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delete_jobs" ADD CONSTRAINT "delete_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delete_jobs" ADD CONSTRAINT "delete_jobs_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delete_jobs" ADD CONSTRAINT "delete_jobs_dry_run_id_dry_runs_id_fk" FOREIGN KEY ("dry_run_id") REFERENCES "public"."dry_runs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dry_runs" ADD CONSTRAINT "dry_runs_burn_bag_id_burn_bags_id_fk" FOREIGN KEY ("burn_bag_id") REFERENCES "public"."burn_bags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_index" ADD CONSTRAINT "post_index_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "post_index" ADD CONSTRAINT "post_index_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scans" ADD CONSTRAINT "scans_connected_account_id_connected_accounts_id_fk" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_type_idx" ON "audit_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "burn_bag_posts_status_idx" ON "burn_bag_posts" USING btree ("burn_bag_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "burn_bags_account_idx" ON "burn_bags" USING btree ("connected_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "burn_bags_hash_idx" ON "burn_bags" USING btree ("connected_account_id","queue_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_provider_user_idx" ON "connected_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connected_accounts_user_idx" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delete_jobs_account_idx" ON "delete_jobs" USING btree ("connected_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delete_jobs_status_idx" ON "delete_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "post_index_account_provider_post_idx" ON "post_index" USING btree ("connected_account_id","provider_post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_index_account_posted_at_idx" ON "post_index" USING btree ("connected_account_id","posted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scans_account_idx" ON "scans" USING btree ("connected_account_id");