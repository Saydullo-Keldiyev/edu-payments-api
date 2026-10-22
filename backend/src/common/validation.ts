import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid({ message: 'Must be a valid UUID' }),
});

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30, 2026-13-01, ...). */
export const isoDateSchema = z
  .string({ message: 'Must be a date in YYYY-MM-DD format' })
  .regex(ISO_DATE_PATTERN, 'Must be a date in YYYY-MM-DD format')
  .refine(
    (value) => {
      const [, y, m, d] = ISO_DATE_PATTERN.exec(value) ?? [];
      const year = Number(y);
      const month = Number(m);
      const day = Number(d);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        year >= 1900 &&
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: 'Must be a valid calendar date' },
  );

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** A calendar month in YYYY-MM form, year 1900 or later. */
export function monthSchema(field: string) {
  return z
    .string({ message: `${field} is required and must be in YYYY-MM format` })
    .regex(MONTH_PATTERN, `${field} must be a calendar month in YYYY-MM format (01-12)`)
    .refine((value) => Number(value.slice(0, 4)) >= 1900, { message: `${field} must be in year 1900 or later` });
}

/** The current calendar month (UTC) as YYYY-MM. */
export function currentUtcMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Converts a validated YYYY-MM-DD string to the UTC-midnight Date Prisma uses for DATE columns. */
export function dateFromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Formats a DATE column value (UTC midnight) back to YYYY-MM-DD. */
export function isoDateFromDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
