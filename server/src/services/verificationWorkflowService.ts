import { DocumentStatus, DocumentType, VerificationStatus } from '@prisma/client';

import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/errors.js';
import { saveDocument } from './documentService.js';
import { createVerificationRecord, getVerificationById } from './verificationService.js';

interface ApplicantDetails {
  firstName: string;
  lastName: string;
  dob: string;
}

interface SubmitVerificationInput {
  panDetails: ApplicantDetails;
  aadhaarDetails: ApplicantDetails;
}

interface SubmitVerificationResult {
  verification: Awaited<ReturnType<typeof getVerificationById>>;
  documents: Awaited<ReturnType<typeof prisma.documentUpload.findMany>>;
  aiDecisions: Array<{
    documentId: string;
    type: string;
    status: VerificationStatus;
    reason: string;
    confidence: number;
  }>;
}

const pickLatestDocumentsPerType = <T extends { id: string; type: string; uploadedAt: Date }>(
  documents: T[]
): T[] => {
  const latestByType = new Map<string, T>();

  for (const document of [...documents].sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())) {
    if (!latestByType.has(document.type)) {
      latestByType.set(document.type, document);
    }
  }

  return Array.from(latestByType.values()).sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime());
};

const GENERIC_REJECTION_REASON =
  'Invalid doc and docs submitted is not official gov issued documents.';

const REQUIRED_KYC_TYPES: DocumentType[] = [DocumentType.aadhaar, DocumentType.pan, DocumentType.selfie];

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeDate = (value: string): string => {
  const trimmed = value.trim();
  const ddmmyyyy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  return trimmed.toLowerCase();
};

const compareApplicantDetails = (panDetails: ApplicantDetails, aadhaarDetails: ApplicantDetails): string[] => {
  const issues: string[] = [];

  if (normalizeText(panDetails.firstName) !== normalizeText(aadhaarDetails.firstName)) {
    issues.push('PAN and Aadhaar first names must match');
  }

  if (normalizeText(panDetails.lastName) !== normalizeText(aadhaarDetails.lastName)) {
    issues.push('PAN and Aadhaar last names must match');
  }

  if (normalizeDate(panDetails.dob) !== normalizeDate(aadhaarDetails.dob)) {
    issues.push('PAN and Aadhaar dates of birth must match');
  }

  return issues;
};

const mapDocumentStatus = (status: VerificationStatus): DocumentStatus => {
  if (status === VerificationStatus.verified) {
    return DocumentStatus.verified;
  }

  if (status === VerificationStatus.rejected) {
    return DocumentStatus.rejected;
  }

  return DocumentStatus.pending;
};

export const submitVerificationWorkflow = async (
  userId: string,
  action: string,
  applicantDetails: SubmitVerificationInput
): Promise<SubmitVerificationResult> => {
  const pendingDocuments = await prisma.documentUpload.findMany({
    where: {
      userId,
      verificationId: null
    },
    orderBy: { uploadedAt: 'desc' }
  });

  const selectedPendingDocuments = pendingDocuments.length
    ? pickLatestDocumentsPerType(pendingDocuments)
    : [];

  const sourceDocuments = selectedPendingDocuments;

  if (!sourceDocuments.length) {
    throw new AppError(400, 'Please upload the current documents again before submitting verification');
  }

  if (selectedPendingDocuments.length) {
    const selectedIds = new Set(selectedPendingDocuments.map((document: typeof selectedPendingDocuments[number]) => document.id));
    const stalePendingIds = pendingDocuments
      .filter((document: typeof pendingDocuments[number]) => !selectedIds.has(document.id))
      .map((document: typeof pendingDocuments[number]) => document.id);

    if (stalePendingIds.length) {
      await prisma.documentUpload.deleteMany({
        where: {
          id: { in: stalePendingIds },
          userId,
          verificationId: null
        }
      });
    }
  }

  const detailIssues = compareApplicantDetails(applicantDetails.panDetails, applicantDetails.aadhaarDetails);

  const finalStatus: VerificationStatus =
    detailIssues.length > 0 ? VerificationStatus.rejected : VerificationStatus.verified;

  const finalReason =
    detailIssues.length > 0
      ? detailIssues.join(' | ')
      : 'PAN and Aadhaar first name, last name, and DOB matched';

  const documentTypesToInclude = Array.from(
    new Set<DocumentType>([...sourceDocuments.map(document => document.type), ...REQUIRED_KYC_TYPES])
  );

  const latestDocumentByType = new Map<DocumentType, (typeof sourceDocuments)[number]>();
  for (const document of sourceDocuments) {
    if (!latestDocumentByType.has(document.type)) {
      latestDocumentByType.set(document.type, document);
    }
  }

  const documentDecisions: SubmitVerificationResult['aiDecisions'] = documentTypesToInclude.map(type => ({
    documentId: latestDocumentByType.get(type)?.id ?? `synthetic-${type}`,
    type,
    status: finalStatus,
    reason: finalReason,
    confidence: finalStatus === VerificationStatus.verified ? 100 : 0
  }));

  const aggregatedReason =
    documentDecisions.length
      ? finalReason
      : GENERIC_REJECTION_REASON;

  const averageConfidence = Number(
    (
      documentDecisions.reduce((sum, decision) => sum + decision.confidence, 0) /
      documentDecisions.length
    ).toFixed(2)
  );

  const verification = await createVerificationRecord({
    userId,
    action,
    status: finalStatus,
    documentType: documentTypesToInclude.length === 1 ? documentTypesToInclude[0] : undefined,
    notes: aggregatedReason,
    autoVerified: true,
    confidence: averageConfidence,
    verifiedBy: 'AI ENGINE'
  });

  if (!verification) {
    throw new AppError(500, 'Unable to create verification record');
  }

  const updatedDocuments = await Promise.all(
    documentDecisions.map(async decision => {
      const document = sourceDocuments.find(entry => entry.type === decision.type);

      if (selectedPendingDocuments.length && document) {
        return prisma.documentUpload.update({
          where: { id: document.id },
          data: {
            verificationId: verification.id,
            status: mapDocumentStatus(decision.status),
            processedAt: new Date(),
            processingNotes: decision.reason
          }
        });
      }

      if (document) {
        return saveDocument({
          userId,
          verificationId: verification.id,
          type: document.type,
          fileName: (document as any).fileName,
          filePath: (document as any).filePath,
          fileSize: (document as any).fileSize,
          status: mapDocumentStatus(decision.status),
          processingNotes: decision.reason
        });
      }

      return prisma.documentUpload.create({
        data: {
          userId,
          verificationId: verification.id,
          type: decision.type as DocumentType,
          status: mapDocumentStatus(decision.status),
          fileName: `${decision.type} details`,
          filePath: `manual://${decision.type}`,
          fileSize: 0,
          checksum: null,
          processedAt: new Date(),
          processingNotes: decision.reason
        }
      });
    })
  );

  const refreshedVerification = await getVerificationById(verification.id);

  return {
    verification: refreshedVerification,
    documents: updatedDocuments,
    aiDecisions: documentDecisions
  };
};

