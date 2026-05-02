CREATE INDEX IF NOT EXISTS "idx_expenses_group_id" ON "owe-wari_expenses" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expenses_paid_by_user_id" ON "owe-wari_expenses" ("paid_by_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_splits_expense_id" ON "owe-wari_expense_splits" ("expense_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_expense_splits_user_id" ON "owe-wari_expense_splits" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_group_members_group_id" ON "owe-wari_group_members" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_group_members_user_id" ON "owe-wari_group_members" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_group_currencies_group_id" ON "owe-wari_group_currencies" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_settlements_group_id" ON "owe-wari_settlements" ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_settlements_payer_id" ON "owe-wari_settlements" ("payer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_settlements_receiver_id" ON "owe-wari_settlements" ("receiver_id");
