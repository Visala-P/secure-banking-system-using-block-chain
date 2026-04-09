import { Role, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { generateAccountNumber } from '../utils/account.js';
import { AppError } from '../utils/errors.js';
import { buildUserQrPayload } from '../utils/qr.js';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  accountNumber?: string;
  phone?: string;
  address?: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'> & { qrCodePayload: string };
  token: string;
}

const sanitizeUser = (user: User): Omit<User, 'passwordHash'> & { qrCodePayload: string } => {
  const { passwordHash, ...safeUser } = user;
  return {
    ...safeUser,
    qrCodePayload: buildUserQrPayload({
      userId: user.id,
      accountNumber: user.accountNumber,
      joinedDate: user.joinedDate
    })
  };
};

const createToken = (user: User): string =>
  jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    env.JWT_SECRET,
    {
      expiresIn: '2h',
      subject: user.id
    }
  );

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new AppError(409, 'Email already exists');
  }

  const accountNumber = input.accountNumber ?? generateAccountNumber();
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx: Parameters<typeof prisma.$transaction>[0] extends (...args: infer A) => infer R ? A[0] : never) => {
    const createdUser = await tx.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        accountNumber,
        role: Role.USER,
        phone: input.phone,
        address: input.address,
        lastActivity: new Date()
      }
    });

    await tx.activityLog.create({
      data: {
        userId: createdUser.id,
        action: 'User registered',
        status: 'pending',
        metadata: {
          email: createdUser.email,
          accountNumber: createdUser.accountNumber
        }
      }
    });

    return createdUser;
  });

  return {
    user: sanitizeUser(user),
    token: createToken(user)
  };
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    throw new AppError(401, 'Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new AppError(401, 'Invalid credentials');
  }

  return {
    user: sanitizeUser(user),
    token: createToken(user)
  };
};

export const getProfile = async (
  userId: string
): Promise<Omit<User, 'passwordHash'> & { qrCodePayload: string }> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  return sanitizeUser(user);
};
