import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { ensureGenesisBlock } from './services/blockchainService.js';

const bootstrap = async () => {
  try {
    await ensureGenesisBlock();

    const server = app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`SecureBank backend running on port ${env.PORT}`);
    });

    const gracefulShutdown = async () => {
      // eslint-disable-next-line no-console
      console.log('Shutting down server...');
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

void bootstrap();
