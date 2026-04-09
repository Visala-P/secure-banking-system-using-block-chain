import crypto from 'crypto';

export const generateAccountNumber = (): string => {
  const buffer = crypto.randomBytes(5);
  const value = parseInt(buffer.toString('hex'), 16).toString().slice(0, 10);
  return value.padStart(10, '0');
};
