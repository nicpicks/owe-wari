ALTER TABLE "owe-wari_groups" ADD COLUMN IF NOT EXISTS "default_payee" varchar(26) REFERENCES "owe-wari_users"("id");
--> statement-breakpoint
ALTER TABLE "owe-wari_expenses" ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'SGD';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_group_currencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(26) NOT NULL,
	"code" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "owe-wari_group_currencies_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "owe-wari_settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" varchar(26) NOT NULL,
	"payer_id" varchar(26) NOT NULL,
	"receiver_id" varchar(26) NOT NULL,
	"amount" numeric NOT NULL,
	"currency" varchar(3) NOT NULL DEFAULT 'SGD',
	"settled_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "owe-wari_settlements_group_id_owe-wari_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "owe-wari_groups"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "owe-wari_settlements_payer_id_owe-wari_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "owe-wari_settlements_receiver_id_owe-wari_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "owe-wari_users"("id") ON DELETE no action ON UPDATE no action
);
