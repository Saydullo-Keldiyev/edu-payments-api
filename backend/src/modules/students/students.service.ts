import type { Student } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { formatMoney } from '../../lib/money';
import { isPrismaError } from '../../lib/prisma-errors';
import { ConflictError, NotFoundError } from '../../common/errors';
import { currentUtcMonth, dateFromIsoDate, isoDateFromDate } from '../../common/validation';
import type { StudentInput } from './students.schemas';

export interface StudentDto {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  monthlyFee: string;
  /** First billed month, YYYY-MM. */
  startMonth: string;
  createdAt: string;
  updatedAt: string;
}

export function toStudentDto(student: Student): StudentDto {
  return {
    id: student.id,
    name: student.name,
    phone: student.phone,
    groupName: student.groupName,
    monthlyFee: formatMoney(student.monthlyFee),
    startMonth: isoDateFromDate(student.billingStart).slice(0, 7),
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  };
}

const billingStart = (month: string) => dateFromIsoDate(`${month}-01`);

const phoneConflict = () => new ConflictError('Phone number is already used by another student', { field: 'phone' });

export async function createStudent({ startMonth, ...fields }: StudentInput): Promise<StudentDto> {
  try {
    const student = await prisma.student.create({
      data: { ...fields, billingStart: billingStart(startMonth ?? currentUtcMonth()) },
    });
    return toStudentDto(student);
  } catch (err) {
    if (isPrismaError(err, 'P2002')) throw phoneConflict();
    throw err;
  }
}

export async function listStudents(): Promise<StudentDto[]> {
  const students = await prisma.student.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  return students.map(toStudentDto);
}

export async function getStudent(id: string): Promise<StudentDto> {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundError('Student not found');
  return toStudentDto(student);
}

export async function updateStudent(id: string, { startMonth, ...fields }: StudentInput): Promise<StudentDto> {
  try {
    const student = await prisma.student.update({
      where: { id },
      data: startMonth === undefined ? fields : { ...fields, billingStart: billingStart(startMonth) },
    });
    return toStudentDto(student);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) throw new NotFoundError('Student not found');
    if (isPrismaError(err, 'P2002')) throw phoneConflict();
    throw err;
  }
}

export async function deleteStudent(id: string): Promise<void> {
  const student = await prisma.student.findUnique({
    where: { id },
    select: { _count: { select: { payments: true } } },
  });
  if (!student) throw new NotFoundError('Student not found');

  if (student._count.payments > 0) {
    throw new ConflictError('Cannot delete a student with payment history', {
      paymentCount: student._count.payments,
    });
  }

  try {
    await prisma.student.delete({ where: { id } });
  } catch (err) {
    // A payment created between the check and the delete trips the ON DELETE RESTRICT foreign key.
    if (isPrismaError(err, 'P2003')) throw new ConflictError('Cannot delete a student with payment history');
    if (isPrismaError(err, 'P2025')) throw new NotFoundError('Student not found');
    throw err;
  }
}
