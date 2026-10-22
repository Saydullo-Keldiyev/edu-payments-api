import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { monthRange } from './debtors.schemas';

export interface DebtorDto {
  studentId: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  totalPaid: string;
  debtAmount: string;
}

export interface DebtorsReportDto {
  month: string;
  count: number;
  totalDebt: string;
  debtors: DebtorDto[];
}

interface DebtorRow {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  debtAmount: Prisma.Decimal;
  totalDebt: Prisma.Decimal;
}

/**
 * All money arithmetic happens in PostgreSQL on NUMERIC values, so sums and differences are exact.
 *
 * - LEFT JOIN keeps students who paid nothing in the month (SUM over no rows -> COALESCE to 0).
 * - The payment filter sits in the JOIN condition, not WHERE, otherwise those students would vanish.
 * - The month is a half-open range: payment_date >= first day AND < first day of next month.
 * - HAVING keeps only positive debt, which is exactly max(0, monthlyFee - totalPaid) > 0.
 */
export async function getDebtors(month: string): Promise<DebtorsReportDto> {
  const { start, end } = monthRange(month);

  const rows = await prisma.$queryRaw<DebtorRow[]>`
    SELECT
      s.id,
      s.name,
      s.phone,
      s.group_name AS "groupName",
      s.monthly_fee AS "monthlyFee",
      COALESCE(SUM(p.amount), 0) AS "totalPaid",
      s.monthly_fee - COALESCE(SUM(p.amount), 0) AS "debtAmount",
      SUM(s.monthly_fee - COALESCE(SUM(p.amount), 0)) OVER () AS "totalDebt"
    FROM students s
    LEFT JOIN payments p
      ON p.student_id = s.id
     AND p.payment_date >= ${start}::date
     AND p.payment_date < ${end}::date
    GROUP BY s.id
    HAVING s.monthly_fee - COALESCE(SUM(p.amount), 0) > 0
    ORDER BY "debtAmount" DESC, s.name ASC, s.id ASC
  `;

  return {
    month,
    count: rows.length,
    totalDebt: rows[0] ? formatMoney(rows[0].totalDebt) : '0.00',
    debtors: rows.map((row) => ({
      studentId: row.id,
      name: row.name,
      phone: row.phone,
      groupName: row.groupName,
      monthlyFee: formatMoney(row.monthlyFee),
      totalPaid: formatMoney(row.totalPaid),
      debtAmount: formatMoney(row.debtAmount),
    })),
  };
}
