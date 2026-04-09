import { DocumentType, VerificationStatus } from '@prisma/client';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

import { prisma } from '../db/prisma.js';

const execFileAsync = promisify(execFile);

interface OCRResult {
  success: boolean;
  confidence: number;
  rawText: string;
  extractedData: {
    name?: string;
    documentNumber?: string;
    dateOfBirth?: string;
    gender?: string;
    keywords: string[];
  };
}

interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
  checks: {
    keywordMatch: boolean;
    formatValid: boolean;
    nameDetected: boolean;
    dobDetected: boolean;
    qualityCheck: boolean;
    suspiciousTextCheck: boolean;
    duplicateCheck: boolean;
  };
}

interface SelfieAnalysisResult {
  success: boolean;
  faceCount: number;
  estimatedAge: number | null;
  engine: string;
  error?: string;
}

const SELFIE_SCRIPT_CANDIDATES = [
  path.resolve(process.cwd(), 'ml', 'selfie_face_analyze.py'),
  path.resolve(process.cwd(), 'server', 'ml', 'selfie_face_analyze.py')
];

const PYTHON_CANDIDATES = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];

const getExistingSelfieScriptPath = async (): Promise<string | null> => {
  for (const candidate of SELFIE_SCRIPT_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
};

const runSelfieAnalysis = async (filePath: string): Promise<SelfieAnalysisResult> => {
  const scriptPath = await getExistingSelfieScriptPath();
  if (!scriptPath) {
    return {
      success: false,
      faceCount: 0,
      estimatedAge: null,
      engine: 'none',
      error: 'Selfie analysis script not found'
    };
  }

  for (const pythonCommand of PYTHON_CANDIDATES) {
    try {
      const { stdout } = await execFileAsync(pythonCommand, [scriptPath, '--image', filePath, '--json'], {
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      });

      const parsed = JSON.parse(stdout.trim()) as SelfieAnalysisResult;
      return {
        success: Boolean(parsed.success),
        faceCount: Number.isFinite(parsed.faceCount) ? parsed.faceCount : 0,
        estimatedAge:
          typeof parsed.estimatedAge === 'number' && Number.isFinite(parsed.estimatedAge)
            ? parsed.estimatedAge
            : null,
        engine: parsed.engine || 'unknown',
        error: parsed.error
      };
    } catch {
      continue;
    }
  }

  return {
    success: false,
    faceCount: 0,
    estimatedAge: null,
    engine: 'none',
    error: 'Selfie analysis failed'
  };
};

export interface AutomatedVerificationResult {
  status: VerificationStatus;
  confidence: number;
  processedAt: string;
  reason: string;
  ocrResult: OCRResult;
  validationResult: ValidationResult;
}

interface RunVerificationInput {
  documentId: string;
  userId: string;
  documentType: DocumentType;
  filePath: string;
  checksum?: string | null;
}

interface ParsedFields {
  name?: string;
  documentNumber?: string;
  dateOfBirth?: string;
}

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const toUpperNoSpaces = (value: string) => value.toUpperCase().replace(/\s+/g, ' ').trim();

const extractDOB = (text: string): string | undefined => {
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Birth)\s*[:\-]?\s*(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}[\/-]\d{2}[\/-]\d{2})/i);
  if (dobMatch) {
    return dobMatch[1];
  }

  const genericMatch = text.match(/\b(\d{2}[\/-]\d{2}[\/-]\d{4}|\d{4}[\/-]\d{2}[\/-]\d{2})\b/);
  return genericMatch?.[1];
};

const extractGender = (text: string): string | undefined => {
  const genderMatch = text.match(/(?:Gender|Sex)?\s*[:\-\/]?\s*(MALE|FEMALE|M|F)\b/i);
  return genderMatch ? genderMatch[1].toUpperCase() : undefined;
};

const cleanNameCandidate = (value: string): string | undefined => {
  const normalized = normalizeText(value.replace(/[^A-Za-z\s\.]/g, ' '));
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 2) {
    return undefined;
  }

  if (/(government|india|department|uidai|income|tax|permanent|account|father|mother|signature)/i.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const extractName = (text: string): string | undefined => {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  const labeledLine = lines.find(line => /(name|given\s*name|full\s*name|नाम|పేరు)/i.test(line));
  if (labeledLine) {
    const inline = labeledLine.match(/(?:name|given\s*name|full\s*name|नाम|పేరు)\s*[:\-\/]?\s*(.+)$/i);
    if (inline?.[1]) {
      const candidate = cleanNameCandidate(inline[1]);
      if (candidate) {
        return candidate;
      }
    }

    const nextLine = lines[lines.indexOf(labeledLine) + 1];
    if (nextLine) {
      const candidate = cleanNameCandidate(nextLine);
      if (candidate) {
        return candidate;
      }
    }
  }

  const fallbackLine = lines.find(line => {
    const candidate = cleanNameCandidate(line);
    return Boolean(candidate);
  });

  return fallbackLine ? cleanNameCandidate(fallbackLine) : undefined;
};

const extractDocumentNumber = (text: string, documentType: DocumentType): string | undefined => {
  if (documentType === DocumentType.pan) {
    return text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/i)?.[0]?.toUpperCase();
  }

  if (documentType === DocumentType.aadhaar) {
    const compact = text.replace(/[^0-9]/g, '');
    const match = compact.match(/\b\d{12}\b/);
    return match?.[0];
  }

  return undefined;
};

