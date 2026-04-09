import { DocumentStatus, DocumentType } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';

import { prisma } from '../db/prisma';

interface SaveDocumentInput {
  userId: string;
  verificationId?: string;
  type: DocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  status?: DocumentStatus;
  processingNotes?: string;
}

const computeChecksum = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  const uint8View = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
  return crypto.createHash('sha256').update(uint8View).digest('hex');
};

export const saveDocument = async (input: SaveDocumentInput) => {
  const checksum = computeChecksum(input.filePath);

  return prisma.documentUpload.create({
    data: {
      userId: input.userId,
      verificationId: input.verificationId,
      type: input.type,
      status: input.status ?? DocumentStatus.processing,
      fileName: input.fileName,
      filePath: input.filePath,
      fileSize: input.fileSize,
      checksum,
      processingNotes: input.processingNotes
    }
  });
};

export const updateDocumentStatus = async (
  documentId: string,
  status: DocumentStatus,
  notes?: string
) => {
  return prisma.documentUpload.update({
    where: { id: documentId },
    data: {
      status,
      processingNotes: notes,
      processedAt: new Date()
    }
  });
};

export const listDocumentsForUser = async (userId: string) => {
  return prisma.documentUpload.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' }
  });
};
