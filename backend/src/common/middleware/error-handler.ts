import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import { env } from '../../config/env';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function body(code: string, message: string, details?: unknown): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(body('NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

/** Express error type for bodies rejected by express.json() (malformed JSON, too large, ...). */
function isBodyParserError(err: unknown): err is { type: string; status: number; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      body(
        'VALIDATION_ERROR',
        'Request validation failed',
        err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      ),
    );
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Fallbacks for races that slip past the service-level checks.
    if (err.code === 'P2002') {
      res.status(409).json(body('CONFLICT', 'A record with the same unique value already exists'));
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json(body('NOT_FOUND', 'Resource not found'));
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json(body('CONFLICT', 'Operation violates a relation constraint'));
      return;
    }
  }

  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Malformed JSON body' : err.message;
    res.status(err.status).json(body('BAD_REQUEST', message));
    return;
  }

  if (env.NODE_ENV !== 'test') {
    console.error(err);
  }
  res.status(500).json(body('INTERNAL_ERROR', 'Internal server error'));
};
