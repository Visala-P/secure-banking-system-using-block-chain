export interface PanValidationResult {
  valid: boolean;
  normalizedPan: string;
  issues: string[];
  warnings: string[];
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const ALLOWED_ENTITY_TYPES = new Set(['P', 'C', 'F', 'H', 'A', 'T', 'B', 'L', 'J', 'G']);

const normalizePan = (value: string): string => value.trim().toUpperCase();

const charValue = (char: string): number => {
  if (/^[0-9]$/.test(char)) {
    return Number(char);
  }

  return char.charCodeAt(0) - 64;
};

const sumDigits = (value: number): number => {
  if (value <= 9) {
    return value;
  }

  return Math.floor(value / 10) + (value % 10);
};

const computeCheckDigit = (panFirstNine: string): string => {
  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1];
  const weightedSum = panFirstNine
    .split('')
    .reduce((sum, char, index) => sum + sumDigits(charValue(char) * weights[index]), 0);

  const mod = weightedSum % 26;
  return String.fromCharCode(65 + mod);
};

export const validatePanNumber = (panInput: string): PanValidationResult => {
  const pan = normalizePan(panInput);
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!PAN_REGEX.test(pan)) {
    issues.push('PAN must match format AAAAA9999A using uppercase letters and digits only');
    return { valid: false, normalizedPan: pan, issues, warnings };
  }

  const entityType = pan[3];
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    issues.push('PAN 4th character (entity type) is invalid');
  }

  const expectedCheckDigit = computeCheckDigit(pan.slice(0, 9));
  if (pan[9] !== expectedCheckDigit) {
    warnings.push(`Local PAN checksum mismatch (calculated ${expectedCheckDigit})`);
  }

  return {
    valid: issues.length === 0,
    normalizedPan: pan,
    issues,
    warnings
  };
};
