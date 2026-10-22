import { Prisma } from '@prisma/client';

/** P2002 unique violation, P2003 foreign key violation, P2025 record not found. */
export function isPrismaError(err: unknown, code: 'P2002' | 'P2003' | 'P2025'): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}
