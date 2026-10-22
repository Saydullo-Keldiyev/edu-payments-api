import { z } from 'zod';
import { monthSchema } from '../../common/validation';

export const balanceDebtorsQuerySchema = z.object({
  month: monthSchema('month'),
});

/** For a single student the month is optional and defaults to the current month. */
export const studentBalanceQuerySchema = z.object({
  month: monthSchema('month').optional(),
});
