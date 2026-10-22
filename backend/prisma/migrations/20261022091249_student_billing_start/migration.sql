-- Adds the first billed month to students. Hand-edited so it also works on tables that already
-- have rows: existing students start billing in the month they were created.
ALTER TABLE "students" ADD COLUMN "billing_start" DATE;

UPDATE "students"
SET "billing_start" = date_trunc('month', "created_at" AT TIME ZONE 'UTC')::date;

ALTER TABLE "students" ALTER COLUMN "billing_start" SET NOT NULL;

-- Always the first day of a month.
ALTER TABLE "students" ADD CONSTRAINT "students_billing_start_first_of_month"
  CHECK (EXTRACT(DAY FROM "billing_start") = 1);
