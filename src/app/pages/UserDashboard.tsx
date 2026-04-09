import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  User,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  QrCode,
  CreditCard,
  Activity,
  Upload,
  FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore - Local declaration file is not always picked up by inferred TS projects.
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { DocumentUpload } from '../components/DocumentUpload';
import { API_BASE_URL, buildAuthHeaders, parseResponse } from '../lib/api';

interface VerificationRecord {
  id: string;
  action: string;
  status: 'verified' | 'pending' | 'rejected';
  timestamp: string;
  verifiedBy?: string | null;
  documentType?: string | null;
  notes?: string | null;
  block?: {
    blockNumber?: number | null;
  } | null;
  documentUploads?: Array<{
    id: string;
    type: string;
    status: 'verified' | 'rejected' | 'pending' | 'processing';
    fileName: string;
    processingNotes?: string | null;
  }>;
}

interface UserDashboardResponse {
  user: {
    id: string;
    name: string;
    email: string;
    accountNumber: string;
    kycStatus: 'verified' | 'pending' | 'rejected';
    phone?: string | null;
    address?: string | null;
    joinedDate?: string | null;
    verificationCount: number;
    lastActivity?: string | null;
    qrCodePayload?: string;
  };
  stats: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
  verifications: VerificationRecord[];
  documents: Array<{
    id: string;
    type: string;
    status: 'processing' | 'verified' | 'pending' | 'rejected';
    uploadedAt: string;
  }>;
}

const emptyStats = { total: 0, verified: 0, pending: 0, rejected: 0 };
const REQUIRED_VERIFIED_DOC_TYPES = ['aadhaar', 'pan', 'selfie'] as const;

type VerificationUpload = NonNullable<VerificationRecord['documentUploads']>[number];

const formatDocumentTypeLabel = (type: string): string => {
  if (type === 'selfie') {
    return 'passport size img';
  }

  return type;
};

const buildDisplayDocumentUploads = (verification: VerificationRecord): VerificationUpload[] => {
  const existing = verification.documentUploads ?? [];

  if (verification.status !== 'verified') {
    return existing;
  }

  const byType = new Map(existing.map(upload => [upload.type, upload]));
  const merged = [...existing];

  for (const type of REQUIRED_VERIFIED_DOC_TYPES) {
    if (!byType.has(type)) {
      merged.push({
        id: `${verification.id}-${type}`,
        type,
        status: 'verified',
        fileName: `${type} details`,
        processingNotes: null
      });
    }
  }

  return merged;
};

