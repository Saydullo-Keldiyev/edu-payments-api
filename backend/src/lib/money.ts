import type { Prisma } from '@prisma/client';
import { z } from 'zod';

/** Up to 10 integer digits and 2 decimal places, matching DECIMAL(12, 2). */
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * Accepts money as a JSON string ("150000.50") or number (150000.5) and normalizes it to a
 * decimal string. The value is never used in floating-point arithmetic: it goes straight to
 * Prisma/PostgreSQL as an exact DECIMAL.
 */
export const moneySchema = z
  .union([z.string(), z.number()], { message: 'Must be a number or numeric string' })
  .transform((value) => (typeof value === 'number' ? String(value) : value.trim()))
  .pipe(
    z
      .string()
      .regex(MONEY_PATTERN, 'Must be a non-negative amount with at most 10 integer digits and 2 decimal places'),
  );

// Zod 4 still runs refinements after the pattern check has failed, so this must not throw on
// arbitrary strings. A value matching MONEY_PATTERN is > 0 exactly when it has a non-zero digit.
export const positiveMoneySchema = moneySchema.refine((value) => /[1-9]/.test(value), {
  message: 'Must be greater than 0',
});

/** Serializes a DECIMAL as a fixed two-decimal string so clients never see float rounding. */
export function formatMoney(value: Prisma.Decimal): string {
  return value.toFixed(2);
}
