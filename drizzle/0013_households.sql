CREATE TABLE IF NOT EXISTS "owe-wari_households" (
    "id" serial PRIMARY KEY NOT NULL,
    "group_id" varchar(26) NOT NULL,
    "name" varchar(256) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owe-wari_households_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_household_members" (
    "id" serial PRIMARY KEY NOT NULL,
    "household_id" integer NOT NULL,
    "group_id" varchar(26) NOT NULL,
    "user_id" varchar(26) NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "owe-wari_household_members_household_id_owe-wari_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "owe-wari_households"("id") ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "owe-wari_household_members_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_household_members_user_id_owe-wari_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_households_group_id" ON "owe-wari_households" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_household_members_household_id" ON "owe-wari_household_members" ("household_id");
--> statement-breakpoint
-- One person belongs to at most one household per group.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_household_members_group_user" ON "owe-wari_household_members" ("group_id","user_id");
