import crypto from 'crypto';

export interface BlockPayload {
  userId: string;
  verificationId: string;
  action: string;
  status: string;
  verifiedBy?: string | null;
  timestamp: string;
  [key: string]: string | null | undefined;
}

export interface BlockCandidate {
  blockNumber: number;
  previousHash: string;
  data: BlockPayload;
}

export interface MinedBlock extends BlockCandidate {
  nonce: number;
  hash: string;
  timestamp: string;
}

const DIFFICULTY = 4;
const PREFIX = '0'.repeat(DIFFICULTY);

export const ZERO_HASH = '0'.repeat(64);

export const calculateHash = (candidate: {
  blockNumber: number;
  previousHash: string;
  timestamp: string;
  data: BlockPayload;
  nonce: number;
}): string => {
  const payload = `${candidate.blockNumber}|${candidate.previousHash}|${candidate.timestamp}|${JSON.stringify(
    candidate.data
  )}|${candidate.nonce}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

export const mineBlock = (candidate: BlockCandidate): MinedBlock => {
  let nonce = 0;
  let timestamp = new Date().toISOString();
  let hash = '';

  do {
    nonce += 1;
    timestamp = new Date().toISOString();
    hash = calculateHash({
      blockNumber: candidate.blockNumber,
      previousHash: candidate.previousHash,
      timestamp,
      data: candidate.data,
      nonce
    });
  } while (!hash.startsWith(PREFIX));

  return {
    ...candidate,
    nonce,
    timestamp,
    hash
  };
};

export const verifyLink = (current: MinedBlock, previous?: MinedBlock | null): boolean => {
  if (!previous && current.blockNumber === 0) {
    return current.previousHash === ZERO_HASH && current.hash === current.previousHash;
  }

  if (!previous) {
    return false;
  }

  const recalculated = calculateHash({
    blockNumber: current.blockNumber,
    previousHash: current.previousHash,
    timestamp: current.timestamp,
    data: current.data,
    nonce: current.nonce
  });

  return current.previousHash === previous.hash && recalculated === current.hash;
};

export const isBlockPayload = (value: unknown): value is BlockPayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.userId === 'string' &&
    typeof payload.verificationId === 'string' &&
    typeof payload.action === 'string' &&
    typeof payload.status === 'string' &&
    typeof payload.timestamp === 'string'
  );
};
