import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../lib/api';
import { extractPanOcrText } from '../lib/panOcr';

type VerificationForm = {
  panNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  fatherName: string;
};

const toIsoDate = (value: string): string => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return value.trim();
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

export function PanCardVerification() {
  const [form, setForm] = useState<VerificationForm>({
    panNumber: '',
    firstName: '',
    lastName: '',
    dob: '',
    fatherName: ''
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');

  const handleChange = (field: keyof VerificationForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setDocumentFile(file ?? null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setVerified(false);
    setDebugMessage('');

    try {
      if (!documentFile) {
        throw new Error('Please upload a PAN document');
      }

      const formData = new FormData();
      const fullName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
      formData.append('panNumber', form.panNumber.trim().toUpperCase());
      formData.append('name', fullName);
      formData.append('lastName', form.lastName.trim());
      formData.append('dob', toIsoDate(form.dob));
      formData.append('fatherName', form.fatherName.trim());
      formData.append('document', documentFile);
      formData.append('ocrText', await extractPanOcrText(documentFile));

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
          setDebugMessage(detailParts.join(' | '));
        }
        throw new Error(payload?.message || 'PAN verification failed');
      }

      if (!payload?.verified || payload?.status !== 'verified') {
        setDebugMessage(detailParts.join(' | '));
        throw new Error(payload?.message || 'PAN details could not be confidently verified');
      }

      setVerified(true);
      toast.success(payload?.message || 'PAN Card verified successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PAN verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-gray-900 dark:to-slate-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-gray-200/70 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-xl p-6 md:p-8"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-600 dark:text-blue-400">
              <FileSearch className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">PAN Card Verification</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Enter PAN details to verify an existing card</p>
            </div>
          </div>

          {verified && (
            <div className="mb-6 rounded-2xl border border-emerald-300/40 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-emerald-800 dark:text-emerald-100">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-5" />
                PAN Card verified successfully
              </div>
              <p className="mt-1 text-sm">
                The provided PAN details matched the verification service.
              </p>
            </div>
          )}

          {debugMessage && !verified && (
            <div className="mb-6 rounded-2xl border border-amber-300/40 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-100">
              <div className="text-sm font-medium">Verification details</div>
              <p className="mt-1 text-sm leading-6">{debugMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">PAN Number</label>
              <input
                required
                value={form.panNumber}
                onChange={handleChange('panNumber')}
                placeholder="ABCDE1234F"
                className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                <input
                  required
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  placeholder="First name"
                  className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                <input
                  required
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                  placeholder="Last name"
                  className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
              <input
                required
                type="text"
                inputMode="numeric"
                placeholder="DD/MM/YYYY"
                pattern="\\d{2}/\\d{2}/\\d{4}"
                value={form.dob}
                onChange={handleChange('dob')}
                className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Father&apos;s Name</label>
              <input
                required
                value={form.fatherName}
                onChange={handleChange('fatherName')}
                placeholder="Father's name"
                className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upload PAN Document <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={handleDocumentChange}
                  className="w-full rounded-2xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {documentFile ? `Selected file: ${documentFile.name}` : 'Attach a PAN image to continue.'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verifying...' : 'Verify PAN'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}