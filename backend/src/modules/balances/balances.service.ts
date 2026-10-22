import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { NotFoundError } from '../../common/errors';

/**
 * Carry-forward balance (an extension next to the assignment's month-only GET /debtors).
 *
 * A student owes `monthlyFee` for every month from their start month up to and including the
 * requested month. All of their payments, whatever their date, go into one pot that pays the
 * OLDEST month first. So with a 200 000 fee, a 1 000 000 payment covers five months, and a
 * payment made in October first clears an unpaid September.
 *
 * Under that rule, the requested month is fully paid exactly when totalPaid >= totalDue, so:
 *   totalDue   = monthlyFee * monthsBilled
 *   debtAmount = max(0, totalDue - totalPaid)   (all unpaid months up to the requested month)
 *   credit     = max(0, totalPaid - totalDue)   (prepaid amount for later months)
 */

interface BalanceRow {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: Prisma.Decimal;
  startMonth: string;
  monthsBilled: number;
  totalDue: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  /** floor(totalPaid / monthlyFee); null when the fee is 0. */
  monthsCovered: Prisma.Decimal | null;
}

export interface StudentBalanceDto {
  studentId: string;
  /** The month the balance is calculated up to, YYYY-MM. */
  month: string;
  startMonth: string;
  monthlyFee: string;
  monthsBilled: number;
  totalDue: string;
  totalPaid: string;
  debtAmount: string;
  creditAmount: string;
  unpaidMonths: number;
  /** Last month fully covered by payments (may be after `month` when prepaid), or null. */
  paidThroughMonth: string | null;
}

export interface BalanceDebtorDto {
  studentId: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  startMonth: string;
  monthsBilled: number;
  totalDue: string;
  totalPaid: string;
  debtAmount: string;
  unpaidMonths: number;
  paidThroughMonth: string | null;
}

export interface BalanceDebtorsReportDto {
  month: string;
  count: number;
  totalDebt: string;
  debtors: BalanceDebtorDto[];
}

function queryBalances(month: string, filter: { studentId: string } | { debtorsOnly: true }): Promise<BalanceRow[]> {
  const studentFilter =
    'studentId' in filter ? Prisma.sql`WHERE s.id = ${filter.studentId}::uuid` : Prisma.sql`WHERE s.billing_start <= a.d`;
  const debtorFilter =
    'debtorsOnly' in filter ? Prisma.sql`WHERE "monthlyFee" * "monthsBilled" - "totalPaid" > 0` : Prisma.empty;

  return prisma.$queryRaw<BalanceRow[]>`
    WITH as_of AS (SELECT ${`${month}-01`}::date AS d),
    balances AS (
      SELECT
        s.id,
        s.name,
        s.phone,
        s.group_name AS "groupName",
        s.monthly_fee AS "monthlyFee",
        s.billing_start,
        GREATEST(
          (EXTRACT(YEAR FROM a.d)::int - EXTRACT(YEAR FROM s.billing_start)::int) * 12
            + EXTRACT(MONTH FROM a.d)::int - EXTRACT(MONTH FROM s.billing_start)::int + 1,
          0
        ) AS "monthsBilled",
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.student_id = s.id) AS "totalPaid"
      FROM students s
      CROSS JOIN as_of a
      ${studentFilter}
    )
    SELECT
      id,
      name,
      phone,
      "groupName",
      "monthlyFee",
      to_char(billing_start, 'YYYY-MM') AS "startMonth",
      "monthsBilled",
      "monthlyFee" * "monthsBilled" AS "totalDue",
      "totalPaid",
      CASE WHEN "monthlyFee" > 0 THEN FLOOR("totalPaid" / "monthlyFee") END AS "monthsCovered"
    FROM balances
    ${debtorFilter}
    ORDER BY "monthlyFee" * "monthsBilled" - "totalPaid" DESC, name ASC, id ASC
  `;
}

/** startMonth + monthsCovered - 1, using BigInt so huge prepayments cannot overflow. */
function paidThroughMonth(startMonth: string, monthsCovered: Prisma.Decimal | null): string | null {
  if (monthsCovered === null || monthsCovered.lessThan(1)) return null;
  const index =
    BigInt(startMonth.slice(0, 4)) * 12n + BigInt(Number(startMonth.slice(5, 7)) - 1) + BigInt(monthsCovered.toFixed(0)) - 1n;
  const year = index / 12n;
  const month = (index % 12n) + 1n;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
}

const ZERO = new Prisma.Decimal(0);

function summarize(row: BalanceRow) {
  const difference = row.totalDue.minus(row.totalPaid);
  const debt = Prisma.Decimal.max(difference, ZERO);
  return {
    debt,
    credit: Prisma.Decimal.max(difference.negated(), ZERO),
    unpaidMonths: row.monthlyFee.greaterThan(0) ? debt.dividedBy(row.monthlyFee).ceil().toNumber() : 0,
    paidThroughMonth: paidThroughMonth(row.startMonth, row.monthsCovered),
  };
}

export async function getStudentBalance(studentId: string, month: string): Promise<StudentBalanceDto> {
  const [row] = await queryBalances(month, { studentId });
  if (!row) throw new NotFoundError('Student not found');
  const { debt, credit, unpaidMonths, paidThroughMonth: paidThrough } = summarize(row);
  return {
    studentId: row.id,
    month,
    startMonth: row.startMonth,
    monthlyFee: formatMoney(row.monthlyFee),
    monthsBilled: row.monthsBilled,
    totalDue: formatMoney(row.totalDue),
    totalPaid: formatMoney(row.totalPaid),
    debtAmount: formatMoney(debt),
    creditAmount: formatMoney(credit),
    unpaidMonths,
    paidThroughMonth: paidThrough,
  };
}

export async function getBalanceDebtors(month: string): Promise<BalanceDebtorsReportDto> {
  const rows = await queryBalances(month, { debtorsOnly: true });
  let totalDebt = ZERO;
  const debtors = rows.map((row): BalanceDebtorDto => {
    const { debt, unpaidMonths, paidThroughMonth: paidThrough } = summarize(row);
    totalDebt = totalDebt.plus(debt);
    return {
      studentId: row.id,
      name: row.name,
      phone: row.phone,
      groupName: row.groupName,
      monthlyFee: formatMoney(row.monthlyFee),
      startMonth: row.startMonth,
      monthsBilled: row.monthsBilled,
      totalDue: formatMoney(row.totalDue),
      totalPaid: formatMoney(row.totalPaid),
      debtAmount: formatMoney(debt),
      unpaidMonths,
      paidThroughMonth: paidThrough,
    };
  });
  return { month, count: debtors.length, totalDebt: formatMoney(totalDebt), debtors };
}
