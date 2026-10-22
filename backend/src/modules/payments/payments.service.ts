import type { Payment } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { isPrismaError } from '../../lib/prisma-errors';
import { NotFoundError } from '../../common/errors';
import { dateFromIsoDate, isoDateFromDate } from '../../common/validation';
import type { CreatePaymentInput } from './payments.schemas';

export interface PaymentDto {
  id: string;
  studentId: string;
  amount: string;
  paymentDate: string;
  createdAt: string;
}

export function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    studentId: payment.studentId,
    amount: formatMoney(payment.amount),
    paymentDate: isoDateFromDate(payment.paymentDate),
    createdAt: payment.createdAt.toISOString(),
  };
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentDto> {
  try {
    const payment = await prisma.payment.create({
      data: {
        studentId: input.studentId,
        amount: input.amount,
        paymentDate: dateFromIsoDate(input.paymentDate),
      },
    });
    return toPaymentDto(payment);
  } catch (err) {
    // The foreign key is the single source of truth for "student exists" (no check-then-insert race).
    if (isPrismaError(err, 'P2003')) throw new NotFoundError('Student not found');
    throw err;
  }
}

export async function listStudentPayments(studentId: string): Promise<PaymentDto[]> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new NotFoundError('Student not found');

  const payments = await prisma.payment.findMany({
    where: { studentId },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  });
  return payments.map(toPaymentDto);
}
