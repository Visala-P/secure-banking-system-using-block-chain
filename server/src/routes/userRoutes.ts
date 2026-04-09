import { Role } from '@prisma/client';
import { Router } from 'express';

import { getUser, getUsers, patchUserStatus } from '../controllers/userController';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate, authorizeRoles(Role.ADMIN));

router.get('/', getUsers);
router.get('/:userId', getUser);
router.patch('/:userId/status', patchUserStatus);

export default router;
