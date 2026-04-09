import { NextFunction, Response } from 'express';
import { z } from 'zod';

import { AuthenticatedRequest } from '../types';
import { getProfile, loginUser, registerUser } from '../services/authService';
import { AppError } from '../utils/errors';

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  accountNumber: z.string().min(6).max(20).optional(),
  phone: z.string().optional(),
  address: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const register = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await registerUser(payload);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await loginUser(payload.email, payload.password);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Missing auth context');
    }

    const profile = await getProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};
