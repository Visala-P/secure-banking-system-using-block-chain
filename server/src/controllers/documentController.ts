import { DocumentStatus, DocumentType } from '@prisma/client';
import fs from 'fs/promises';
import { NextFunction, Response } from 'express';
import { z } from 'zod';

import { AuthenticatedRequest } from '../types/index.js';
import { listDocumentsForUser, saveDocument, updateDocumentStatus } from '../services/documentService.js';
import { AppError } from '../utils/errors.js';

const uploadSchema = z.object({
  userId: z.string(),
  verificationId: z.string().optional(),
  type: z.nativeEnum(DocumentType)
});

const updateSchema = z.object({
  status: z.nativeEnum(DocumentStatus),
  notes: z.string().optional()
});

export const uploadDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'Document file missing');
    }

    const payload = uploadSchema.parse(req.body);

    const document = await saveDocument({
      userId: payload.userId,
      verificationId: payload.verificationId,
      type: payload.type,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size
    });

    res.status(201).json(document);
  } catch (error) {
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => undefined);
    }
    next(error);
  }
};

export const updateDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { documentId } = req.params;
    const payload = updateSchema.parse(req.body);
    const document = await updateDocumentStatus(documentId, payload.status, payload.notes);
    res.json(document);
  } catch (error) {
    next(error);
  }
};

export const getUserDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const documents = await listDocumentsForUser(userId);
    res.json(documents);
  } catch (error) {
    next(error);
  }
};
