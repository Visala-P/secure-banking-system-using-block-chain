import { Prisma, PrismaClient, VerificationRecord } from '@prisma/client';

import { prisma } from '../db/prisma';
import { AppError } from '../utils/errors';
import { BlockPayload, ZERO_HASH, calculateHash, isBlockPayload, mineBlock } from '../utils/blockchain';

const getClient = (tx?: Prisma.TransactionClient | PrismaClient) => tx ?? prisma;

export const ensureGenesisBlock = async () => {
  const existingGenesis = await prisma.blockchainBlock.findUnique({ where: { blockNumber: 0 } });
  if (existingGenesis) {
    return existingGenesis;
  }

  return prisma.blockchainBlock.create({
    data: {
      blockNumber: 0,
      previousHash: ZERO_HASH,
      hash: ZERO_HASH,
      nonce: 0,
      timestamp: new Date('2024-01-01T00:00:00Z'),
      data: {
        system: 'Genesis Block',
        status: 'initialized'
      }
    }
  });
};

export const appendBlockForVerification = async (
  verification: VerificationRecord,
  tx?: Prisma.TransactionClient | PrismaClient
) => {
  const client = getClient(tx);
  await ensureGenesisBlock();

  const lastBlock = await client.blockchainBlock.findFirst({
    orderBy: { blockNumber: 'desc' }
  });

  const blockNumber = lastBlock ? lastBlock.blockNumber + 1 : 1;
  const previousHash = lastBlock ? lastBlock.hash : ZERO_HASH;

  const payload: BlockPayload = {
    verificationId: verification.id,
    userId: verification.userId,
    action: verification.action,
    status: verification.status,
    verifiedBy: verification.verifiedBy,
    timestamp: verification.timestamp.toISOString()
  };

  const minedBlock = mineBlock({ blockNumber, previousHash, data: payload });

  return client.blockchainBlock.create({
    data: {
      blockNumber: minedBlock.blockNumber,
      previousHash: minedBlock.previousHash,
      hash: minedBlock.hash,
      nonce: minedBlock.nonce,
      timestamp: new Date(minedBlock.timestamp),
      data: payload,
      verificationId: verification.id
    }
  });
};

export const getBlockchain = async () => {
  return prisma.blockchainBlock.findMany({
    orderBy: { blockNumber: 'asc' },
    include: {
      verification: {
        select: {
          id: true,
          userId: true,
          action: true,
          status: true
        }
      }
    }
  });
};

export const validateBlockchain = async () => {
  const chain = await getBlockchain();
  const issues: string[] = [];

  for (let i = 0; i < chain.length; i += 1) {
    const block = chain[i];

    if (i === 0) {
      if (block.hash !== ZERO_HASH || block.previousHash !== ZERO_HASH) {
        issues.push('Genesis block hash mismatch');
      }
      continue;
    }

    const previous = chain[i - 1];
    if (block.previousHash !== previous.hash) {
      issues.push(`Block ${block.blockNumber} previous hash mismatch`);
    }

    if (!isBlockPayload(block.data)) {
      issues.push(`Block ${block.blockNumber} payload is malformed`);
      continue;
    }

    const recalculated = calculateHash({
      blockNumber: block.blockNumber,
      previousHash: block.previousHash,
      timestamp: block.timestamp.toISOString(),
      data: block.data,
      nonce: block.nonce
    });

    if (recalculated !== block.hash) {
      issues.push(`Block ${block.blockNumber} hash mismatch`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
};

export const getBlockByNumber = async (blockNumber: number) => {
  const block = await prisma.blockchainBlock.findUnique({
    where: { blockNumber },
    include: {
      verification: true
    }
  });

  if (!block) {
    throw new AppError(404, 'Block not found');
  }

  return block;
};
