import { Router } from 'express';
import * as controller from './balances.controller';

// Mounted at the API root: a student's balance is addressed through the student.
export const balancesRouter = Router();

balancesRouter.get('/students/:id/balance', controller.studentBalance);
balancesRouter.get('/balances/debtors', controller.debtors);
