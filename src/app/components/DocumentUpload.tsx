import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, buildAuthHeaders, parseResponse } from '../lib/api';
import { extractPanOcrText } from '../lib/panOcr';

const documentKinds = ['aadhaar', 'pan', 'passport', 'driverLicense', 'selfie'] as const;
type DocumentKind = (typeof documentKinds)[number];
type DocumentStatusValue = 'uploading' | 'processing' | 'verified' | 'rejected' | 'pending';

interface DocumentTypeConfig {
  id: DocumentKind;
  label: string;
  description: string;
  required: boolean;
  maxSize: number;
}

interface ServerDocument {
  id: string;
  type: DocumentKind;
  status: DocumentStatusValue;
  fileName: string;
  fileSize: number;
  processingNotes?: string | null;
  uploadedAt: string;
}

interface SubmitVerificationResponse {
  verification: {
    id: string;
    status: 'verified' | 'pending' | 'rejected';
    notes?: string | null;
    confidence?: number | null;
  };
  documents: ServerDocument[];
  aiDecisions?: Array<{
    documentId: string;
    type: DocumentKind;
    status: DocumentStatusValue;
    reason: string;
    confidence: number;
  }>;
}

interface UploadedDoc {
  id?: string;
  type: DocumentKind;
  fileName: string;
  fileSize: number;
  status: DocumentStatusValue;
  preview?: string;
  processingNotes?: string | null;
}

interface DocumentUploadProps {
  userId: string;
  onVerificationComplete?: (status: 'verified' | 'rejected' | 'pending') => void;
  submissionAction?: string;
  submitLabel?: string;
  submitHint?: string;
}

const documentTypes: DocumentTypeConfig[] = [
  {
    id: 'aadhaar',
    label: 'Aadhaar Card',
    description: 'Government issued identity proof',
    required: true,
    maxSize: 5 * 1024 * 1024
  },
  {
    id: 'pan',
    label: 'PAN Card',
    description: 'Enter PAN details for verification',
    required: true,
    maxSize: 0
  },
  {
    id: 'passport',
    label: 'Passport',
    description: 'Valid passport (optional)',
    required: false,
    maxSize: 5 * 1024 * 1024
  },
  {
    id: 'driverLicense',
    label: 'Driver License',
    description: 'Valid driver license (optional)',
    required: false,
    maxSize: 5 * 1024 * 1024
  },
  {
    id: 'selfie',
    label: 'Passport Size Photo',
    description: 'Clear passport size photo for face verification',
    required: true,
    maxSize: 3 * 1024 * 1024
  }
];

interface PanDetailsForm {
  panNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  fatherName: string;
}

interface AadhaarDetailsForm {
  aadhaarNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  fatherName: string;
}

interface PersistedKycDetails {
  panDetails: PanDetailsForm;
  aadhaarDetails: AadhaarDetailsForm;
  panVerifiedDoc?: UploadedDoc | null;
  aadhaarVerifiedDoc?: UploadedDoc | null;
  selfieVerifiedDoc?: UploadedDoc | null;
}

const KYC_DETAILS_STORAGE_PREFIX = 'securebank:kyc-details:v1';

const toIsoDate = (value: string): string => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return value.trim();
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const statusToIcon = (status: DocumentStatusValue) => {
  switch (status) {
    case 'uploading':
    case 'processing':
      return <Loader2 className="size-5 animate-spin text-blue-500" />;
    case 'verified':
      return <CheckCircle className="size-5 text-green-500" />;
    case 'rejected':
      return <XCircle className="size-5 text-red-500" />;
    default:
      return <Clock className="size-5 text-yellow-500" />;
  }
};

const normalizeDocument = (doc: ServerDocument): UploadedDoc => ({
  id: doc.id,
  type: doc.type,
  fileName: doc.fileName,
  fileSize: doc.fileSize,
  status: doc.status,
  processingNotes: doc.processingNotes ?? undefined
});

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Unable to read image preview'));
    reader.readAsDataURL(file);
  });

