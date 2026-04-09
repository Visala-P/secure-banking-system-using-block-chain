import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Shield, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { usersData, verificationRecords } from '../data/mockData';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';

export function VerificationChecker() {
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      toast.error('Please enter a User ID');
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      const userData = usersData.find((u) => u.id.toLowerCase() === userId.toLowerCase());
      const userVerifications = verificationRecords.filter(
        (v) => v.userId.toLowerCase() === userId.toLowerCase()
      );

      if (userData) {
        setResult({
          found: true,
          user: userData,
          verifications: userVerifications
        });
        toast.success('User verification status retrieved!');
      } else {
        setResult({ found: false });
        toast.error('User not found in the system');
      }

      setLoading(false);
    }, 800);
  };

  const getStatusIcon = (status: 'verified' | 'pending' | 'rejected') => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="size-16 text-green-600 dark:text-green-400" />;
      case 'pending':
        return <Clock className="size-16 text-yellow-600 dark:text-yellow-400" />;
      case 'rejected':
        return <XCircle className="size-16 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <Shield className="size-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Verification Checker
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter a User ID to instantly check their verification status
          </p>
        </div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 mb-6"
        >
          <form onSubmit={handleCheck} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter User ID (e.g., USR001)"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Try:</span>
            {['USR001', 'USR002', 'USR003', 'USR004'].map((id) => (
              <button
                key={id}
                onClick={() => setUserId(id)}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 transition-colors"
              >
                {id}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {result.found ? (
              <>
                {/* Status Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                  <div className="inline-flex items-center justify-center mb-4">
                    {getStatusIcon(result.user.kycStatus)}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {result.user.name}
                  </h2>
                  <div className="inline-flex mb-6">
                    <StatusBadge status={result.user.kycStatus} size="lg" />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">User ID</div>
                      <div className="font-mono font-medium text-gray-900 dark:text-white">
                        {result.user.id}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account</div>
                      <div className="font-mono font-medium text-gray-900 dark:text-white">
                        {result.user.accountNumber}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Verifications
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {result.user.verificationCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Verification History */}
                {result.verifications.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                      <FileText className="size-5 text-blue-600 dark:text-blue-400" />
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Verification History
                      </h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {result.verifications.map((verification: any) => (
                        <div
                          key={verification.id}
                          className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white mb-1">
                                {verification.action}
                              </div>
                              {verification.documentType && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Document: {verification.documentType}
                                </div>
                              )}
                            </div>
                            <StatusBadge status={verification.status} size="sm" />
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Date:</span>
                              <span className="ml-2 text-gray-900 dark:text-white">
                                {new Date(verification.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            {verification.verifiedBy && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Verified By:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">
                                  {verification.verifiedBy}
                                </span>
                              </div>
                            )}
                            {verification.blockNumber !== undefined && (
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Block:</span>
                                <span className="ml-2 text-blue-600 dark:text-blue-400 font-mono">
                                  #{verification.blockNumber}
                                </span>
                              </div>
                            )}
                          </div>
                          {verification.notes && (
                            <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                              {verification.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <XCircle className="size-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  User Not Found
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  No user found with ID: <strong>{userId}</strong>
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Info Banner */}
        {!result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6"
          >
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">
              How Verification Works
            </h3>
            <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
              <li className="flex items-start gap-2">
                <CheckCircle className="size-5 flex-shrink-0 mt-0.5" />
                <span>
                  Every verification is recorded on our secure blockchain for complete transparency
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-5 flex-shrink-0 mt-0.5" />
                <span>Real-time status updates with instant verification results</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-5 flex-shrink-0 mt-0.5" />
                <span>Immutable audit trail for all verification activities</span>
              </li>
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}
