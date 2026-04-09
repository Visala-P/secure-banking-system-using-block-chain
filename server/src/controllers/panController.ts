import fs from 'fs/promises';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { extractPanOcrText } from '../services/panModelOcrService.js';
import { validatePanNumber } from '../services/panVerificationService.js';

interface PanVerificationRequest extends Request {
  file?: Express.Multer.File;
}

const verifyPanSchema = z.object({
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(10, 'PAN number is required'),
  name: z.string().trim().optional(),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dob: z.string().trim().optional(),
  fatherName: z.string().trim().optional(),
  documentName: z.string().trim().optional(),
  ocrText: z.string().trim().optional()
});

const normalizeName = (value: string): string => value.replace(/\s+/g, ' ').trim().toUpperCase();
const normalizeLastName = (value: string): string => value.replace(/[^A-Za-z]/g, '').trim().toUpperCase();

const normalizePanOcrChar = (char: string, index: number): string => {
  const upper = char.toUpperCase();

  // PAN format positions: 0-4 letters, 5-8 digits, 9 letter.
  if (index <= 4 || index === 9) {
    if (upper === '0') return 'O';
    if (upper === '1') return 'I';
    if (upper === '2') return 'Z';
    if (upper === '5') return 'S';
    if (upper === '6') return 'G';
    if (upper === '8') return 'B';
    return upper;
  }

  if (upper === 'O' || upper === 'Q' || upper === 'D') return '0';
  if (upper === 'I' || upper === 'L') return '1';
  if (upper === 'Z') return '2';
  if (upper === 'S') return '5';
  if (upper === 'B') return '8';
  return upper;
};

const extractPanFromText = (value: string): string | null => {
  const upper = value.toUpperCase();

  const groupedMatch = upper.match(/([A-Z]{5})\s*([0-9]{4})\s*([A-Z])/);
  if (groupedMatch) {
    return `${groupedMatch[1]}${groupedMatch[2]}${groupedMatch[3]}`;
  }

  const directMatch = upper.match(/[A-Z]{5}[0-9]{4}[A-Z]/);
  if (directMatch?.[0]) {
    return directMatch[0];
  }

  const cleaned = upper.replace(/[^A-Z0-9]/g, '');
  for (let start = 0; start <= cleaned.length - 10; start += 1) {
    const segment = cleaned.slice(start, start + 10);
    const normalized = segment
      .split('')
      .map((char, index) => normalizePanOcrChar(char, index))
      .join('');

    if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
      return normalized;
    }
  }

  return null;
};

const buildReason = (reasons: string[]): string => reasons.join('; ');

export const verifyPanDetails = async (req: PanVerificationRequest, res: Response, next: NextFunction) => {
  const uploadedFile = req.file;

  try {
    const payload = verifyPanSchema.parse(req.body);
    if (!uploadedFile) {
      res.status(400).json({
        verified: false,
        status: 'fake',
        message: 'PAN document upload is required',
        issues: ['No PAN document uploaded'],
        confidence: 0
      });
      return;
    }

    if (!uploadedFile.mimetype.startsWith('image/')) {
      if (uploadedFile.path) {
        await fs.unlink(uploadedFile.path).catch(() => undefined);
      }

      res.status(400).json({
        verified: false,
        status: 'fake',
        message: 'PAN document must be an image file',
        issues: ['Uploaded PAN document is not an image'],
        confidence: 0
      });
      return;
    }

    const panNumber = payload.panNumber.toUpperCase();
    const validation = validatePanNumber(panNumber);
    const issues = [...validation.issues];
    const warnings = [...validation.warnings];

    const cleanedLastName = normalizeLastName(payload.lastName);
    if (!cleanedLastName) {
      issues.push('Last name must contain at least one alphabet character');
    } else if (validation.normalizedPan[4] !== cleanedLastName[0]) {
      issues.push(`PAN 5th character must match last name initial (${cleanedLastName[0]})`);
    }

    const ocrResult = await extractPanOcrText(uploadedFile.path, payload.ocrText);
    const ocrPanNumber = extractPanFromText(ocrResult.text);

    if (!ocrResult.text) {
      issues.push('Could not read PAN text from uploaded image');
    } else if (!ocrPanNumber) {
      issues.push('Could not detect PAN number in uploaded image');
    } else if (ocrPanNumber !== validation.normalizedPan) {
      issues.push(`Entered PAN does not match uploaded image PAN (${ocrPanNumber})`);
    }

    const isValid = issues.length === 0;

    if (uploadedFile.path) {
      await fs.unlink(uploadedFile.path).catch(() => undefined);
    }

    if (!isValid) {
      res.status(422).json({
        verified: false,
        status: 'fake',
        message: buildReason(issues),
        issues,
        warnings,
        confidence: 0,
        data: {
          panNumber: validation.normalizedPan,
          name: payload.name ? normalizeName(payload.name) : null,
          lastName: cleanedLastName || null,
          dob: payload.dob ?? null,
          fatherName: payload.fatherName ? normalizeName(payload.fatherName) : null,
          documentName: payload.documentName ?? uploadedFile.originalname,
          ocrSource: ocrResult.source,
          ocrEngine: ocrResult.engine,
          extractedPanNumber: ocrPanNumber,
          ocrWarning: ocrResult.warning
        }
      });
      return;
    }

    res.status(200).json({
      verified: true,
      status: 'verified',
      message: 'PAN number verified successfully',
      confidence: 100,
      warnings,
      data: {
        panNumber: validation.normalizedPan,
        name: payload.name ? normalizeName(payload.name) : null,
        lastName: cleanedLastName || null,
        dob: payload.dob ?? null,
        fatherName: payload.fatherName ? normalizeName(payload.fatherName) : null,
        documentName: payload.documentName ?? uploadedFile.originalname,
        ocrSource: ocrResult.source,
        ocrEngine: ocrResult.engine,
        extractedPanNumber: ocrPanNumber,
        ocrWarning: ocrResult.warning
      }
    });
  } catch (error) {
    if (uploadedFile?.path) {
      await fs.unlink(uploadedFile.path).catch(() => undefined);
    }
    next(error);
  }
};
