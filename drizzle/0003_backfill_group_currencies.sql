INSERT INTO "owe-wari_group_currencies" ("group_id", "code")
SELECT "id", "currency"
FROM "owe-wari_groups"
WHERE NOT EXISTS (
    SELECT 1 FROM "owe-wari_group_currencies"
    WHERE "owe-wari_group_currencies"."group_id" = "owe-wari_groups"."id"
);
