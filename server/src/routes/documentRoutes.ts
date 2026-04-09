import { Role } from '@prisma/client';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { NextFunction, Response, Router } from 'express';

import { uploadDocument, updateDocument, getUserDocuments } from '../controllers/documentController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';
import { AppError } from '../utils/errors.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const ensureSelfOrAdmin = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const { user } = req;
  const { userId } = req.params;

  if (!user) {
    throw new AppError(401, 'Authentication required');
  }

  if (user.role !== Role.ADMIN && user.userId !== userId) {
    throw new AppError(403, 'You cannot view these documents');
  }

  next();
};

router.post('/upload', authenticate, upload.single('document'), uploadDocument);
router.get('/user/:userId', authenticate, ensureSelfOrAdmin, getUserDocuments);
router.patch('/:documentId/status', authenticate, authorizeRoles(Role.ADMIN), updateDocument);

export default router;
