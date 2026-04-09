import { Role } from '@prisma/client';
import { NextFunction, Response, Router } from 'express';

import { getSummary, getUserDashboard } from '../controllers/dashboardController';
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
		throw new AppError(403, 'You cannot view this dashboard');
	}

	next();
};

router.get('/summary', authenticate, authorizeRoles(Role.ADMIN), getSummary);
router.get('/user/:userId', authenticate, ensureSelfOrAdmin, getUserDashboard);

export default router;
