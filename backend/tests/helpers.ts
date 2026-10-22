import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();
export const api = () => request(app);

/** Wipes all data between tests. Safe only because tests run against TEST_DATABASE_URL. */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "payments", "students" RESTART IDENTITY CASCADE');
}

let phoneCounter = 0;

export function studentPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  phoneCounter += 1;
  return {
    name: 'Ali Valiyev',
    phone: `+99890${String(1000000 + phoneCounter).slice(-7)}`,
    groupName: 'English B1',
    monthlyFee: '500000.00',
    ...overrides,
  };
}

export interface StudentBody {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  startMonth: string;
  createdAt: string;
  updatedAt: string;
}

export async function createStudent(overrides: Record<string, unknown> = {}): Promise<StudentBody> {
  const res = await api().post('/students').send(studentPayload(overrides));
  expect(res.status).toBe(201);
  return res.body as StudentBody;
}

export async function createPayment(studentId: string, amount: string | number, paymentDate: string): Promise<void> {
  const res = await api().post('/payments').send({ studentId, amount, paymentDate });
  expect(res.status).toBe(201);
}
