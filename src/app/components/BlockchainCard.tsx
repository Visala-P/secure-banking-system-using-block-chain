import { motion } from 'motion/react';
import { Box, Clock, Hash, Database } from 'lucide-react';

interface Block {
  blockNumber: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  data: {
    userId?: string;
    action?: string;
    status?: string;
    verifiedBy?: string;
  };
  nonce: number;
}

interface BlockchainCardProps {
  block: Block;
  index: number;
  isConnected?: boolean;
}

export function BlockchainCard({ block, index, isConnected = true }: BlockchainCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Box className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900 dark:text-white">
                Block #{block.blockNumber}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(block.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
              block.data.status
            )}`}
          >
            {block.data.status}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Hash className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Hash</div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                {block.hash.substring(0, 32)}...
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Database className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Previous Hash</div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                {block.previousHash === '0' || /^0+$/.test(block.previousHash)
                  ? 'Genesis'
                  : `${block.previousHash.substring(0, 32)}...`}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Transaction Data</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">User:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{block.data.userId ?? 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Action:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {block.data.action ?? 'N/A'}
                </span>
              </div>
              {block.data.verifiedBy && (
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">Verified By:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {block.data.verifiedBy}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="size-3" />
            <span>Nonce: {block.nonce}</span>
          </div>
        </div>
      </motion.div>

      {isConnected && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-blue-300 dark:bg-blue-700"></div>
      )}
    </div>
  );
}