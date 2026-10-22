import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

// A single shared client per process; Prisma manages its own connection pool.
// Query errors are not logged here outside development: expected ones (unique conflicts, missing
// rows) are mapped to 4xx responses, and unexpected ones are logged by the error handler.
export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn'],
});
