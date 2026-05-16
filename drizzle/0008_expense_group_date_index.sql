CREATE INDEX IF NOT EXISTS "idx_expenses_group_date" ON "owe-wari_expenses" ("group_id","expense_date" DESC,"id" DESC) WHERE "deleted_at" IS NULL;
