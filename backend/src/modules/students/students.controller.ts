import type { Request, Response } from 'express';
import { idParamSchema } from '../../common/validation';
import { studentInputSchema } from './students.schemas';
import * as studentsService from './students.service';

export async function create(req: Request, res: Response): Promise<void> {
  const input = studentInputSchema.parse(req.body);
  res.status(201).json(await studentsService.createStudent(input));
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.json(await studentsService.listStudents());
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json(await studentsService.getStudent(id));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = studentInputSchema.parse(req.body);
  res.json(await studentsService.updateStudent(id, input));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  await studentsService.deleteStudent(id);
  res.status(204).end();
}
