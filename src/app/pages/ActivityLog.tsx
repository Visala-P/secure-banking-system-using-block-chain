import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Shield
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
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
  };
  blockchain: {
    totalBlocks: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    status: 'verified' | 'pending' | 'rejected';
    createdAt: string;
    referenceId?: string | null;
    metadata?: Record<string, unknown> | null;
    user: {
      id: string;
      name: string;
      email: string;
    };
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
  block?: {
    blockNumber: number;
  } | null;
  notes?: string | null;
  verifiedBy?: string | null;
  documentType?: string | null;
}

interface UserDashboardActivityResponse {
  user: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
  verifications: Array<{
    id: string;
    action: string;
    status: 'verified' | 'pending' | 'rejected';
    timestamp: string;
    verifiedBy?: string | null;
    notes?: string | null;
    documentType?: string | null;
    block?: {
      blockNumber?: number | null;
    } | null;
  }>;
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  status: 'verified' | 'pending' | 'rejected';
  timestamp: string;
  verifiedBy?: string;
  blockNumber?: number;
  notes?: string;
  documentType?: string;
}

export function ActivityLog() {
  const { token, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const fetchActivityData = useCallback(async () => {
    if (!token || !user?.id) {
      return;
    }

    if (user.role === 'admin') {
      const [summaryRes, verificationsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/summary`, { headers: buildAuthHeaders(token), cache: 'no-store' }),
        fetch(`${API_BASE_URL}/verification`, { headers: buildAuthHeaders(token), cache: 'no-store' })
      ]);

      const [summaryData, verificationData] = await Promise.all([
        parseResponse<AdminSummary>(summaryRes),
        parseResponse<AdminVerification[]>(verificationsRes)
      ]);

      const verificationActivities: ActivityItem[] = verificationData.map(record => ({
        id: record.id,
        userId: record.user.id,
        userName: record.user.name,
        action: record.action,
        status: record.status,
        timestamp: record.timestamp,
        verifiedBy: record.verifiedBy ?? undefined,
        blockNumber: record.block?.blockNumber,
        notes: record.notes ?? undefined,
        documentType: record.documentType ?? undefined
      }));

      const registrationActivities: ActivityItem[] = summaryData.recentActivity
        .filter(entry => /registered/i.test(entry.action))
        .map(entry => ({
          id: `activity-${entry.id}`,
          userId: entry.user.id,
          userName: entry.user.name,
          action: entry.action,
          status: entry.status,
          timestamp: entry.createdAt,
          notes:
            entry.metadata && typeof entry.metadata === 'object' && 'accountNumber' in entry.metadata
              ? `Account: ${String(entry.metadata.accountNumber)}`
              : undefined
        }));

      const merged = [...verificationActivities, ...registrationActivities].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setSummary(summaryData);
      setActivities(merged);
      return;
    }

    const userDashboardRes = await fetch(`${API_BASE_URL}/dashboard/user/${user.id}`, {
      headers: buildAuthHeaders(token),
      cache: 'no-store'
    });
    const userDashboardData = await parseResponse<UserDashboardActivityResponse>(userDashboardRes);

    const userActivities: ActivityItem[] = userDashboardData.verifications.map(record => ({
      id: record.id,
      userId: userDashboardData.user.id,
      userName: userDashboardData.user.name,
      action: record.action,
      status: record.status,
      timestamp: record.timestamp,
      verifiedBy: record.verifiedBy ?? undefined,
      blockNumber: record.block?.blockNumber ?? undefined,
      notes: record.notes ?? undefined,
      documentType: record.documentType ?? undefined
    }));

    setSummary(null);
    setActivities(userActivities);
  }, [token, user]);

  const refreshActivityData = useCallback(() => {
    fetchActivityData().catch(() => undefined);
  }, [fetchActivityData]);

  useEffect(() => {
    fetchActivityData().catch(error => {
      toast.error(error instanceof Error ? error.message : 'Failed to load activity data');
    });

    const intervalId = window.setInterval(() => {
      refreshActivityData();
    }, 3000);

    const handleFocus = () => {
      refreshActivityData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshActivityData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchActivityData, refreshActivityData]);

  const filteredActivities = useMemo(() => activities.filter((activity) => {
    const matchesSearch =
      activity.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const activityDate = new Date(activity.timestamp);
      const now = new Date();
      const daysAgo = parseInt(dateFilter);
      const filterDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      matchesDate = activityDate >= filterDate;
    }

    return matchesSearch && matchesStatus && matchesDate;
  }), [activities, searchQuery, statusFilter, dateFilter]);

  const exportLog = () => {
    const csvContent = [
      ['Timestamp', 'User ID', 'User Name', 'Action', 'Status', 'Verified By', 'Block Number', 'Notes'],
      ...filteredActivities.map((activity) => [
        activity.timestamp,
        activity.userId,
        activity.userName,
        activity.action,
        activity.status,
        activity.verifiedBy || '',
        activity.blockNumber || '',
        activity.notes || ''
      ])
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Activity log exported successfully!');
  };

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="size-5 text-green-600 dark:text-green-400" />;
      case 'pending':
        return <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />;
      case 'rejected':
        return <XCircle className="size-5 text-red-600 dark:text-red-400" />;
      default:
        return <Activity className="size-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const derivedCounts = useMemo(() => {
    const verified = activities.filter((a) => a.status === 'verified').length;
    const pending = activities.filter((a) => a.status === 'pending').length;
    const rejected = activities.filter((a) => a.status === 'rejected').length;
    const blocks = new Set(activities.filter(a => a.blockNumber !== undefined).map(a => a.blockNumber)).size;

    return {
      total: activities.length,
      verified,
      pending,
      rejected,
      blocks
    };
  }, [activities]);

  const stats = [
    {
      label: 'Total Activities',
      value: summary?.verifications.total ?? derivedCounts.total,
      change: '+12% this month'
    },
    {
      label: 'Verified',
      value: summary?.verifications.approved ?? derivedCounts.verified,
      change: '+8% this month'
    },
    {
      label: 'Pending',
      value: summary?.verifications.pending ?? derivedCounts.pending,
      change: 'Needs attention'
    },
    {
      label: 'Blockchain Blocks',
      value: summary?.blockchain.totalBlocks ?? derivedCounts.blocks,
      change: '100% verified'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="size-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Activity & Audit Log</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Complete transparency with timestamp-based tracking of all verification activities
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{stat.label}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400">{stat.change}</div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-6"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, action, or ID..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex gap-4">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white appearance-none cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                </select>
              </div>

              <button
                onClick={exportLog}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download className="size-4" />
                Export
              </button>
            </div>
          </div>
        </motion.div>

        {/* Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Activity Timeline ({filteredActivities.length} records)
            </h2>
          </div>

          <div className="p-6">
            {filteredActivities.length > 0 ? (
              <div className="space-y-4">
                {filteredActivities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex-shrink-0">{getActivityIcon(activity.status)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {activity.action}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="size-3 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {activity.userName} ({activity.userId})
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={activity.status} size="sm" />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                          <div className="text-gray-900 dark:text-white">
                            {new Date(activity.timestamp).toLocaleString()}
                          </div>
                        </div>

                        {activity.documentType && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Document:</span>
                            <div className="text-gray-900 dark:text-white">{activity.documentType}</div>
                          </div>
                        )}

                        {activity.verifiedBy && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Verified By:</span>
                            <div className="text-gray-900 dark:text-white">{activity.verifiedBy}</div>
                          </div>
                        )}

                        {activity.blockNumber !== undefined && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Block:</span>
                            <div className="flex items-center gap-1">
                              <Shield className="size-3 text-blue-600 dark:text-blue-400" />
                              <span className="text-blue-600 dark:text-blue-400 font-mono">
                                #{activity.blockNumber}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {activity.notes && (
                        <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes:</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            {activity.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No activities found matching your filters
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
