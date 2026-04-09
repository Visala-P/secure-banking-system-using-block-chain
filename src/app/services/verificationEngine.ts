// Automated Verification Engine
// Simulates AI/OCR document processing and validation

export interface DocumentUpload {
  id: string;
  userId: string;
  type: 'aadhaar' | 'pan' | 'passport' | 'driverLicense' | 'selfie';
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: 'processing' | 'verified' | 'rejected' | 'pending';
}

export interface OCRResult {
  success: boolean;
  extractedData: {
    name?: string;
    documentNumber?: string;
    dateOfBirth?: string;
    address?: string;
    issueDate?: string;
    expiryDate?: string;
  };
  confidence: number;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  checks: {
    formatValid: boolean;
    dataConsistent: boolean;
    notExpired: boolean;
    noDuplicates: boolean;
    qualityCheck: boolean;
  };
  issues: string[];
  recommendations: string[];
}

export interface VerificationResult {
  status: 'verified' | 'rejected';
  confidence: number;
  processedAt: string;
  ocrResult: OCRResult;
  validationResult: ValidationResult;
  autoApproved: boolean;
  reason: string;
}

// Simulate OCR processing
export const performOCR = async (file: File, documentType: string): Promise<OCRResult> => {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

  // Mock OCR extraction with varying confidence
  const confidence = 0.75 + Math.random() * 0.2; // 75-95% confidence
  
  const mockData: Record<string, any> = {
    aadhaar: {
      name: 'John Doe',
      documentNumber: `${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      dateOfBirth: '1990-05-15',
      address: '123 Main Street, City, State - 110001'
    },
    pan: {
      name: 'John Doe',
      documentNumber: `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`,
      dateOfBirth: '1990-05-15'
    },
    passport: {
      name: 'John Doe',
      documentNumber: `P${Math.floor(1000000 + Math.random() * 9000000)}`,
      dateOfBirth: '1990-05-15',
      issueDate: '2020-01-15',
      expiryDate: '2030-01-15'
    },
    driverLicense: {
      name: 'John Doe',
      documentNumber: `DL${Math.floor(100000000 + Math.random() * 900000000)}`,
      dateOfBirth: '1990-05-15',
      issueDate: '2018-03-20',
      expiryDate: '2028-03-20',
      address: '123 Main Street, City, State - 110001'
    }
  };

  return {
    success: confidence > 0.7,
    extractedData: mockData[documentType] || {},
    confidence
  };
};

// Validate extracted data
export const validateDocument = async (
  ocrResult: OCRResult,
  documentType: string,
  existingUserData?: any
): Promise<ValidationResult> => {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Format validation
  const formatValid = ocrResult.confidence > 0.75;
  if (!formatValid) {
    issues.push('Document format could not be properly recognized');
    recommendations.push('Please upload a clearer image of the document');
  }

  // Data consistency check
  const dataConsistent = ocrResult.extractedData.name !== undefined;
  if (!dataConsistent) {
    issues.push('Critical information missing from document');
    recommendations.push('Ensure all details are visible and not obscured');
  }

  // Expiry check
  let notExpired = true;
  if (ocrResult.extractedData.expiryDate) {
    const expiryDate = new Date(ocrResult.extractedData.expiryDate);
    notExpired = expiryDate > new Date();
    if (!notExpired) {
      issues.push('Document has expired');
      recommendations.push('Please submit a valid, non-expired document');
    }
  }

  // Duplicate check (mocked)
  const noDuplicates = Math.random() > 0.1; // 90% chance no duplicate
  if (!noDuplicates) {
    issues.push('Document number appears to be already registered');
    recommendations.push('Please verify the document or contact support');
  }

  // Quality check
  const qualityCheck = ocrResult.confidence > 0.80;
  if (!qualityCheck) {
    issues.push('Image quality below threshold');
    recommendations.push('Please upload a high-quality scan or photo');
  }

  const checks = {
    formatValid,
    dataConsistent,
    notExpired,
    noDuplicates,
    qualityCheck
  };

  // Calculate validation score
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const score = (passedChecks / Object.keys(checks).length) * 100;

  return {
    isValid: score >= 80,
    score,
    checks,
    issues,
    recommendations
  };
};

// Main automated verification function
export const automatedVerification = async (
  file: File,
  documentType: string,
  userId: string
): Promise<VerificationResult> => {
  // Step 1: OCR Processing
  const ocrResult = await performOCR(file, documentType);

  // Step 2: Validation
  const validationResult = await validateDocument(ocrResult, documentType);

  // Step 3: FULLY AUTOMATED Decision logic - NO manual review
  let status: 'verified' | 'rejected';
  let reason = '';

  // Auto-approve: High confidence
  if (validationResult.score >= 80 && ocrResult.confidence >= 0.75) {
    status = 'verified';
    reason = 'All automated checks passed - AI Verified ✓';
  } 
  // Auto-reject: Low confidence or failed checks
  else {
    status = 'rejected';
    if (validationResult.issues.length > 0) {
      reason = `Verification failed: ${validationResult.issues.join('; ')}`;
    } else {
      reason = 'Document quality or authenticity could not be confirmed. Please reupload clearer documents.';
    }
  }

  const confidence = (validationResult.score + ocrResult.confidence * 100) / 2;

  return {
    status,
    confidence,
    processedAt: new Date().toISOString(),
    ocrResult,
    validationResult,
    autoApproved: true, // Always auto-decided
    reason
  };
};

// Batch verification for multiple documents
export const verifyKYCDocuments = async (
  documents: { file: File; type: string }[],
  userId: string
): Promise<{
  overallStatus: 'verified' | 'rejected' | 'pending';
  results: VerificationResult[];
  summary: string;
}> => {
  const results = await Promise.all(
    documents.map(doc => automatedVerification(doc.file, doc.type, userId))
  );

  const verifiedCount = results.filter(r => r.status === 'verified').length;
  const rejectedCount = results.filter(r => r.status === 'rejected').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;

  let overallStatus: 'verified' | 'rejected' | 'pending' = 'pending';
  let summary = '';

  if (verifiedCount === results.length) {
    overallStatus = 'verified';
    summary = `All ${results.length} documents verified successfully`;
  } else if (rejectedCount > 0) {
    overallStatus = 'rejected';
    summary = `${rejectedCount} document(s) rejected. Please resubmit valid documents.`;
  } else {
    overallStatus = 'pending';
    summary = `${pendingCount} document(s) pending manual review`;
  }

  return {
    overallStatus,
    results,
    summary
  };
};