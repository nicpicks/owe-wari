CREATE TABLE IF NOT EXISTS "owe-wari_expense_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_id" integer NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"amount" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(26) NOT NULL,
	"paid_by_user_id" varchar(26) NOT NULL,
	"title" varchar(256) NOT NULL,
	"amount" numeric NOT NULL,
	"category" varchar(256),
	"notes" varchar(256),
	"expense_date" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(26) NOT NULL,
	"user_id" varchar(26) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_groups" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" varchar(256),
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_users" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_expense_splits" ADD CONSTRAINT "owe-wari_expense_splits_expense_id_owe-wari_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."owe-wari_expenses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_expense_splits" ADD CONSTRAINT "owe-wari_expense_splits_user_id_owe-wari_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."owe-wari_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_expenses" ADD CONSTRAINT "owe-wari_expenses_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."owe-wari_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_expenses" ADD CONSTRAINT "owe-wari_expenses_paid_by_user_id_owe-wari_users_id_fk" FOREIGN KEY ("paid_by_user_id") REFERENCES "public"."owe-wari_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_group_members" ADD CONSTRAINT "owe-wari_group_members_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."owe-wari_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "owe-wari_group_members" ADD CONSTRAINT "owe-wari_group_members_user_id_owe-wari_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."owe-wari_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
