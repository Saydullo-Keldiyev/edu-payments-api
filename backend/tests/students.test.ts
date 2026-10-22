import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { api, createPayment, createStudent, resetDatabase, studentPayload } from './helpers';

beforeEach(resetDatabase);
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /students', () => {
  it('creates a student and returns 201 with money as a fixed decimal string', async () => {
    const res = await api()
      .post('/students')
      .send({ name: '  Dilnoza Karimova ', phone: '+998 (90) 123-45-67', groupName: 'IELTS 7', monthlyFee: 650000 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Dilnoza Karimova',
      phone: '+998901234567',
      groupName: 'IELTS 7',
      monthlyFee: '650000.00',
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof res.body.createdAt).toBe('string');
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it.each([
    ['missing name', { name: undefined }],
    ['blank name', { name: '   ' }],
    ['invalid phone', { phone: '12ab' }],
    ['negative fee', { monthlyFee: -1 }],
    ['fee with 3 decimals', { monthlyFee: '100.005' }],
    ['non-numeric fee', { monthlyFee: 'abc' }],
    ['fee too large', { monthlyFee: '99999999999' }],
    ['boolean fee', { monthlyFee: true }],
  ])('rejects %s with 400', async (_label, overrides) => {
    const res = await api().post('/students').send(studentPayload(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown fields', async () => {
    const res = await api()
      .post('/students')
      .send(studentPayload({ id: randomUUID() }));
    expect(res.status).toBe(400);
  });

  it('returns 409 when the phone is already used (after normalization)', async () => {
    await createStudent({ phone: '+998901112233' });
    const res = await api()
      .post('/students')
      .send(studentPayload({ phone: '+998 90 111 22 33' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('startMonth (first billed month)', () => {
  it('defaults to the current month on create', async () => {
    const student = await createStudent();
    expect(student.startMonth).toBe(new Date().toISOString().slice(0, 7));
  });

  it('can be set on create and changed on update; omitting it on update keeps it', async () => {
    const student = await createStudent({ startMonth: '2026-01' });
    expect(student.startMonth).toBe('2026-01');

    const kept = await api().put(`/students/${student.id}`).send(studentPayload({ phone: student.phone }));
    expect(kept.body.startMonth).toBe('2026-01');

    const changed = await api()
      .put(`/students/${student.id}`)
      .send(studentPayload({ phone: student.phone, startMonth: '2025-09' }));
    expect(changed.body.startMonth).toBe('2025-09');
  });

  it.each(['2026-13', '2026-1', '2026-01-01', 'abc'])('rejects startMonth %s', async (startMonth) => {
    const res = await api().post('/students').send(studentPayload({ startMonth }));
    expect(res.status).toBe(400);
  });
});

describe('GET /students', () => {
  it('returns an empty list when there are no students', async () => {
    const res = await api().get('/students');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all students, newest first', async () => {
    const first = await createStudent({ name: 'First' });
    const second = await createStudent({ name: 'Second' });
    const res = await api().get('/students');
    expect(res.status).toBe(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([second.id, first.id]);
  });
});

describe('GET /students/:id', () => {
  it('returns the student', async () => {
    const student = await createStudent();
    const res = await api().get(`/students/${student.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(student);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await api().get('/students/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await api().get(`/students/${randomUUID()}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /students/:id', () => {
  it('replaces the student fields', async () => {
    const student = await createStudent();
    const res = await api()
      .put(`/students/${student.id}`)
      .send({ name: 'Renamed', phone: '+998935554433', groupName: 'Math A', monthlyFee: '720000.5' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: student.id,
      name: 'Renamed',
      phone: '+998935554433',
      groupName: 'Math A',
      monthlyFee: '720000.50',
    });
  });

  it('allows keeping the same phone', async () => {
    const student = await createStudent();
    const res = await api()
      .put(`/students/${student.id}`)
      .send(studentPayload({ phone: student.phone, name: 'Same phone' }));
    expect(res.status).toBe(200);
  });

  it('requires every field (PUT is a full replacement)', async () => {
    const student = await createStudent();
    const res = await api().put(`/students/${student.id}`).send({ name: 'Only name' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when taking another student phone', async () => {
    const a = await createStudent();
    const b = await createStudent();
    const res = await api()
      .put(`/students/${b.id}`)
      .send(studentPayload({ phone: a.phone }));
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown id and 400 for a malformed id', async () => {
    expect((await api().put(`/students/${randomUUID()}`).send(studentPayload())).status).toBe(404);
    expect((await api().put('/students/123').send(studentPayload())).status).toBe(400);
  });
});

describe('DELETE /students/:id', () => {
  it('deletes a student without payments', async () => {
    const student = await createStudent();
    const res = await api().delete(`/students/${student.id}`);
    expect(res.status).toBe(204);
    expect((await api().get(`/students/${student.id}`)).status).toBe(404);
  });

  it('refuses to delete a student with payment history', async () => {
    const student = await createStudent();
    await createPayment(student.id, '100000', '2026-01-10');
    const res = await api().delete(`/students/${student.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual({ paymentCount: 1 });
    expect((await api().get(`/students/${student.id}`)).status).toBe(200);
  });

  it('returns 404 for an unknown id and 400 for a malformed id', async () => {
    expect((await api().delete(`/students/${randomUUID()}`)).status).toBe(404);
    expect((await api().delete('/students/xyz')).status).toBe(400);
  });
});
