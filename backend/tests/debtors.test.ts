import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { monthRange } from '../src/modules/debtors/debtors.schemas';
import { api, createPayment, createStudent, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

interface DebtorBody {
  studentId: string;
  monthlyFee: string;
  totalPaid: string;
  debtAmount: string;
}

async function getDebtors(month: string) {
  const res = await api().get('/debtors').query({ month });
  expect(res.status).toBe(200);
  return res.body as { month: string; count: number; totalDebt: string; debtors: DebtorBody[] };
}

function findDebtor(debtors: DebtorBody[], studentId: string): DebtorBody | undefined {
  return debtors.find((d) => d.studentId === studentId);
}

describe('monthRange', () => {
  it.each([
    ['2026-01', '2026-01-01', '2026-02-01'],
    ['2026-02', '2026-02-01', '2026-03-01'],
    ['2028-02', '2028-02-01', '2028-03-01'],
    ['2026-12', '2026-12-01', '2027-01-01'],
    ['9999-12', '9999-12-01', '10000-01-01'],
  ])('%s -> [%s, %s)', (month, start, end) => {
    expect(monthRange(month)).toEqual({ start, end });
  });
});

describe('GET /debtors', () => {
  it('returns an empty report when there are no students', async () => {
    const body = await getDebtors('2026-03');
    expect(body).toEqual({ month: '2026-03', count: 0, totalDebt: '0.00', debtors: [] });
  });

  it('includes an unpaid student with the full fee as debt', async () => {
    const student = await createStudent({ name: 'Unpaid', monthlyFee: '500000' });
    const body = await getDebtors('2026-03');

    expect(body.count).toBe(1);
    expect(body.debtors[0]).toEqual({
      studentId: student.id,
      name: 'Unpaid',
      phone: student.phone,
      groupName: student.groupName,
      monthlyFee: '500000.00',
      totalPaid: '0.00',
      debtAmount: '500000.00',
    });
  });

  it('includes a partially paid student with the remaining debt', async () => {
    const student = await createStudent({ monthlyFee: '500000' });
    await createPayment(student.id, '200000', '2026-03-10');

    const debtor = findDebtor((await getDebtors('2026-03')).debtors, student.id);
    expect(debtor).toMatchObject({ totalPaid: '200000.00', debtAmount: '300000.00' });
  });

  it('excludes fully paid and overpaid students', async () => {
    const full = await createStudent({ monthlyFee: '500000' });
    const over = await createStudent({ monthlyFee: '500000' });
    await createPayment(full.id, '500000', '2026-03-10');
    await createPayment(over.id, '650000', '2026-03-10');

    const body = await getDebtors('2026-03');
    expect(body.count).toBe(0);
    expect(body.debtors).toEqual([]);
  });

  it('excludes students with a zero monthly fee', async () => {
    await createStudent({ monthlyFee: '0' });
    expect((await getDebtors('2026-03')).count).toBe(0);
  });

  it('sums multiple payments in the month', async () => {
    const partial = await createStudent({ monthlyFee: '500000' });
    const settled = await createStudent({ monthlyFee: '500000' });
    await createPayment(partial.id, '100000', '2026-03-01');
    await createPayment(partial.id, '150000', '2026-03-15');
    await createPayment(settled.id, '250000', '2026-03-02');
    await createPayment(settled.id, '250000', '2026-03-20');

    const body = await getDebtors('2026-03');
    expect(body.count).toBe(1);
    expect(findDebtor(body.debtors, partial.id)).toMatchObject({ totalPaid: '250000.00', debtAmount: '250000.00' });
    expect(findDebtor(body.debtors, settled.id)).toBeUndefined();
  });

  it('uses exact decimal arithmetic (no floating-point drift)', async () => {
    // In JS floats 100.1 + 0.1 + 0.1 = 100.29999999999998, which would leave a phantom debt.
    const a = await createStudent({ monthlyFee: '100.30' });
    await createPayment(a.id, '100.10', '2026-03-01');
    await createPayment(a.id, '0.10', '2026-03-02');
    await createPayment(a.id, '0.10', '2026-03-03');
    // 0.7 + 0.1 = 0.7999999999999999 in floats.
    const b = await createStudent({ monthlyFee: '0.80' });
    await createPayment(b.id, '0.70', '2026-03-01');
    await createPayment(b.id, '0.10', '2026-03-02');
    // Partial debt with cents.
    const c = await createStudent({ monthlyFee: '1000.00' });
    await createPayment(c.id, '333.33', '2026-03-01');
    await createPayment(c.id, '333.33', '2026-03-02');

    const body = await getDebtors('2026-03');
    expect(body.debtors.map((d) => d.studentId)).toEqual([c.id]);
    expect(body.debtors[0]).toMatchObject({ totalPaid: '666.66', debtAmount: '333.34' });
    expect(body.totalDebt).toBe('333.34');
  });

  it('counts only payments inside the half-open month range', async () => {
    const student = await createStudent({ monthlyFee: '1000' });
    await createPayment(student.id, '1', '2026-01-31'); // previous month: excluded
    await createPayment(student.id, '10', '2026-02-01'); // first day: included
    await createPayment(student.id, '100', '2026-02-28'); // last day: included
    await createPayment(student.id, '500', '2026-03-01'); // next month start: excluded

    const debtor = findDebtor((await getDebtors('2026-02')).debtors, student.id);
    expect(debtor).toMatchObject({ totalPaid: '110.00', debtAmount: '890.00' });
  });

  it('handles leap-year February and the December -> January rollover', async () => {
    const student = await createStudent({ monthlyFee: '1000' });
    await createPayment(student.id, '100', '2028-02-29');
    await createPayment(student.id, '200', '2028-03-01');
    await createPayment(student.id, '300', '2026-12-31');
    await createPayment(student.id, '400', '2027-01-01');

    expect(findDebtor((await getDebtors('2028-02')).debtors, student.id)?.totalPaid).toBe('100.00');
    expect(findDebtor((await getDebtors('2026-12')).debtors, student.id)?.totalPaid).toBe('300.00');
    expect(findDebtor((await getDebtors('2027-01')).debtors, student.id)?.totalPaid).toBe('400.00');
  });

  it('treats each month independently (a payment covers only its own month)', async () => {
    const student = await createStudent({ monthlyFee: '500000' });
    await createPayment(student.id, '500000', '2026-03-05');

    expect((await getDebtors('2026-03')).count).toBe(0);
    expect(findDebtor((await getDebtors('2026-04')).debtors, student.id)?.debtAmount).toBe('500000.00');
  });

  it('orders debtors by debt descending and reports the total debt', async () => {
    const small = await createStudent({ name: 'Small', monthlyFee: '100000' });
    const big = await createStudent({ name: 'Big', monthlyFee: '900000' });
    const mid = await createStudent({ name: 'Mid', monthlyFee: '500000' });
    await createPayment(mid.id, '100000', '2026-03-03');

    const body = await getDebtors('2026-03');
    expect(body.month).toBe('2026-03');
    expect(body.count).toBe(3);
    expect(body.debtors.map((d) => d.studentId)).toEqual([big.id, mid.id, small.id]);
    expect(body.totalDebt).toBe('1400000.00');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['month 13', '2026-13'],
    ['month 00', '2026-00'],
    ['single-digit month', '2026-1'],
    ['full date', '2026-01-01'],
    ['two-digit year', '26-01'],
    ['slash separator', '2026/01'],
    ['text', 'january'],
  ])('rejects %s month with 400', async (_label, month) => {
    const res = await api()
      .get('/debtors')
      .query(month === undefined ? {} : { month });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts the last representable month (9999-12) without a server error', async () => {
    await createStudent({ monthlyFee: '100' });
    expect((await getDebtors('9999-12')).count).toBe(1);
  });

  it('rejects a repeated month parameter with 400', async () => {
    const res = await api().get('/debtors?month=2026-01&month=2026-02');
    expect(res.status).toBe(400);
  });
});
