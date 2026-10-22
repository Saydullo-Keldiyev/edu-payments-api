-- Prisma cannot express CHECK constraints in the schema, so they live in this hand-written migration.
-- They back up the API validation: invalid money values cannot reach the table by any path.
ALTER TABLE "students" ADD CONSTRAINT "students_monthly_fee_non_negative" CHECK ("monthly_fee" >= 0);
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
