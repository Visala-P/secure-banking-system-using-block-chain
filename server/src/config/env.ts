import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  PORT: z.coerce.number().default(4000),
  BCRYPT_SALT_ROUNDS: z.coerce.number().min(6).max(14).default(12)
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS
});