const extractKeywords = (text: string): string[] => {
  const normalized = toUpperNoSpaces(text);
  const knownKeywords = [
    'GOVERNMENT OF INDIA',
    'UIDAI',
    'INCOME TAX DEPARTMENT',
    'PERMANENT ACCOUNT NUMBER'
  ];

  return knownKeywords.filter(keyword => normalized.includes(keyword));
};

const parseTsvConfidence = (tsvContent: string): number => {
  const lines = tsvContent.split(/\r?\n/).slice(1);
  const confidences = lines
    .map(line => line.split('\t'))
    .filter(parts => parts.length >= 12)
    .map(parts => Number(parts[10]))
    .filter(value => Number.isFinite(value) && value >= 0);

  if (!confidences.length) {
    return 0;
  }

  const avg = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
  return Number((avg / 100).toFixed(4));
};

const runTesseract = async (filePath: string, outputMode: 'text' | 'tsv', psm: number) => {
  const args = [filePath, 'stdout', '-l', 'eng', '--psm', String(psm)];
  if (outputMode === 'tsv') {
    args.push('tsv');
  }

  const { stdout } = await execFileAsync('tesseract', args, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return stdout;
};

const performOCR = async (filePath: string, documentType: DocumentType): Promise<OCRResult> => {
  const candidates = await Promise.all(
    [1, 6].map(async psm => {
      const [rawText, tsvOutput] = await Promise.all([
        runTesseract(filePath, 'text', psm),
        runTesseract(filePath, 'tsv', psm)
      ]);
      const text = normalizeText(rawText);

      return {
        rawText,
        confidence: parseTsvConfidence(tsvOutput),
        parsed: {
          name: extractName(rawText),
          documentNumber: extractDocumentNumber(rawText, documentType),
          dateOfBirth: extractDOB(rawText),
          gender: extractGender(rawText)
        },
        text
      };
    })
  );

  const bestCandidate = candidates.reduce((best, current) => {
    const bestScore = best.text.length + best.confidence * 100;
    const currentScore = current.text.length + current.confidence * 100;
    return currentScore > bestScore ? current : best;
  });

  return {
    success: bestCandidate.text.length > 20,
    confidence: bestCandidate.confidence,
    rawText: bestCandidate.rawText,
    extractedData: {
      ...bestCandidate.parsed,
      keywords: extractKeywords(bestCandidate.rawText)
    }
  };
};

const assessImageQuality = async (filePath: string) => {
  const stats = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const tooSmallFile = stats.size < 12 * 1024;
  const suspiciousExtension = !['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

  return {
    isLowQuality: tooSmallFile || suspiciousExtension,
    issues: [
      ...(tooSmallFile ? ['Image quality too low'] : []),
      ...(suspiciousExtension ? ['Unsupported or suspicious image format'] : [])
    ]
  };
};

const hasSuspiciousText = (rawText: string) => {
  const text = normalizeText(rawText);
  if (text.length < 20) {
    return true;
  }

  const alnum = (text.match(/[A-Za-z0-9]/g) ?? []).length;
  const symbols = text.length - alnum;
  const symbolRatio = symbols / Math.max(text.length, 1);
  const repeatedNoise = /(.)\1{7,}/.test(text.replace(/\s+/g, ''));
  return symbolRatio > 0.45 || repeatedNoise;
};

const hasDuplicateDocument = async (
  userId: string,
  documentType: DocumentType,
  documentNumber: string | undefined,
  checksum: string | null | undefined,
  currentDocumentId: string
) => {
  const duplicateByChecksum = checksum
    ? await prisma.documentUpload.findFirst({
        where: {
          id: { not: currentDocumentId },
          userId: { not: userId },
          checksum,
          type: documentType
        },
        select: {
          id: true,
          verification: {
            select: {
              status: true
            }
          }
        }
      })
    : null;

  if (duplicateByChecksum && duplicateByChecksum.verification?.status !== VerificationStatus.rejected) {
    return true;
  }

  if (!documentNumber) {
    return false;
  }

  const relatedDocuments = await prisma.documentUpload.findMany({
    where: {
      id: { not: currentDocumentId },
      userId: { not: userId },
      type: documentType,
      processedAt: { not: null },
      processingNotes: { not: null }
    },
    select: {
      processingNotes: true,
      verification: {
        select: {
          status: true
        }
      }
    }
  });

  return relatedDocuments.some((doc: typeof relatedDocuments[number]) => {
    if (doc.verification?.status === VerificationStatus.rejected) {
      return false;
    }

    if (!doc.processingNotes) {
      return false;
    }

    try {
      const parsed = JSON.parse(doc.processingNotes) as { extractedNumber?: string };
      return parsed.extractedNumber === documentNumber;
    } catch {
      const fallback = doc.processingNotes.match(/extractedNumber=([A-Za-z0-9]+)/i);
      return fallback?.[1]?.toUpperCase() === documentNumber.toUpperCase();
    }
  });
};

const requiredKeywordGroupsByType: Record<DocumentType, string[][]> = {
  aadhaar: [
    ['UIDAI', 'UNIQUE IDENTIFICATION AUTHORITY OF INDIA'],
    ['GOVERNMENT OF INDIA', 'INDIA']
  ],
  pan: [
    ['INCOME TAX DEPARTMENT', 'INCOME TAX DEPT'],
    ['PERMANENT ACCOUNT NUMBER', 'PAN CARD', 'PAN']
  ],
  passport: [],
  driverLicense: [],
  selfie: [],
  other: []
};

const getKeywordMatchScore = (documentType: DocumentType, normalizedText: string): number => {
  const groups = requiredKeywordGroupsByType[documentType];
  if (!groups.length) {
    return 1;
  }

  const matchedGroups = groups.filter(group => group.some(keyword => normalizedText.includes(keyword))).length;
  return matchedGroups / groups.length;
};

const validateDocumentData = async (
  input: RunVerificationInput,
  ocrResult: OCRResult
): Promise<ValidationResult> => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const text = toUpperNoSpaces(ocrResult.rawText);
  const keywordMatchScore = getKeywordMatchScore(input.documentType, text);
  const keywordMatch = keywordMatchScore >= 0.5;

  const formatValid =
    input.documentType === DocumentType.pan
      ? /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(ocrResult.extractedData.documentNumber ?? '')
      : input.documentType === DocumentType.aadhaar
        ? /^\d{12}$/.test((ocrResult.extractedData.documentNumber ?? '').replace(/\s+/g, ''))
        : input.documentType === DocumentType.selfie
          ? true
          : Boolean(ocrResult.extractedData.documentNumber || ocrResult.rawText.length > 20);

  const nameDetected = Boolean(ocrResult.extractedData.name);
  const dobDetected = Boolean(ocrResult.extractedData.dateOfBirth);
  const genderDetected = Boolean(ocrResult.extractedData.gender);

  const aadhaarNumberValid = /^\d{12}$/.test((ocrResult.extractedData.documentNumber ?? '').replace(/\s+/g, ''));
  const panNumberValid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(ocrResult.extractedData.documentNumber ?? '');
  const aadhaarSignalCount = [nameDetected, dobDetected, genderDetected].filter(Boolean).length;
  const panSignalCount = [nameDetected, dobDetected].filter(Boolean).length;

  const aadhaarValid =
    input.documentType === DocumentType.aadhaar
      ? aadhaarNumberValid && aadhaarSignalCount >= 2
      : true;

  const hasIncomeTaxDept = text.includes('INCOME TAX DEPARTMENT') || text.includes('INCOME TAX DEPT');
  const hasGovtOfIndia = text.includes('GOVERNMENT OF INDIA') || text.includes('GOVT OF INDIA');

  const panValid =
    input.documentType === DocumentType.pan
      ? panNumberValid &&
        panSignalCount >= 1 &&
        hasIncomeTaxDept &&
        hasGovtOfIndia
      : true;
  const qualityResult = await assessImageQuality(input.filePath);
  const qualityCheck = !qualityResult.isLowQuality;
  const suspiciousTextCheck = !hasSuspiciousText(ocrResult.rawText);
  const alphanumericCharCount = (ocrResult.rawText.match(/[A-Za-z0-9]/g) ?? []).length;
  const selfieLooksLikeDocument =
    input.documentType === DocumentType.selfie &&
    (Boolean(ocrResult.extractedData.documentNumber) ||
      ocrResult.extractedData.keywords.length > 0 ||
      alphanumericCharCount > 30);
  const duplicateCheck =
    input.documentType === DocumentType.selfie
      ? true
      : !(await hasDuplicateDocument(
          input.userId,
          input.documentType,
          ocrResult.extractedData.documentNumber,
          input.checksum,
          input.documentId
        ));

  if (!keywordMatch) {
    issues.push('Required authority keywords are missing');
    recommendations.push('Upload the original front side with clear authority text');
  }

  if (!formatValid) {
    issues.push('Invalid document number format');
    recommendations.push('Ensure the document number is fully visible and correct');
  }

  if (!qualityCheck) {
    issues.push(...qualityResult.issues);
    recommendations.push('Use a high-resolution, bright, non-blurry photo');
  }

  if (!suspiciousTextCheck) {
    issues.push('Suspicious or random OCR text detected');
    recommendations.push('Avoid edited screenshots and upload an original document image');
  }

  if (selfieLooksLikeDocument) {
    issues.push('Selfie image appears to be a document');
    recommendations.push('Upload a clear selfie photo instead of an ID document image');
  }

  if (!duplicateCheck) {
    issues.push('Duplicate document detected');
    recommendations.push('This document number appears to be already used');
  }

  if ((input.documentType === DocumentType.aadhaar || input.documentType === DocumentType.pan) && !dobDetected) {
    issues.push('DOB could not be detected');
    recommendations.push('Ensure DOB is visible and not cropped');
  }

  if (input.documentType === DocumentType.aadhaar && !genderDetected) {
    issues.push('Gender could not be detected');
    recommendations.push('Ensure gender field is visible on the Aadhaar card');
  }

  if (input.documentType === DocumentType.aadhaar && aadhaarSignalCount < 2) {
    issues.push('Aadhaar personal details could not be read clearly');
    recommendations.push('Ensure at least two of name, DOB, and gender are visible');
  }

  if (input.documentType === DocumentType.pan && panSignalCount < 1) {
    issues.push('PAN personal details could not be read clearly');
    recommendations.push('Ensure PAN name or DOB is visible');
  }

  if (input.documentType === DocumentType.pan && (!hasIncomeTaxDept || !hasGovtOfIndia)) {
    issues.push('Missing required keywords - Income Tax Department and Govt of India text');
    recommendations.push('Upload the original PAN card with clear authority text');
  }

  const isValid =
    input.documentType === DocumentType.aadhaar
      ? qualityCheck && duplicateCheck && suspiciousTextCheck && keywordMatch && aadhaarValid
      : input.documentType === DocumentType.pan
        ? qualityCheck && duplicateCheck && suspiciousTextCheck && panValid
        : input.documentType === DocumentType.selfie
          ? qualityCheck && duplicateCheck && suspiciousTextCheck && !selfieLooksLikeDocument
          : qualityCheck && duplicateCheck && suspiciousTextCheck && keywordMatch && formatValid;

  // Score: Aadhaar(12digits+name+dob+gender) or PAN(10char+name+dob+keywords) or other quality
  let score = 0;
  if (input.documentType === DocumentType.aadhaar) {
    if (aadhaarNumberValid) score += 25;
    if (nameDetected) score += 25;
    if (dobDetected) score += 25;
    if (genderDetected) score += 25;
  } else if (input.documentType === DocumentType.pan) {
    if (panNumberValid) score += 33;
    if (nameDetected) score += 33;
    if (dobDetected) score += 34;
  } else if (input.documentType === DocumentType.selfie) {
    score = 0;
    if (qualityCheck) score += 34;
    score += 33;
  } else {
    score += Math.round(keywordMatchScore * 30);
    if (formatValid) score += 30;
    if (nameDetected) score += 20;
    if (dobDetected) score += 20;
  }

  return {
    isValid,
    score,
    issues,
    recommendations,
    checks: {
      keywordMatch,
      formatValid,
      nameDetected,
      dobDetected,
      qualityCheck,
      suspiciousTextCheck,
      duplicateCheck
    }
  };
};

export const runAutomatedVerification = async (
  input: RunVerificationInput
): Promise<AutomatedVerificationResult> => {
  let ocrResult: OCRResult;
  try {
    ocrResult = await performOCR(input.filePath, input.documentType);
  } catch {
    ocrResult = {
      success: false,
      confidence: 0,
      rawText: '',
      extractedData: {
        keywords: []
      }
    };
  }

  const validationResult = await validateDocumentData(input, ocrResult);

  const status = validationResult.isValid ? VerificationStatus.verified : VerificationStatus.rejected;
  const rejectionMessage = 'Invalid documents';

  const reason =
    status === VerificationStatus.verified
      ? 'All automated checks passed - AI Verified'
      : rejectionMessage;

  const confidence = Number(((validationResult.score + ocrResult.confidence * 100) / 2).toFixed(2));

  return {
    status,
    confidence,
    processedAt: new Date().toISOString(),
    reason,
    ocrResult,
    validationResult
  };
};

