import { Router } from 'express';
import * as controller from './students.controller';

// Express 5 forwards rejected promises from async handlers to the error handler.
export const studentsRouter = Router();

studentsRouter.post('/', controller.create);
studentsRouter.get('/', controller.list);
studentsRouter.get('/:id', controller.getById);
studentsRouter.put('/:id', controller.update);
studentsRouter.delete('/:id', controller.remove);
