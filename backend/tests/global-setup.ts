import { execSync } from 'node:child_process';

/**
 * Runs once before the whole test run: applies all Prisma migrations to the test database
 * (creating it if needed), so tests always run against the current schema.
 */
export default function setup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is not set');
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
