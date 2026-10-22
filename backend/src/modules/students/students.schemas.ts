import { z } from 'zod';
import { monthSchema } from '../../common/validation';
import { moneySchema } from '../../lib/money';

const PHONE_PATTERN = /^\+?\d{7,15}$/;

/** Strips common formatting ("+998 (90) 123-45-67" -> "+998901234567") before validating. */
export const phoneSchema = z
  .string({ message: 'Phone is required' })
  .transform((value) => value.replace(/[\s\-().]/g, ''))
  .pipe(z.string().regex(PHONE_PATTERN, 'Phone must contain 7 to 15 digits, optionally starting with "+"'));

const nameSchema = z
  .string({ message: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const groupNameSchema = z
  .string({ message: 'Group name is required' })
  .trim()
  .min(1, 'Group name is required')
  .max(100, 'Group name must be at most 100 characters');

/**
 * PUT replaces the whole resource, so create and update share one schema with all assignment fields
 * required. `startMonth` (first billed month, used by the carry-forward balance) is an optional
 * extension: on create it defaults to the current month, on update omitting it keeps the stored value.
 */
export const studentInputSchema = z.strictObject({
  name: nameSchema,
  phone: phoneSchema,
  groupName: groupNameSchema,
  monthlyFee: moneySchema,
  startMonth: monthSchema('startMonth').optional(),
});

export type StudentInput = z.infer<typeof studentInputSchema>;
