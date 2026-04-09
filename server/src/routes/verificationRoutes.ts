import { Role } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';

import {
  createVerification,
  getUserVerificationHistory,
  getVerification,
  getVerifications,
  patchVerificationStatus,
  submitVerificationRequest
} from '../controllers/verificationController';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';
import { AppError } from '../utils/errors';
import { AuthenticatedRequest } from '../types';

const router = Router();

const ensureSelfOrAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const { user } = req;
  const { userId } = req.params;

  if (!user) {
    throw new AppError(401, 'Authentication required');
  }

  if (user.role !== Role.ADMIN && user.userId !== userId) {
    throw new AppError(403, 'You cannot view this verification history');
  }

  next();
};

router.use(authenticate);

router.get('/user/:userId', ensureSelfOrAdmin, getUserVerificationHistory);
router.post('/submit', submitVerificationRequest);
router.get('/', authorizeRoles(Role.ADMIN), getVerifications);
router.post('/', authorizeRoles(Role.ADMIN), createVerification);
router.get('/:verificationId', authorizeRoles(Role.ADMIN), getVerification);
router.patch('/:verificationId/status', authorizeRoles(Role.ADMIN), patchVerificationStatus);

export default router;
