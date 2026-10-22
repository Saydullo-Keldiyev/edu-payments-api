import { Router } from 'express';
import * as controller from './payments.controller';

// Mounted at the API root: payment history is addressed through its student.
export const paymentsRouter = Router();

paymentsRouter.post('/payments', controller.create);
paymentsRouter.get('/students/:id/payments', controller.listForStudent);
