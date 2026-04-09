import { DocumentType, Role, VerificationMethod, VerificationStatus } from '@prisma/client';
import { NextFunction, Response } from 'express';
import { z } from 'zod';

import { AuthenticatedRequest } from '../types/index.js';
import {
  CreateVerificationInput,
  createVerificationRecord,
  getVerificationById,
  getVerificationsForUser,
  listVerifications,
  updateVerificationStatus
} from '../services/verificationService.js';
import { submitVerificationWorkflow } from '../services/verificationWorkflowService.js';
import { AppError } from '../utils/errors.js';

const listQuerySchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
  userId: z.string().optional(),
  search: z.string().optional()
});

const createSchema = z.object({
  userId: z.string().min(1),
  action: z.string().min(3),
  status: z.nativeEnum(VerificationStatus),
  documentType: z.nativeEnum(DocumentType).optional(),
  notes: z.string().optional(),
  autoVerified: z.boolean().optional(),
  confidence: z.number().min(0).max(100).optional(),
  verificationMethod: z.nativeEnum(VerificationMethod).optional(),
  verifiedBy: z.string().optional()
});

const updateSchema = z.object({
  status: z.nativeEnum(VerificationStatus),
  notes: z.string().optional()
});

const submitSchema = z.object({
  userId: z.string().min(1),
  action: z.string().min(3).default('PAN Verification'),
  panDetails: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    dob: z.string().trim().min(1)
  }),
  aadhaarDetails: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    dob: z.string().trim().min(1)
  })
});

export const getVerifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const data = await listVerifications(filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { verificationId } = req.params;
    const record = await getVerificationById(verificationId);
    res.json(record);
  } catch (error) {
    next(error);
  }
};

export const createVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payload = createSchema.parse(req.body) as CreateVerificationInput;
    const record = await createVerificationRecord(payload);
    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
};

export const getUserVerificationHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const history = await getVerificationsForUser(userId);
    res.json(history);
  } catch (error) {
    next(error);
  }
};

export const patchVerificationStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { verificationId } = req.params;
    const payload = updateSchema.parse(req.body);
    const record = await updateVerificationStatus(verificationId, payload.status, payload.notes);
    res.json(record);
  } catch (error) {
    next(error);
  }
};

export const submitVerificationRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = submitSchema.parse(req.body);
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }
    if (req.user.role !== Role.ADMIN && req.user.userId !== payload.userId) {
      throw new AppError(403, 'You cannot submit verification for this user');
    }
    const result = await submitVerificationWorkflow(payload.userId, payload.action, {
      panDetails: payload.panDetails,
      aadhaarDetails: payload.aadhaarDetails
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};
