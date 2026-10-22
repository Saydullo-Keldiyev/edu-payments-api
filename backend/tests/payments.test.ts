import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, createPayment, createStudent, resetDatabase } from './helpers';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /payments', () => {
  it('records a payment and returns 201', async () => {
    const student = await createStudent();
    const res = await api()
      .post('/payments')
      .send({ studentId: student.id, amount: '250000.50', paymentDate: '2026-03-15' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      studentId: student.id,
      amount: '250000.50',
      paymentDate: '2026-03-15',
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts a numeric amount without float artifacts', async () => {
    const student = await createStudent();
    const res = await api()
      .post('/payments')
      .send({ studentId: student.id, amount: 0.1, paymentDate: '2026-03-15' });
    expect(res.status).toBe(201);
    expect(res.body.amount).toBe('0.10');
  });

  it.each([
    ['zero amount', { amount: 0 }],
    ['zero amount string', { amount: '0.00' }],
    ['negative amount', { amount: -100 }],
    ['negative amount string', { amount: '-100' }],
    ['3 decimal places', { amount: '10.001' }],
    ['non-numeric amount', { amount: 'ten' }],
    ['amount in exponent form', { amount: '1e5' }],
    ['amount too large', { amount: '12345678901' }],
    ['missing amount', { amount: undefined }],
    ['null amount', { amount: null }],
    ['invalid student id', { studentId: 'abc' }],
    ['missing student id', { studentId: undefined }],
    ['missing date', { paymentDate: undefined }],
    ['non-ISO date', { paymentDate: '15/03/2026' }],
    ['impossible date', { paymentDate: '2026-02-30' }],
    ['month 13', { paymentDate: '2026-13-01' }],
    ['datetime instead of date', { paymentDate: '2026-03-15T10:00:00Z' }],
  ])('rejects %s with 400', async (_label, overrides) => {
    const student = await createStudent();
    const res = await api()
      .post('/payments')
      .send({ studentId: student.id, amount: '1000', paymentDate: '2026-03-15', ...overrides });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.payment.count()).toBe(0);
  });

  it('accepts 29 February in a leap year', async () => {
    const student = await createStudent();
    const res = await api()
      .post('/payments')
      .send({ studentId: student.id, amount: '1000', paymentDate: '2028-02-29' });
    expect(res.status).toBe(201);
  });

  it('returns 404 when the student does not exist', async () => {
    const res = await api()
      .post('/payments')
      .send({ studentId: randomUUID(), amount: '1000', paymentDate: '2026-03-15' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Student not found');
  });
});

describe('GET /students/:id/payments', () => {
  it('returns the student payments, newest payment date first', async () => {
    const student = await createStudent();
    const other = await createStudent();
    await createPayment(student.id, '100000', '2026-01-05');
    await createPayment(student.id, '200000', '2026-02-05');
    await createPayment(other.id, '999', '2026-02-06');

    const res = await api().get(`/students/${student.id}/payments`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((p: { paymentDate: string; amount: string }) => [p.paymentDate, p.amount])).toEqual([
      ['2026-02-05', '200000.00'],
      ['2026-01-05', '100000.00'],
    ]);
  });

  it('returns an empty list for a student without payments', async () => {
    const student = await createStudent();
    const res = await api().get(`/students/${student.id}/payments`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 404 for an unknown student and 400 for a malformed id', async () => {
    expect((await api().get(`/students/${randomUUID()}/payments`)).status).toBe(404);
    expect((await api().get('/students/42/payments')).status).toBe(400);
  });
});
