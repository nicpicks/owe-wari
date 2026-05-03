ALTER TABLE "owe-wari_expenses" ADD COLUMN IF NOT EXISTS "created_by_user_id" varchar(26) REFERENCES "owe-wari_users"("id");
--> statement-breakpoint
UPDATE "owe-wari_expenses" SET "created_by_user_id" = "paid_by_user_id" WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "owe-wari_expenses" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_expense_audits" (
    "id" serial PRIMARY KEY NOT NULL,
    "expense_id" integer NOT NULL,
    "group_id" varchar(26) NOT NULL,
    "actor_id" varchar(26) NOT NULL,
    "fields_changed" text[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "owe-wari_expense_audits_expense_id_owe-wari_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "owe-wari_expenses"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_expense_audits_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_expense_audits_actor_id_owe-wari_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_audits_group_id" ON "owe-wari_expense_audits" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_audits_expense_id" ON "owe-wari_expense_audits" ("expense_id");
