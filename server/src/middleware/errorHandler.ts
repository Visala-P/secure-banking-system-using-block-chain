import { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/errors';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const responseBody: Record<string, unknown> = {
    message: err.message || 'Internal server error'
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responseBody.stack = err.stack;
  }

  if (err instanceof AppError && err.details) {
    responseBody.details = err.details;
  }

  res.status(statusCode).json(responseBody);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Route not found' });
};
