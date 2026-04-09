import fs from 'fs/promises';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { extractPanOcrText } from '../services/panModelOcrService.js';
import { validateAadhaarNumber } from '../services/aadhaarVerificationService.js';

interface AadhaarVerificationRequest extends Request {
  file?: Express.Multer.File;
}

const verifyAadhaarSchema = z.object({
  aadhaarNumber: z.string().trim().min(12, 'Aadhaar number is required'),
  name: z.string().trim().optional(),
  lastName: z.string().trim().min(1, 'Last name is required'),
  dob: z.string().trim().optional(),
  fatherName: z.string().trim().optional(),
  documentName: z.string().trim().optional(),
  ocrText: z.string().trim().optional()
});

const normalizeName = (value: string): string => value.replace(/\s+/g, ' ').trim().toUpperCase();
const normalizeAadhaar = (value: string): string => value.replace(/\s+/g, '').trim();
const extractAadhaarFromText = (value: string): string | null => {
  const match = value.match(/\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/);
  return match ? normalizeAadhaar(match[0]) : null;
};
const buildReason = (reasons: string[]): string => reasons.join('; ');

export const verifyAadhaarDetails = async (
  req: AadhaarVerificationRequest,
  res: Response,
  next: NextFunction
) => {
  const uploadedFile = req.file;

  try {
    const payload = verifyAadhaarSchema.parse(req.body);

    if (!uploadedFile) {
      res.status(400).json({
        verified: false,
        status: 'fake',
        message: 'Aadhaar document upload is required',
        issues: ['No Aadhaar document uploaded'],
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
        message: 'Aadhaar document must be an image file',
        issues: ['Uploaded Aadhaar document is not an image'],
        confidence: 0
      });
      return;
    }

    const validation = validateAadhaarNumber(payload.aadhaarNumber);
    const issues = [...validation.issues];
    const warnings = [...validation.warnings];

    const ocrResult = await extractPanOcrText(uploadedFile.path, payload.ocrText);
    const ocrAadhaarNumber = extractAadhaarFromText(ocrResult.text);

    if (!ocrResult.text) {
      issues.push('Could not read Aadhaar text from uploaded image');
    } else if (!ocrAadhaarNumber) {
      issues.push('Could not detect Aadhaar number in uploaded image');
    } else if (ocrAadhaarNumber !== validation.normalizedAadhaar) {
      issues.push(`Entered Aadhaar does not match uploaded image Aadhaar (${ocrAadhaarNumber})`);
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
          aadhaarNumber: validation.normalizedAadhaar,
          name: payload.name ? normalizeName(payload.name) : null,
          lastName: payload.lastName ? normalizeName(payload.lastName) : null,
          dob: payload.dob ?? null,
          fatherName: payload.fatherName ? normalizeName(payload.fatherName) : null,
          documentName: payload.documentName ?? uploadedFile.originalname,
          ocrSource: ocrResult.source,
          ocrEngine: ocrResult.engine,
          extractedAadhaarNumber: ocrAadhaarNumber,
          ocrWarning: ocrResult.warning
        }
      });
      return;
    }

    res.status(200).json({
      verified: true,
      status: 'verified',
      message: 'Aadhaar number verified successfully',
      confidence: 100,
      warnings,
      data: {
        aadhaarNumber: validation.normalizedAadhaar,
        name: payload.name ? normalizeName(payload.name) : null,
        lastName: payload.lastName ? normalizeName(payload.lastName) : null,
        dob: payload.dob ?? null,
        fatherName: payload.fatherName ? normalizeName(payload.fatherName) : null,
        documentName: payload.documentName ?? uploadedFile.originalname,
        ocrSource: ocrResult.source,
        ocrEngine: ocrResult.engine,
        extractedAadhaarNumber: ocrAadhaarNumber,
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