export function DocumentUpload({
  userId,
  onVerificationComplete,
  submissionAction = 'KYC Verification',
  submitLabel = 'Submit for Verification',
  submitHint
}: DocumentUploadProps) {
  const { token } = useAuth();
  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<DocumentKind, UploadedDoc>>>({});
  const [activeType, setActiveType] = useState<DocumentKind>('aadhaar');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panDetails, setPanDetails] = useState<PanDetailsForm>({
    panNumber: '',
    firstName: '',
    lastName: '',
    dob: '',
    fatherName: ''
  });
  const [aadhaarDetails, setAadhaarDetails] = useState<AadhaarDetailsForm>({
    aadhaarNumber: '',
    firstName: '',
    lastName: '',
    dob: '',
    fatherName: ''
  });
  const [aadhaarDocumentFile, setAadhaarDocumentFile] = useState<File | null>(null);
  const [aadhaarVerificationLoading, setAadhaarVerificationLoading] = useState(false);
  const [aadhaarDebugMessage, setAadhaarDebugMessage] = useState('');
  const [panDocumentFile, setPanDocumentFile] = useState<File | null>(null);
  const [panVerificationLoading, setPanVerificationLoading] = useState(false);
  const [panDebugMessage, setPanDebugMessage] = useState('');

  const clearPersistedKycDetails = () => {
    const storageKey = `${KYC_DETAILS_STORAGE_PREFIX}:${userId}`;

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage cleanup failures.
    }

    setPanDetails({
      panNumber: '',
      firstName: '',
      lastName: '',
      dob: '',
      fatherName: ''
    });
    setAadhaarDetails({
      aadhaarNumber: '',
      firstName: '',
      lastName: '',
      dob: '',
      fatherName: ''
    });
    setPanDocumentFile(null);
    setAadhaarDocumentFile(null);
    setPanDebugMessage('');
    setAadhaarDebugMessage('');

    setUploadedDocs(prev => {
      const updated = { ...prev };
      delete updated.pan;
      delete updated.aadhaar;
      delete updated.selfie;
      return updated;
    });

    toast.success('Saved PAN/Aadhaar details cleared');
  };

  useEffect(() => {
    try {
      const storageKey = `${KYC_DETAILS_STORAGE_PREFIX}:${userId}`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedKycDetails;

      if (parsed.panDetails) {
        setPanDetails(parsed.panDetails);
      }

      if (parsed.aadhaarDetails) {
        setAadhaarDetails(parsed.aadhaarDetails);
      }

      setUploadedDocs(prev => ({
        ...prev,
        ...(parsed.panVerifiedDoc ? { pan: parsed.panVerifiedDoc } : {}),
        ...(parsed.aadhaarVerifiedDoc ? { aadhaar: parsed.aadhaarVerifiedDoc } : {}),
        ...(parsed.selfieVerifiedDoc ? { selfie: parsed.selfieVerifiedDoc } : {})
      }));
    } catch {
      // Ignore malformed persisted state and continue with defaults.
    }
  }, [userId]);

  useEffect(() => {
    try {
      const storageKey = `${KYC_DETAILS_STORAGE_PREFIX}:${userId}`;

      const persisted: PersistedKycDetails = {
        panDetails,
        aadhaarDetails,
        panVerifiedDoc:
          uploadedDocs.pan?.status === 'verified'
            ? {
                ...uploadedDocs.pan,
                preview: undefined
              }
            : null,
        aadhaarVerifiedDoc:
          uploadedDocs.aadhaar?.status === 'verified'
            ? {
                ...uploadedDocs.aadhaar,
                preview: undefined
              }
            : null,
        selfieVerifiedDoc:
          uploadedDocs.selfie?.status === 'verified'
            ? uploadedDocs.selfie
            : null
      };

      window.localStorage.setItem(storageKey, JSON.stringify(persisted));
    } catch {
      // Ignore storage write failures.
    }
  }, [userId, panDetails, aadhaarDetails, uploadedDocs]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const docType = documentTypes.find(dt => dt.id === activeType);
      if (!docType) return;

      if (activeType === 'pan' || activeType === 'aadhaar') {
        toast.info('Use the details form below for PAN/Aadhaar verification');
        return;
      }

      if (file.size > docType.maxSize) {
        toast.error(`File size exceeds ${docType.maxSize / (1024 * 1024)}MB limit`);
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file (JPG, PNG, etc.)');
        return;
      }

      if (!token) {
        toast.error('Session expired. Please log in again.');
        return;
      }

      const preview = activeType === 'selfie' ? await readFileAsDataUrl(file) : URL.createObjectURL(file);

      setUploadedDocs(prev => ({
        ...prev,
        [activeType]: {
          type: activeType,
          fileName: file.name,
          fileSize: file.size,
          status: 'uploading',
          preview
        }
      }));

      const formData = new FormData();
      formData.append('document', file);
      formData.append('userId', userId);
      formData.append('type', activeType);

      setIsProcessing(true);
      try {
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
          method: 'POST',
          headers: buildAuthHeaders(token),
          body: formData
        });

        const savedDoc = await parseResponse<ServerDocument>(response);

        setUploadedDocs(prev => ({
          ...prev,
          [activeType]: {
            ...prev[activeType],
            ...normalizeDocument(savedDoc),
            status: 'verified',
            preview
          }
        }));

        toast.success(`${docType.label} uploaded successfully.`);
      } catch (error) {
        URL.revokeObjectURL(preview);
        setUploadedDocs(prev => {
          const updated = { ...prev };
          delete updated[activeType];
          return updated;
        });
          if (typeof preview === 'string' && preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
          }
          toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    },
    [activeType, token, userId]
  );

  const handlePanDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPanDocumentFile(file ?? null);
    // Keep PAN and Aadhaar image selections isolated to avoid accidental cross-use.
    if (file) {
      setAadhaarDocumentFile(null);
    }
  };

  const handleAadhaarDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAadhaarDocumentFile(file ?? null);
    if (file) {
      setPanDocumentFile(null);
    }
  };

  const handleAadhaarVerify = async () => {
    if (
      !aadhaarDetails.aadhaarNumber.trim() ||
      !aadhaarDetails.firstName.trim() ||
      !aadhaarDetails.lastName.trim() ||
      !aadhaarDetails.dob ||
      !aadhaarDetails.fatherName.trim()
    ) {
      toast.error('Please fill all Aadhaar details');
      return;
    }

    if (!aadhaarDocumentFile) {
      toast.error('Please upload an Aadhaar document');
      return;
    }

    setAadhaarVerificationLoading(true);
    setAadhaarDebugMessage('');

    try {
      const formData = new FormData();
      const fullName = [aadhaarDetails.firstName.trim(), aadhaarDetails.lastName.trim()].filter(Boolean).join(' ');

      formData.append('aadhaarNumber', aadhaarDetails.aadhaarNumber.trim());
      formData.append('name', fullName);
      formData.append('lastName', aadhaarDetails.lastName.trim());
      formData.append('dob', toIsoDate(aadhaarDetails.dob));
      formData.append('fatherName', aadhaarDetails.fatherName.trim());
      formData.append('document', aadhaarDocumentFile);
      formData.append('ocrText', await extractPanOcrText(aadhaarDocumentFile));

      const response = await fetch(`${API_BASE_URL}/aadhaar/verify`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => null);
      const detailParts = [
        payload?.message,
        payload?.data?.ocrSource ? `OCR source: ${payload.data.ocrSource}` : null,
        payload?.data?.ocrEngine ? `OCR engine: ${payload.data.ocrEngine}` : null,
        payload?.data?.extractedAadhaarNumber ? `Extracted Aadhaar: ${payload.data.extractedAadhaarNumber}` : null,
        payload?.warnings?.length ? `Warnings: ${payload.warnings.join('; ')}` : null,
        payload?.issues?.length ? `Issues: ${payload.issues.join('; ')}` : null
      ].filter(Boolean);

      if (!response.ok) {
        if (detailParts.length) {
          setAadhaarDebugMessage(detailParts.join(' | '));
        }
        throw new Error(payload?.message || 'Aadhaar verification failed');
      }

      if (!payload?.verified || payload?.status !== 'verified') {
        setAadhaarDebugMessage(detailParts.join(' | '));
        throw new Error(payload?.message || 'Aadhaar details could not be verified');
      }

      setUploadedDocs(prev => ({
        ...prev,
        aadhaar: {
          type: 'aadhaar',
          fileName: `AADHAAR ${aadhaarDetails.aadhaarNumber.trim()}`,
          fileSize: 0,
          status: 'verified',
          processingNotes: 'Verified using Aadhaar details'
        }
      }));

      toast.success(payload?.message || 'Aadhaar verified successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Aadhaar verification failed');
    } finally {
      setAadhaarVerificationLoading(false);
    }
  };

  const handlePanVerify = async () => {
    if (!panDetails.panNumber.trim() || !panDetails.firstName.trim() || !panDetails.lastName.trim() || !panDetails.dob || !panDetails.fatherName.trim()) {
      toast.error('Please fill all PAN details');
      return;
    }

    if (!panDocumentFile) {
      toast.error('Please upload a PAN document');
      return;
    }

    setPanVerificationLoading(true);
    setPanDebugMessage('');
    try {
      const formData = new FormData();
      const fullName = [panDetails.firstName.trim(), panDetails.lastName.trim()].filter(Boolean).join(' ');
      formData.append('panNumber', panDetails.panNumber.trim().toUpperCase());
      formData.append('name', fullName);
      formData.append('lastName', panDetails.lastName.trim());
      formData.append('dob', toIsoDate(panDetails.dob));
      formData.append('fatherName', panDetails.fatherName.trim());
      formData.append('document', panDocumentFile);
      formData.append('ocrText', await extractPanOcrText(panDocumentFile));

      const response = await fetch(`${API_BASE_URL}/pan/verify`, {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => null);
      const detailParts = [
        payload?.message,
        payload?.data?.ocrSource ? `OCR source: ${payload.data.ocrSource}` : null,
        payload?.data?.ocrEngine ? `OCR engine: ${payload.data.ocrEngine}` : null,
        payload?.data?.extractedPanNumber ? `Extracted PAN: ${payload.data.extractedPanNumber}` : null,
        payload?.data?.extractedFatherName ? `Extracted father name: ${payload.data.extractedFatherName}` : null,
        payload?.data?.extractedName ? `Extracted name: ${payload.data.extractedName}` : null,
        payload?.warnings?.length ? `Warnings: ${payload.warnings.join('; ')}` : null,
        payload?.issues?.length ? `Issues: ${payload.issues.join('; ')}` : null
      ].filter(Boolean);

      if (!response.ok) {
        if (detailParts.length) {
          setPanDebugMessage(detailParts.join(' | '));
        }
        throw new Error(payload?.message || 'PAN verification failed');
      }

      if (!payload?.verified || payload?.status !== 'verified') {
        setPanDebugMessage(detailParts.join(' | '));
        throw new Error(payload?.message || 'PAN details could not be confidently verified');
      }

      setUploadedDocs(prev => ({
        ...prev,
        pan: {
          type: 'pan',
          fileName: `PAN ${panDetails.panNumber.trim().toUpperCase()}`,
          fileSize: 0,
          status: 'verified',
          processingNotes: 'Verified using PAN details'
        }
      }));

      toast.success(payload?.message || 'PAN Card verified successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PAN verification failed');
    } finally {
      setPanVerificationLoading(false);
    }
  };

  const handleSubmitAll = async () => {
    if (!token) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    const requiredDocs = documentTypes.filter(dt => dt.required);
    const uploadedRequired = requiredDocs.filter(dt => uploadedDocs[dt.id]);

    if (uploadedRequired.length < requiredDocs.length) {
      toast.error('Please upload all required documents');
      return;
    }

    if (Object.values(uploadedDocs).some(doc => doc.status === 'uploading')) {
      toast.error('Wait for all uploads to finish before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verification/submit`, {
        method: 'POST',
        headers: buildAuthHeaders(token, {
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          userId,
          action: submissionAction,
          panDetails: {
            firstName: panDetails.firstName.trim(),
            lastName: panDetails.lastName.trim(),
            dob: toIsoDate(panDetails.dob),
            fatherName: panDetails.fatherName.trim()
          },
          aadhaarDetails: {
            firstName: aadhaarDetails.firstName.trim(),
            lastName: aadhaarDetails.lastName.trim(),
            dob: toIsoDate(aadhaarDetails.dob),
            fatherName: aadhaarDetails.fatherName.trim()
          }
        })
      });

      const result = await parseResponse<SubmitVerificationResponse>(response);

      const updatedDocs = result.documents.reduce<Record<DocumentKind, UploadedDoc>>((acc, doc) => {
        acc[doc.type] = normalizeDocument(doc);
        return acc;
      }, {} as Record<DocumentKind, UploadedDoc>);

      setUploadedDocs(prev => {
        const merged = { ...updatedDocs };

        if (!merged.pan && prev.pan?.status === 'verified') {
          merged.pan = prev.pan;
        }

        if (!merged.aadhaar && prev.aadhaar?.status === 'verified') {
          merged.aadhaar = prev.aadhaar;
        }

        if (!merged.selfie && prev.selfie?.status === 'verified') {
          merged.selfie = prev.selfie;
        }

        return merged;
      });

      toast.success(`Verification submitted (${result.verification.status}).`);
      onVerificationComplete?.(result.verification.status);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeDocument = (type: DocumentKind) => {
    if (uploadedDocs[type]?.preview && uploadedDocs[type].preview.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedDocs[type].preview!);
    }

    if (type === 'pan') {
      setPanDetails({
        panNumber: '',
        firstName: '',
        lastName: '',
        dob: '',
        fatherName: ''
      });
      setPanDocumentFile(null);
      setPanDebugMessage('');
    }

    if (type === 'aadhaar') {
      setAadhaarDetails({
        aadhaarNumber: '',
        firstName: '',
        lastName: '',
        dob: '',
        fatherName: ''
      });
      setAadhaarDocumentFile(null);
      setAadhaarDebugMessage('');
    }

    setUploadedDocs(prev => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });

    toast.info('Document removed');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png']
    },
    multiple: false,
    disabled: isProcessing || isSubmitting
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {documentTypes.map(docType => {
          const uploadedDoc = uploadedDocs[docType.id];

          return (
            <button
              key={docType.id}
              onClick={() => setActiveType(docType.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeType === docType.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {docType.label}
              {docType.required && <span className="text-red-400 ml-1">*</span>}
              {uploadedDoc && <span className="ml-2">{statusToIcon(uploadedDoc.status)}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              {documentTypes.find(dt => dt.id === activeType)?.label}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {documentTypes.find(dt => dt.id === activeType)?.description}
            </p>
          </div>
        </div>
      </div>

      {submitHint ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100">
          {submitHint}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearPersistedKycDetails}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Trash2 className="size-4" />
          Clear saved PAN/Aadhaar details
        </button>
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-900 dark:text-blue-100">
        Select a document type below. PAN and Aadhaar open details forms instead of direct image upload.
      </div>

      {activeType === 'aadhaar' ? (
        <div className="border-2 border-dashed rounded-xl p-6 md:p-8 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 space-y-4">
          <div className="space-y-1 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enter Aadhaar Details</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Verify an existing Aadhaar card using details instead of direct upload flow.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={aadhaarDetails.aadhaarNumber}
              onChange={event => setAadhaarDetails(prev => ({ ...prev, aadhaarNumber: event.target.value }))}
              placeholder="Aadhaar Number"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={aadhaarDetails.firstName}
              onChange={event => setAadhaarDetails(prev => ({ ...prev, firstName: event.target.value }))}
              placeholder="First Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={aadhaarDetails.lastName}
              onChange={event => setAadhaarDetails(prev => ({ ...prev, lastName: event.target.value }))}
              placeholder="Last Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              pattern="\\d{2}/\\d{2}/\\d{4}"
              value={aadhaarDetails.dob}
              onChange={event => setAadhaarDetails(prev => ({ ...prev, dob: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={aadhaarDetails.fatherName}
              onChange={event => setAadhaarDetails(prev => ({ ...prev, fatherName: event.target.value }))}
              placeholder="Father's Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 md:col-span-2"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload Aadhaar Document <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleAadhaarDocumentChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-medium hover:file:bg-blue-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {aadhaarDocumentFile ? `Selected file: ${aadhaarDocumentFile.name}` : 'Attach an Aadhaar image to continue.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAadhaarVerify}
              disabled={aadhaarVerificationLoading || isSubmitting}
              className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60"
            >
              {aadhaarVerificationLoading ? 'Verifying Aadhaar...' : 'Verify Aadhaar Details'}
            </button>
          </div>

          {uploadedDocs.aadhaar && (
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{uploadedDocs.aadhaar.fileName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {uploadedDocs.aadhaar.processingNotes}
                </div>
              </div>
              {statusToIcon(uploadedDocs.aadhaar.status)}
            </div>
          )}

          {aadhaarDebugMessage && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100">
              <div className="font-medium">Verification details</div>
              <p className="mt-1 leading-6">{aadhaarDebugMessage}</p>
            </div>
          )}
        </div>
      ) : activeType === 'pan' ? (
        <div className="border-2 border-dashed rounded-xl p-6 md:p-8 bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 space-y-4">
          <div className="space-y-1 text-left">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Enter PAN Details</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Verify an existing PAN card using details instead of an image.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={panDetails.panNumber}
              onChange={event => setPanDetails(prev => ({ ...prev, panNumber: event.target.value }))}
              placeholder="PAN Number"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={panDetails.firstName}
              onChange={event => setPanDetails(prev => ({ ...prev, firstName: event.target.value }))}
              placeholder="First Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={panDetails.lastName}
              onChange={event => setPanDetails(prev => ({ ...prev, lastName: event.target.value }))}
              placeholder="Last Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              pattern="\\d{2}/\\d{2}/\\d{4}"
              value={panDetails.dob}
              onChange={event => setPanDetails(prev => ({ ...prev, dob: event.target.value }))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
            <input
              value={panDetails.fatherName}
              onChange={event => setPanDetails(prev => ({ ...prev, fatherName: event.target.value }))}
              placeholder="Father's Name"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload PAN Document <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="file"
                  accept="image/*"
                required
                onChange={handlePanDocumentChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:font-medium hover:file:bg-blue-700"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {panDocumentFile ? `Selected file: ${panDocumentFile.name}` : 'Attach a PAN image to continue.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handlePanVerify}
              disabled={panVerificationLoading || isSubmitting}
              className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60"
            >
              {panVerificationLoading ? 'Verifying PAN...' : 'Verify PAN Details'}
            </button>
          </div>

          {uploadedDocs.pan && (
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{uploadedDocs.pan.fileName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {uploadedDocs.pan.processingNotes}
                </div>
              </div>
              {statusToIcon(uploadedDocs.pan.status)}
            </div>
          )}

          {panDebugMessage && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100">
              <div className="font-medium">Verification details</div>
              <p className="mt-1 leading-6">{panDebugMessage}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <div>1. Uploaded image must be a recent photo.</div>
            <div>2. Uploading image must be passport size.</div>
            <div>3. Face must be clear in the uploading image.</div>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : uploadedDocs[activeType]
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          } ${isProcessing || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />

            {uploadedDocs[activeType] ? (
              <div className="space-y-4">
                {uploadedDocs[activeType].preview && (
                  <img
                    src={uploadedDocs[activeType].preview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg shadow-md"
                  />
                )}

                <div className="flex items-center justify-center gap-2">
                  {statusToIcon(uploadedDocs[activeType].status)}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {uploadedDocs[activeType].fileName}
                  </span>
                </div>

                {uploadedDocs[activeType].processingNotes && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{uploadedDocs[activeType].processingNotes}</p>
                )}

                <button
                  onClick={event => {
                    event.stopPropagation();
                    removeDocument(activeType);
                  }}
                  className="mt-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                >
                  <Trash2 className="size-4" />
                  Remove & Reupload
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="size-12 mx-auto text-gray-400" />
                <div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Supported: JPG, PNG (Max{' '}
                    {documentTypes.find(dt => dt.id === activeType)?.maxSize! / (1024 * 1024)}MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {Object.keys(uploadedDocs).length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">Upload Summary</h3>

          <div className="space-y-3">
            {documentTypes.map(docType => {
              const doc = uploadedDocs[docType.id];
              return (
                <div
                  key={docType.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-gray-500" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{docType.label}</div>
                      {doc && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.fileName} ({(doc.fileSize / 1024).toFixed(1)} KB)
                        </div>
                      )}
                      {doc?.status === 'rejected' && doc.processingNotes && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">Rejected: {doc.processingNotes}</div>
                      )}
                    </div>
                  </div>

                  {doc ? (
                    statusToIcon(doc.status)
                  ) : (
                    <span className="text-sm text-gray-400">
                      {docType.required ? 'Required' : 'Optional'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleSubmitAll}
            disabled={isProcessing || isSubmitting}
            className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-medium transition-all shadow-lg disabled:cursor-not-allowed"
          >
              {isSubmitting ? 'Submitting...' : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
