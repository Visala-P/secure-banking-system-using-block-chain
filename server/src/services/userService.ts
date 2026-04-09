import { Prisma, VerificationStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';

const userSelect = {
  id: true,
  name: true,
  email: true,
  accountNumber: true,
  role: true,
  kycStatus: true,
  verificationCount: true,
  lastActivity: true,
  joinedDate: true,
  phone: true,
  address: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

interface ListUsersFilters {
  status?: VerificationStatus;
  search?: string;
}

export const listUsers = async (filters: ListUsersFilters = {}) => {
  const where: Prisma.UserWhereInput = {};

  if (filters.status) {
    where.kycStatus = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { accountNumber: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      ...userSelect,
      verifications: {
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          status: true,
          timestamp: true,
          block: {
            select: {
              blockNumber: true,
              hash: true
            }
          }
        }
      }
    }
  });
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userSelect,
      verifications: {
        orderBy: { timestamp: 'desc' },
        include: {
          block: true
        }
      },
      documents: {
        orderBy: { uploadedAt: 'desc' }
      }
    }
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return user;
};

export const updateKycStatus = async (userId: string, status: VerificationStatus) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      kycStatus: status,
      lastActivity: new Date()
    },
    select: userSelect
  });

  return user;
};
