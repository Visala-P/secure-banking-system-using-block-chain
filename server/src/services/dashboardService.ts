import { VerificationStatus } from '@prisma/client';

import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { buildUserQrPayload } from '../utils/qr.js';

export const getDashboardSummary = async () => {
  const [
    totalUsers,
    verifiedUsers,
    pendingUsers,
    rejectedUsers,
    totalVerifications,
    pendingVerifications,
    approvedVerifications,
    rejectedVerifications,
    totalBlocks,
    latestBlocks,
    recentActivity,
    recentVerifications
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { kycStatus: VerificationStatus.verified } }),
    prisma.user.count({ where: { kycStatus: VerificationStatus.pending } }),
    prisma.user.count({ where: { kycStatus: VerificationStatus.rejected } }),
    prisma.verificationRecord.count(),
    prisma.verificationRecord.count({ where: { status: VerificationStatus.pending } }),
    prisma.verificationRecord.count({ where: { status: VerificationStatus.verified } }),
    prisma.verificationRecord.count({ where: { status: VerificationStatus.rejected } }),
    prisma.blockchainBlock.count(),
    prisma.blockchainBlock.findMany({ orderBy: { blockNumber: 'desc' }, take: 5 }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    }),
    prisma.verificationRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: 15,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        block: {
          select: {
            blockNumber: true
          }
        }
      }
    })
  ]);

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      pending: pendingUsers,
      rejected: rejectedUsers
    },
    verifications: {
      total: totalVerifications,
      pending: pendingVerifications,
      approved: approvedVerifications,
      rejected: rejectedVerifications,
      recent: recentVerifications
    },
    blockchain: {
      totalBlocks,
      latestBlocks
    },
    recentActivity
  };
};

export const getUserDashboardSummary = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      kycStatus: true,
      accountNumber: true,
      phone: true,
      address: true,
      joinedDate: true,
      verificationCount: true,
      lastActivity: true
    }
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  const [verifications, documents] = await Promise.all([
    prisma.verificationRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      include: {
        block: {
          select: {
            blockNumber: true
          }
        },
        documentUploads: {
          select: {
            id: true,
            type: true,
            status: true,
            fileName: true,
            processingNotes: true
          }
        }
      }
    }),
    prisma.documentUpload.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' }
    })
  ]);

  const stats = {
    total: verifications.length,
    verified: verifications.filter((record: typeof verifications[number]) => record.status === VerificationStatus.verified).length,
    pending: verifications.filter((record: typeof verifications[number]) => record.status === VerificationStatus.pending).length,
    rejected: verifications.filter((record: typeof verifications[number]) => record.status === VerificationStatus.rejected).length
  };

  return {
    user: {
      ...user,
      qrCodePayload: buildUserQrPayload({
        userId: user.id,
        accountNumber: user.accountNumber,
        joinedDate: user.joinedDate
      })
    },
    stats,
    verifications,
    documents
  };
};
