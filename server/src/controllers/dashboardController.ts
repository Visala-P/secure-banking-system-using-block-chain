import { NextFunction, Response } from 'express';

import { AuthenticatedRequest } from '../types/index.js';
import { getDashboardSummary, getUserDashboardSummary } from '../services/dashboardService.js';
import { AppError } from '../utils/errors.js';

export const getSummary = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const getUserDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw new AppError(400, 'User id is required');
    }

    const summary = await getUserDashboardSummary(userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
};
