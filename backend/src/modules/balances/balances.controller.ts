import type { Request, Response } from 'express';
import { currentUtcMonth, idParamSchema } from '../../common/validation';
import { balanceDebtorsQuerySchema, studentBalanceQuerySchema } from './balances.schemas';
import * as balancesService from './balances.service';

export async function studentBalance(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { month } = studentBalanceQuerySchema.parse(req.query);
  res.json(await balancesService.getStudentBalance(id, month ?? currentUtcMonth()));
}

export async function debtors(req: Request, res: Response): Promise<void> {
  const { month } = balanceDebtorsQuerySchema.parse(req.query);
  res.json(await balancesService.getBalanceDebtors(month));
}
