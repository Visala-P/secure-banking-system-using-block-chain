import { Role } from '@prisma/client';
import { Request } from 'express';

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthContext;
}