export function UserDashboard() {
  const { user: authUser, token } = useAuth();
  const [dashboard, setDashboard] = useState<UserDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);
  const [qrCode, setQrCode] = useState('');

  const fetchDashboard = useCallback(async () => {
    if (!authUser?.id || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/user/${authUser.id}`, {
        headers: buildAuthHeaders(token)
      });
      const data = await parseResponse<UserDashboardResponse>(response);
      setDashboard(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, token]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const profile = dashboard?.user ?? authUser;
  const stats = dashboard?.stats ?? emptyStats;
  const verifications = dashboard?.verifications ?? [];
  useEffect(() => {
    if (profile) {
      const qrPayload =
        profile.qrCodePayload ??
        `USER:${profile.id}|ACCOUNT:${profile.accountNumber ?? 'NA'}|REGISTERED:${profile.joinedDate ?? ''}`;

      QRCode.toDataURL(qrPayload, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      }).then(setQrCode);
    }
  }, [profile]);

  const downloadVerificationReport = () => {
    if (!profile) {
      toast.error('User profile unavailable');
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text('SecureBank Verification Report', 20, 20);

    doc.setFontSize(12);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);

    doc.setFontSize(14);
    doc.text('User Information', 20, 45);
    doc.setFontSize(11);
    doc.text(`Name: ${profile.name}`, 20, 55);
    doc.text(`User ID: ${profile.id}`, 20, 62);
    doc.text(`Email: ${profile.email}`, 20, 69);
    doc.text(`Account: ${profile.accountNumber}`, 20, 76);
    doc.text(`Status: ${profile.kycStatus.toUpperCase()}`, 20, 83);

    doc.setFontSize(14);
    doc.text('Verification History', 20, 100);

    let y = 110;
    verifications.forEach((verification, index) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.text(`${index + 1}. ${verification.action}`, 20, y);
      doc.text(`   Status: ${verification.status}`, 20, y + 7);
      doc.text(`   Date: ${new Date(verification.timestamp).toLocaleDateString()}`, 20, y + 14);
      if (verification.verifiedBy) {
        doc.text(`   Verified By: ${verification.verifiedBy}`, 20, y + 21);
      }

      let docOffset = 28;
      if (verification.documentUploads && verification.documentUploads.length > 0) {
        const displayUploads = buildDisplayDocumentUploads(verification);
        doc.text(`   Documents:`, 20, y + docOffset);
        docOffset += 7;
        displayUploads.forEach(docUpload => {
          const docStatus = docUpload.status === 'verified' ? '✓' : '✗';
          doc.text(`   ${docStatus} ${formatDocumentTypeLabel(docUpload.type)}: ${docUpload.status}`, 20, y + docOffset);
          docOffset += 7;
        });
      }

      if (verification.status === 'rejected' && verification.notes) {
        const reasonLines = doc.splitTextToSize(`   Rejection Reason: ${verification.notes}`, 165);
        doc.text(reasonLines, 20, y + docOffset);
        docOffset += 7 * reasonLines.length;
      }

      y += 35 + docOffset;
    });

    doc.save(`verification-report-${profile.id}.pdf`);
    toast.success('Report downloaded successfully!');
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Sign in to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">User Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your profile and view verification status
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {profile.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profile.name}</h2>
                  <p className="text-gray-600 dark:text-gray-400">{profile.email}</p>
                </div>
              </div>
              <StatusBadge status={profile.kycStatus} size="lg" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">User ID</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">{profile.id}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Number</div>
                <div className="font-mono font-medium text-gray-900 dark:text-white">
                  {profile.accountNumber}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone</div>
                <div className="font-medium text-gray-900 dark:text-white">{profile.phone || 'Not set'}</div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Member Since</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {profile.joinedDate ? new Date(profile.joinedDate).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>

            {profile.address && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Address</div>
                <div className="font-medium text-gray-900 dark:text-white">{profile.address}</div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 shadow-lg text-white"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Digital ID Card</h3>
              <CreditCard className="size-5" />
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4 mb-4">
              {qrCode && <img src={qrCode} alt="QR Code" className="w-full" />}
            </div>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(profile.id)
                  .then(() => toast.success('User ID copied to clipboard!'))
                  .catch(() => toast.error('Unable to copy user ID.'));
              }}
              className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <QrCode className="size-4" />
              Copy User ID
            </button>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Verifications', value: stats.total, icon: Activity, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
            { label: 'Verified', value: stats.verified, icon: CheckCircle, color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="size-6" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {profile.kycStatus !== 'verified' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 shadow-lg mb-6"
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 text-white">
                <FileCheck className="size-8" />
                <div>
                  <h3 className="text-xl font-bold">Reapply for Verification</h3>
                  <p className="text-blue-100">
                    Open the verification panel and select Aadhaar, PAN, passport size photo, passport, or license.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVerificationPanel(prev => !prev)}
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Upload className="size-4" />
                {showVerificationPanel ? 'Hide Verification' : 'Reapply for Verification'}
              </button>
            </div>

            {showVerificationPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg p-6"
              >
                <DocumentUpload
                  userId={profile.id}
                  submissionAction={profile.kycStatus === 'rejected' ? 'KYC Reverification' : 'KYC Verification'}
                  submitLabel={profile.kycStatus === 'rejected' ? 'Request Verification Again' : 'Submit for Verification'}
                  submitHint={
                    profile.kycStatus === 'rejected'
                      ? 'Use this after updating your documents. The new request will be treated as a fresh verification attempt.'
                      : undefined
                  }
                  onVerificationComplete={() => {
                    toast.success('Verification submitted. Refreshing dashboard...');
                    fetchDashboard();
                    setShowVerificationPanel(false);
                  }}
                />
              </motion.div>
            )}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verification History</h2>
            <button
              onClick={downloadVerificationReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="size-4" />
              Download Report
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Verified By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Block #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {verifications.length > 0 ? (
                  verifications.map(verification => (
                    <tr key={verification.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {verification.action}
                        </div>
                        {verification.documentType && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {verification.status === 'verified'
                              ? 'aadhaar, pan, passport size img'
                              : formatDocumentTypeLabel(verification.documentType)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={verification.status} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(verification.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {verification.verifiedBy || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {verification.block?.blockNumber !== undefined && verification.block?.blockNumber !== null ? (
                          <Link to="/blockchain" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                            #{verification.block.blockNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-lg">
                        <div className="space-y-1">
                          {buildDisplayDocumentUploads(verification).length > 0 ? (
                            <div>
                              <div className="font-medium text-gray-700 dark:text-gray-200 text-xs mb-1">
                                Documents:
                              </div>
                              <div className="space-y-0.5">
                                {buildDisplayDocumentUploads(verification).map(docUpload => (
                                  <div key={docUpload.id} className="text-xs">
                                    <span
                                      className={docUpload.status === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                                    >
                                      {docUpload.status === 'verified' ? '✓' : '✗'} {formatDocumentTypeLabel(docUpload.type)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {verification.status === 'rejected' && verification.notes ? (
                            <div className="text-red-600 dark:text-red-400 pt-1 border-t border-gray-300 dark:border-gray-600 whitespace-pre-line">
                              {verification.notes}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading history...' : 'No verification history yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
