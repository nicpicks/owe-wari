CREATE TABLE IF NOT EXISTS "owe-wari_expense_payments" (
    "id" serial PRIMARY KEY NOT NULL,
    "expense_id" integer NOT NULL,
    "user_id" varchar(26) NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owe-wari_expense_payments_expense_id_owe-wari_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "owe-wari_expenses"("id") ON DELETE no action ON UPDATE no action,
    CONSTRAINT "owe-wari_expense_payments_user_id_owe-wari_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_payments_expense_id" ON "owe-wari_expense_payments" ("expense_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_payments_user_id" ON "owe-wari_expense_payments" ("user_id");
--> statement-breakpoint
INSERT INTO "owe-wari_expense_payments" ("expense_id", "user_id", "amount", "created_at", "updated_at")
SELECT "id", "paid_by_user_id", "amount", "created_at", CURRENT_TIMESTAMP
FROM "owe-wari_expenses";
