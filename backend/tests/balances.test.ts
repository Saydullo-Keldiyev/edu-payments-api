import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, createPayment, createStudent, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

interface BalanceBody {
  studentId: string;
  month: string;
  startMonth: string;
  monthsBilled: number;
  totalDue: string;
  totalPaid: string;
  debtAmount: string;
  creditAmount: string;
  unpaidMonths: number;
  paidThroughMonth: string | null;
}

interface BalanceDebtorsBody {
  month: string;
  count: number;
  totalDebt: string;
  debtors: Array<{ studentId: string; debtAmount: string; unpaidMonths: number; paidThroughMonth: string | null }>;
}

async function balance(studentId: string, month: string): Promise<BalanceBody> {
  const res = await api().get(`/students/${studentId}/balance`).query({ month });
  expect(res.status).toBe(200);
  return res.body as BalanceBody;
}

async function balanceDebtors(month: string): Promise<BalanceDebtorsBody> {
  const res = await api().get('/balances/debtors').query({ month });
  expect(res.status).toBe(200);
  return res.body as BalanceDebtorsBody;
}

describe('carry-forward balance', () => {
  it('spreads an overpayment over the following months (200 000 fee, 1 000 000 paid = 5 months)', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-01' });
    await createPayment(s.id, '1000000', '2026-01-10');

    for (const month of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']) {
      expect((await balance(s.id, month)).debtAmount).toBe('0.00');
      expect((await balanceDebtors(month)).count).toBe(0);
    }
    expect(await balance(s.id, '2026-02')).toMatchObject({
      monthsBilled: 2,
      totalDue: '400000.00',
      totalPaid: '1000000.00',
      creditAmount: '600000.00',
      paidThroughMonth: '2026-05',
    });

    const june = await balanceDebtors('2026-06');
    expect(june.count).toBe(1);
    expect(june.debtors[0]).toMatchObject({ studentId: s.id, debtAmount: '200000.00', unpaidMonths: 1 });
  });

  it('keeps the assignment endpoint month-only: the same student is a debtor in /debtors for February', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-01' });
    await createPayment(s.id, '1000000', '2026-01-10');
    const res = await api().get('/debtors').query({ month: '2026-02' });
    expect(res.body.count).toBe(1);
    expect(res.body.debtors[0].debtAmount).toBe('200000.00');
  });

  it('pays the oldest unpaid month first', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-09' });
    // Nothing paid in September; 400 000 paid in October clears September and October.
    await createPayment(s.id, '400000', '2026-10-05');

    expect(await balance(s.id, '2026-09')).toMatchObject({ debtAmount: '0.00', paidThroughMonth: '2026-10' });
    expect(await balance(s.id, '2026-10')).toMatchObject({ debtAmount: '0.00', creditAmount: '0.00' });
    expect((await balance(s.id, '2026-11')).debtAmount).toBe('200000.00');
  });

  it('accumulates unpaid months and reports a partial month', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-07' });
    await createPayment(s.id, '300000', '2026-07-01');

    // Jul paid, Aug half paid, Sep and Oct unpaid.
    expect(await balance(s.id, '2026-10')).toMatchObject({
      monthsBilled: 4,
      totalDue: '800000.00',
      debtAmount: '500000.00',
      unpaidMonths: 3,
      paidThroughMonth: '2026-07',
    });
    const report = await balanceDebtors('2026-10');
    expect(report.totalDebt).toBe('500000.00');
  });

  it('counts a late payment for an earlier month', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-09' });
    await createPayment(s.id, '200000', '2026-11-20'); // paid in November, covers September
    expect((await balance(s.id, '2026-09')).debtAmount).toBe('0.00');
  });

  it('does not bill months before the start month', async () => {
    const s = await createStudent({ monthlyFee: '200000', startMonth: '2026-10' });
    expect(await balance(s.id, '2026-08')).toMatchObject({ monthsBilled: 0, totalDue: '0.00', debtAmount: '0.00' });
    expect((await balanceDebtors('2026-08')).count).toBe(0);
    expect((await balanceDebtors('2026-10')).count).toBe(1);
  });

  it('never bills a zero-fee student', async () => {
    const s = await createStudent({ monthlyFee: '0', startMonth: '2026-01' });
    expect(await balance(s.id, '2026-10')).toMatchObject({ debtAmount: '0.00', unpaidMonths: 0, paidThroughMonth: null });
    expect((await balanceDebtors('2026-10')).count).toBe(0);
  });

  it('uses exact decimals', async () => {
    const s = await createStudent({ monthlyFee: '0.40', startMonth: '2026-01' });
    await createPayment(s.id, '0.70', '2026-01-01');
    await createPayment(s.id, '0.10', '2026-01-02'); // 0.80 = exactly two months
    expect(await balance(s.id, '2026-02')).toMatchObject({ debtAmount: '0.00', creditAmount: '0.00', paidThroughMonth: '2026-02' });
    expect((await balance(s.id, '2026-03')).debtAmount).toBe('0.40');
  });

  it('handles a prepayment far beyond year 9999 without overflowing', async () => {
    const s = await createStudent({ monthlyFee: '0.01', startMonth: '2026-01' });
    await createPayment(s.id, '9999999999.99', '2026-01-01');
    const body = await balance(s.id, '2026-01');
    expect(body.debtAmount).toBe('0.00');
    expect(body.paidThroughMonth).toMatch(/^\d{5,}-\d{2}$/);
  });

  it('orders balance debtors by debt and sums the total', async () => {
    const one = await createStudent({ name: 'One month', monthlyFee: '100000', startMonth: '2026-10' });
    const three = await createStudent({ name: 'Three months', monthlyFee: '100000', startMonth: '2026-08' });
    const report = await balanceDebtors('2026-10');
    expect(report.debtors.map((d) => [d.studentId, d.unpaidMonths])).toEqual([
      [three.id, 3],
      [one.id, 1],
    ]);
    expect(report.totalDebt).toBe('400000.00');
  });

  it('defaults the student balance month to the current month', async () => {
    const s = await createStudent();
    const res = await api().get(`/students/${s.id}/balance`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe(new Date().toISOString().slice(0, 7));
  });

  it('validates ids and months', async () => {
    const s = await createStudent();
    expect((await api().get(`/students/${randomUUID()}/balance`)).status).toBe(404);
    expect((await api().get('/students/abc/balance')).status).toBe(400);
    expect((await api().get(`/students/${s.id}/balance`).query({ month: '2026-13' })).status).toBe(400);
    expect((await api().get('/balances/debtors')).status).toBe(400);
    expect((await api().get('/balances/debtors').query({ month: '2026-1' })).status).toBe(400);
  });
});
