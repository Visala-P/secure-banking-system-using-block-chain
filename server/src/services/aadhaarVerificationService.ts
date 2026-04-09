export interface AadhaarValidationResult {
  valid: boolean;
  normalizedAadhaar: string;
  issues: string[];
  warnings: string[];
}

const AADHAAR_REGEX = /^[2-9][0-9]{11}$/;

const dTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
] as const;

const pTable = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
] as const;

const normalizeAadhaar = (value: string): string => value.replace(/\s+/g, '').trim();

const isVerhoeffValid = (value: string): boolean => {
  let checksum = 0;
  const reversedDigits = value.split('').reverse();

  for (let index = 0; index < reversedDigits.length; index += 1) {
    const digit = Number(reversedDigits[index]);
    checksum = dTable[checksum][pTable[index % 8][digit]];
  }

  return checksum === 0;
};

export const validateAadhaarNumber = (aadhaarInput: string): AadhaarValidationResult => {
  const normalized = normalizeAadhaar(aadhaarInput);
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/^\d{12}$/.test(normalized)) {
    issues.push('Aadhaar number must be exactly 12 digits');
    return { valid: false, normalizedAadhaar: normalized, issues, warnings };
  }

  if (!AADHAAR_REGEX.test(normalized)) {
    issues.push('Aadhaar number must not start with 0 or 1');
  }

  if (!isVerhoeffValid(normalized)) {
    issues.push('Aadhaar check digit is invalid (Verhoeff check failed)');
  }

  return {
    valid: issues.length === 0,
    normalizedAadhaar: normalized,
    issues,
    warnings
  };
};
