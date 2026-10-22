import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler';
import { balancesRouter } from './modules/balances/balances.routes';
import { debtorsRouter } from './modules/debtors/debtors.routes';
import { healthRouter } from './modules/health/health.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { studentsRouter } from './modules/students/students.routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/health', healthRouter);
  app.use('/students', studentsRouter);
  app.use(paymentsRouter);
  app.use('/debtors', debtorsRouter);
  app.use(balancesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
