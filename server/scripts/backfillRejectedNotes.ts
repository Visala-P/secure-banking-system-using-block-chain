/// <reference types="node" />

import { DocumentStatus, VerificationStatus } from '@prisma/client';

import { prisma } from '../src/db/prisma';

const STANDARD_REJECTION_MESSAGE =
  'Invalid doc and docs submitted is not official gov issued documents.';

const runBackfill = async () => {
  console.log('\nStarting rejected-record notes backfill...');

  const verificationResult = await prisma.verificationRecord.updateMany({
    where: {
      status: VerificationStatus.rejected,
      OR: [{ notes: null }, { notes: { not: STANDARD_REJECTION_MESSAGE } }]
    },
    data: {
      notes: STANDARD_REJECTION_MESSAGE
    }
  });

  const documentResult = await prisma.documentUpload.updateMany({
    where: {
      status: DocumentStatus.rejected,
      OR: [{ processingNotes: null }, { processingNotes: { not: STANDARD_REJECTION_MESSAGE } }]
    },
    data: {
      processingNotes: STANDARD_REJECTION_MESSAGE
    }
  });

  console.log('Backfill complete.');
  console.log(`Updated verification records: ${verificationResult.count}`);
  console.log(`Updated rejected documents: ${documentResult.count}`);
};

runBackfill()
  .catch(error => {
    console.error('\nBackfill failed.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
