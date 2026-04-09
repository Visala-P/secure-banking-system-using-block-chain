import { DocumentType, Prisma, VerificationMethod, VerificationRecord, VerificationStatus } from '@prisma/client';

import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { appendBlockForVerification } from './blockchainService.js';

interface VerificationFilters {
  status?: VerificationStatus;
  userId?: string;
  search?: string;
}

export interface CreateVerificationInput {
  userId: string;
  action: string;
  status: VerificationStatus;
  documentType?: DocumentType;
  notes?: string;
  autoVerified?: boolean;
  confidence?: number;
  verificationMethod?: VerificationMethod;
  verifiedBy?: string;
}

const verificationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      kycStatus: true
    }
  },
  block: true,
  documentUploads: true
} satisfies Prisma.VerificationRecordInclude;

export const listVerifications = async (filters: VerificationFilters = {}) => {
  const where: Prisma.VerificationRecordWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.search) {
    where.OR = [
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      { userId: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  return prisma.verificationRecord.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    include: verificationInclude
  });
};

export const getVerificationById = async (verificationId: string) => {
  const record = await prisma.verificationRecord.findUnique({
    where: { id: verificationId },
    include: verificationInclude
  });

  if (!record) {
    throw new AppError(404, 'Verification record not found');
  }

  return record;
};

export const getVerificationsForUser = async (userId: string) => {
  return prisma.verificationRecord.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    include: verificationInclude
  });
};

export const createVerificationRecord = async (input: CreateVerificationInput) => {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const verification = await tx.verificationRecord.create({
      data: {
        userId: input.userId,
        action: input.action,
        status: input.status,
        documentType: input.documentType,
        notes: input.notes,
        autoVerified: Boolean(input.autoVerified),
        confidence: input.confidence,
        verificationMethod: input.verificationMethod ?? VerificationMethod.automated,
        verifiedBy: input.verifiedBy ?? 'SYSTEM'
      }
    });

    await tx.user.update({
      where: { id: input.userId },
      data: {
        kycStatus: input.status,
        verificationCount: { increment: 1 },
        lastActivity: new Date()
      }
    });

    await tx.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        status: input.status,
        referenceId: verification.id,
        metadata: {
          notes: input.notes,
          autoVerified: Boolean(input.autoVerified),
          documentType: input.documentType
        }
      }
    });

    await appendBlockForVerification(verification, tx);

    return tx.verificationRecord.findUnique({
      where: { id: verification.id },
      include: verificationInclude
    });
  });
};

export const updateVerificationStatus = async (
  verificationId: string,
  status: VerificationStatus,
  notes?: string
): Promise<VerificationRecord> => {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const verification = await tx.verificationRecord.update({
      where: { id: verificationId },
      data: {
        status,
        notes
      }
    });

    await tx.user.update({
      where: { id: verification.userId },
      data: {
        kycStatus: status,
        lastActivity: new Date()
      }
    });

    await tx.activityLog.create({
      data: {
        userId: verification.userId,
        action: `Status updated to ${status}`,
        status,
        referenceId: verification.id
      }
    });

    return verification;
  });
};
