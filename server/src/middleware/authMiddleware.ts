import { Role } from '@prisma/client';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextFunction, Response } from 'express';

import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors';

type TokenPayload = JwtPayload & {
  sub: string;
  email: string;
  role: Role;
};

export const authenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication token missing');
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };
    next();
  } catch (error) {
    throw new AppError(401, 'Invalid or expired token', error);
  }
};

export const authorizeRoles = (...roles: Role[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'You do not have permission to perform this action');
    }

    next();
  };
};
