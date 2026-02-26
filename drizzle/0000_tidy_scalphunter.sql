CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"family_id" varchar(255) NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"family_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"notify_publications" boolean DEFAULT true,
	"notify_follower" boolean DEFAULT true,
	"notify_interaction" boolean DEFAULT true,
	"notify_weekly" boolean DEFAULT true,
	"notify_updates" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"theme" varchar(20) DEFAULT 'light',
	"privacy_age" varchar(20) DEFAULT 'Private',
	"privacy_gender" varchar(20) DEFAULT 'Private',
	"privacy_education" varchar(20) DEFAULT 'Private'
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"avatar_url" text,
	"bio" text,
	"date_of_birth" date,
	"gender" varchar(50),
	"education" varchar(255),
	"social_media" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "user_social_auths" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_social_auths_provider_id_unique" UNIQUE("provider_id"),
	CONSTRAINT "user_social_auths_user_provider_idx" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(60) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"is_activated" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_social_auths" ADD CONSTRAINT "user_social_auths_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;