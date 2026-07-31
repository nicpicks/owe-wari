CREATE TABLE IF NOT EXISTS "owe-wari_group_rates" (
    "id" serial PRIMARY KEY NOT NULL,
    "group_id" varchar(26) NOT NULL,
    "code" varchar(3) NOT NULL,
    "rate" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owe-wari_group_rates_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_group_rates_group_code" ON "owe-wari_group_rates" ("group_id","code");
