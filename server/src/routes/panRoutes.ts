import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

import { verifyPanDetails } from '../controllers/panController';

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

router.post('/verify', upload.single('document'), verifyPanDetails);

export default router;
