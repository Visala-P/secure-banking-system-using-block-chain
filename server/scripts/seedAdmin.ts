import bcrypt from 'bcryptjs';
import { Role, VerificationStatus } from '@prisma/client';

import { prisma } from '../src/db/prisma';
import { env } from '../src/config/env';
import { generateAccountNumber } from '../src/utils/account';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bank.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@123';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Platform Administrator';

const seedAdmin = async () => {
  console.log(`\n🔐 Seeding admin account for ${ADMIN_EMAIL}`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, env.BCRYPT_SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      role: Role.ADMIN,
      kycStatus: VerificationStatus.verified,
      lastActivity: new Date()
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: Role.ADMIN,
      accountNumber: generateAccountNumber(),
      kycStatus: VerificationStatus.verified,
      phone: '+1 000 000 0000',
      address: 'SecureBank HQ',
      lastActivity: new Date()
    }
  });

  console.log('✅ Admin user ready:');
  console.log(`   Email   : ${admin.email}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('   You can change ADMIN_PASSWORD env before running the script to customize it.');
};

seedAdmin()
  .catch(error => {
    console.error('\n❌ Failed to seed admin user');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
