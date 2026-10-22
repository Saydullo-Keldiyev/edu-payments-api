import type { Request, Response } from 'express';
import { idParamSchema } from '../../common/validation';
import { createPaymentSchema } from './payments.schemas';
import * as paymentsService from './payments.service';

export async function create(req: Request, res: Response): Promise<void> {
  const input = createPaymentSchema.parse(req.body);
  res.status(201).json(await paymentsService.createPayment(input));
}

export async function listForStudent(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json(await paymentsService.listStudentPayments(id));
}
