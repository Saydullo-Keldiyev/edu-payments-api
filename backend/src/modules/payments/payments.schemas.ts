import { z } from 'zod';
import { isoDateSchema } from '../../common/validation';
import { positiveMoneySchema } from '../../lib/money';

export const createPaymentSchema = z.strictObject({
  studentId: z.uuid({ message: 'studentId must be a valid UUID' }),
  amount: positiveMoneySchema,
  paymentDate: isoDateSchema,
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
