import { VerificationStatus } from '@prisma/client';
import { NextFunction, Response } from 'express';
import { z } from 'zod';

import { AuthenticatedRequest } from '../types';
import { getUserById, listUsers, updateKycStatus } from '../services/userService';

const listQuerySchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
  search: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(VerificationStatus)
});

export const getUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const data = await listUsers(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const patchUserStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const payload = updateStatusSchema.parse(req.body);
    const user = await updateKycStatus(userId, payload.status);
    res.json(user);
  } catch (error) {
    next(error);
  }
};
