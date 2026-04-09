import { Router } from 'express';

import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import verificationRoutes from './verificationRoutes';
import blockchainRoutes from './blockchainRoutes';
import documentRoutes from './documentRoutes';
import dashboardRoutes from './dashboardRoutes';
import panRoutes from './panRoutes';
import aadhaarRoutes from './aadhaarRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/verification', verificationRoutes);
router.use('/blockchain', blockchainRoutes);
router.use('/documents', documentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/pan', panRoutes);
router.use('/aadhaar', aadhaarRoutes);

export default router;
