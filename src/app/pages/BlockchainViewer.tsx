import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, Search, TrendingUp } from 'lucide-react';
import { BlockchainCard } from '../components/BlockchainCard';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL, parseResponse } from '../lib/api';

interface ChainBlock {
  id: string;
  blockNumber: number;
  hash: string;
  previousHash: string;
  nonce: number;
  timestamp: string;
  data: {
    userId?: string;
    action?: string;
    status?: string;
    verifiedBy?: string;
  };
}

export function BlockchainViewer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'chain' | 'timeline'>('chain');
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);

  const fetchChain = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/blockchain/chain`);
    const data = await parseResponse<ChainBlock[]>(response);
    setBlocks(data);
  }, []);

  useEffect(() => {
    fetchChain().catch(() => undefined);
    const intervalId = window.setInterval(() => {
      fetchChain().catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [fetchChain]);

  const filteredBlocks = blocks.filter(
    (block) =>
      block.blockNumber.toString().includes(searchQuery) ||
      block.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (block.data.userId ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const chartData = useMemo(
    () =>
      blocks.map((block) => ({
        block: block.blockNumber,
        timestamp: new Date(block.timestamp).getTime()
      })),
    [blocks]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="size-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Blockchain Explorer</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            View the complete verification blockchain with full transparency
          </p>
        </div>

        {/* Stats Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white mb-6 shadow-lg"
        >
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold mb-1">{blocks.length}</div>
              <div className="text-blue-100">Total Blocks</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">
                {blocks.filter((b) => b.data?.status === 'verified').length}
              </div>
              <div className="text-blue-100">Verified Transactions</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">
                {blocks[blocks.length - 1]?.hash.substring(0, 8) ?? 'N/A'}...
              </div>
              <div className="text-blue-100">Latest Hash</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-1">100%</div>
              <div className="text-blue-100">Chain Integrity</div>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by block number, hash, or user ID..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white shadow-sm"
            />
          </div>
          <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setViewMode('chain')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'chain'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Chain View
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>

        {/* Timeline Chart */}
        {viewMode === 'timeline' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Block Timeline</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  dataKey="block"
                  stroke="#9ca3af"
                  label={{ value: 'Block Number', position: 'insideBottom', offset: -5 }}
                />
                <YAxis stroke="#9ca3af" hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: number) => new Date(value).toLocaleString()}
                  labelFormatter={(label) => `Block #${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="timestamp"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorBlock)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Blockchain */}
        <div className="space-y-6">
          {filteredBlocks.length > 0 ? (
            filteredBlocks.map((block, index) => (
              <BlockchainCard
                key={block.blockNumber}
                block={block}
                index={index}
                isConnected={index < filteredBlocks.length - 1}
              />
            ))
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No blocks found matching your search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
