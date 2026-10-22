import type { Request, Response } from 'express';
import { debtorsQuerySchema } from './debtors.schemas';
import * as debtorsService from './debtors.service';

export async function list(req: Request, res: Response): Promise<void> {
  const { month } = debtorsQuerySchema.parse(req.query);
  res.json(await debtorsService.getDebtors(month));
}
