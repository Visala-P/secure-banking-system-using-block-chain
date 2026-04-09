import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Filter,
  Shield,
  TrendingUp,
  Activity,
  AlertCircle,
  Bot
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { API_BASE_URL, buildAuthHeaders, parseResponse } from '../lib/api';

interface AdminSummary {
  users: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
  verifications: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    recent: Array<{
      id: string;
      action: string;
      status: 'verified' | 'pending' | 'rejected';
      timestamp: string;
      user: {
        id: string;
        name: string;
        email: string;
      };
      autoVerified: boolean;
      confidence?: number | null;
      documentType?: string | null;
      notes?: string | null;
    }>;
  };
  blockchain: {
    totalBlocks: number;
    latestBlocks: Array<{
      blockNumber: number;
      hash: string;
      previousHash: string;
    }>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    status: 'verified' | 'pending' | 'rejected';
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  accountNumber: string;
  kycStatus: 'verified' | 'pending' | 'rejected';
  verificationCount: number;
  lastActivity?: string | null;
  joinedDate?: string | null;
  phone?: string | null;
  address?: string | null;
  verifications?: Array<{
    id: string;
    status: 'verified' | 'pending' | 'rejected';
    timestamp: string;
  }>;
}

interface AdminVerification {
  id: string;
  userId: string;
  action: string;
  status: 'verified' | 'pending' | 'rejected';
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  documentType?: string | null;
  notes?: string | null;
  autoVerified: boolean;
  confidence?: number | null;
}

export function AdminDashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [summaryRes, usersRes, verificationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary`, { headers: buildAuthHeaders(token), cache: 'no-store' }),
        fetch(`${API_BASE_URL}/users`, { headers: buildAuthHeaders(token), cache: 'no-store' }),
        fetch(`${API_BASE_URL}/verification`, { headers: buildAuthHeaders(token), cache: 'no-store' })
      ]);

      const [summaryData, usersData, verificationData] = await Promise.all([
        parseResponse<AdminSummary>(summaryRes),
        parseResponse<AdminUser[]>(usersRes),
        parseResponse<AdminVerification[]>(verificationsRes)
      ]);

      setSummary(summaryData);
      setUsers(usersData);
      setVerifications(verificationData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const refreshDashboardData = useCallback(() => {
    fetchDashboardData().catch(() => undefined);
  }, [fetchDashboardData]);

  useEffect(() => {
    refreshDashboardData();

    const intervalId = window.setInterval(() => {
      refreshDashboardData();
    }, 3000);

    const handleFocus = () => {
      refreshDashboardData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboardData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshDashboardData]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const latestVerificationStatus = user.verifications?.[0]?.status ?? user.kycStatus;
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || latestVerificationStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  const automationStats = useMemo(() => {
    const autoApproved = verifications.filter(v => v.status === 'verified' && v.autoVerified).length;
    const autoRejected = verifications.filter(v => v.status === 'rejected' && v.autoVerified).length;
    const totalProcessed = verifications.length;
    const automationRate = totalProcessed === 0 ? 0 : Math.round(((autoApproved + autoRejected) / totalProcessed) * 100);

    return {
      autoApproved,
      autoRejected,
      totalProcessed,
      automationRate
    };
  }, [verifications]);

  const pendingVerifications = verifications.filter(v => v.status === 'pending');

  const handleManualReview = async (id: string, action: 'approve' | 'reject') => {
    if (!token) {
      toast.error('Missing authentication token');
      return;
    }

    try {
      await parseResponse(
        await fetch(`${API_BASE_URL}/verification/${id}/status`, {
          method: 'PATCH',
          headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: action === 'approve' ? 'verified' : 'rejected' })
        })
      );

      toast.success(`Verification ${action === 'approve' ? 'approved' : 'rejected'}.`);
      fetchDashboardData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update verification status');
    }
  };

  const cards = [
    {
      label: 'Total Users',
      value: summary?.users.total ?? 0,
      icon: Users,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Verified Users',
      value: summary?.users.verified ?? 0,
      icon: CheckCircle,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    },
    {
      label: 'Pending Users',
      value: summary?.users.pending ?? 0,
      icon: Clock,
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
    },
    {
      label: 'Total Blocks',
      value: summary?.blockchain.totalBlocks ?? 0,
      icon: Shield,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage users and verification requests</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-xl p-6 shadow-lg mb-6"
        >
          <div className="flex items-center gap-3 mb-4 text-white">
            <Bot className="size-8" />
            <div>
              <h3 className="text-xl font-bold">AI Verification Engine</h3>
              <p className="text-purple-100">Automated document processing with OCR & validation</p>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
              <div className="text-xs text-purple-100 mb-1">Total Processed</div>
              <div className="text-2xl font-bold text-white">{automationStats.totalProcessed}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
              <div className="text-xs text-green-100 mb-1">Auto-Approved</div>
              <div className="text-2xl font-bold text-white">{automationStats.autoApproved}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
              <div className="text-xs text-red-100 mb-1">Auto-Rejected</div>
              <div className="text-2xl font-bold text-white">{automationStats.autoRejected}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-lg p-4">
              <div className="text-xs text-blue-100 mb-1 flex items-center gap-1">
                <TrendingUp className="size-3" />
                Automation Rate
              </div>
              <div className="text-2xl font-bold text-white">{automationStats.automationRate}%</div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}
                    className="pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Verifications
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Activity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map(user => (
                    (() => {
                      const latestVerificationStatus = user.verifications?.[0]?.status ?? user.kycStatus;
                      return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900 dark:text-white">{user.accountNumber}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={latestVerificationStatus} size="sm" />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {user.verificationCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                      );
                    })()
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                        {loading ? 'Loading users...' : 'No users match your filters'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Activity className="size-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Verifications</h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Monitoring automated AI decisions</p>
            </div>

            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              {(summary?.verifications?.recent ?? []).map(verification => (
                <div
                  key={verification.id}
                  className={`p-4 rounded-lg border-2 ${
                    verification.status === 'verified'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : verification.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white mb-1">{verification.user.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{verification.action}</div>
                      {verification.documentType && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">📄 {verification.documentType}</div>
                      )}
                    </div>
                    <StatusBadge status={verification.status} size="sm" />
                  </div>

                  {verification.confidence !== undefined && verification.confidence !== null && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">AI Confidence</span>
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {verification.confidence.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            verification.confidence >= 80
                              ? 'bg-green-500'
                              : verification.confidence >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${verification.confidence}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {verification.notes && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 italic whitespace-pre-line">"{verification.notes}"</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(verification.timestamp).toLocaleString()}
                    </div>

                    {verification.autoVerified ? (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium flex items-center gap-1">
                        <Bot className="size-3" />
                        Auto-Verified
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                        Manual
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(summary?.verifications?.recent?.length ?? 0) === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400">No verification activity yet</div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pending Verifications</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review submissions awaiting attention</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingVerifications.map(verification => (
                  <tr key={verification.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{verification.user.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{verification.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {verification.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(verification.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {verification.confidence ? `${verification.confidence.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                      <button
                        onClick={() => handleManualReview(verification.id, 'approve')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleManualReview(verification.id, 'reject')}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
                {pendingVerifications.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-gray-500 dark:text-gray-400">
                      {loading ? 'Loading verifications...' : 'No pending verifications'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
