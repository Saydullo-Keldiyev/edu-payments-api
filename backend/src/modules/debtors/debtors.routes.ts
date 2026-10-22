import { Router } from 'express';
import * as controller from './debtors.controller';

export const debtorsRouter = Router();

debtorsRouter.get('/', controller.list);
