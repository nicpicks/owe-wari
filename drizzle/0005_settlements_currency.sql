ALTER TABLE "owe-wari_settlements" ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'SGD';
