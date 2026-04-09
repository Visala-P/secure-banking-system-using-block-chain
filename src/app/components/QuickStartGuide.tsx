import { useState } from 'react';
import { X, Info, User, Shield, Database, FileSearch, Activity, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors"
        aria-label="Open quick start guide"
      >
        <Info className="size-6" />
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="size-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-gray-900 dark:text-white">Quick Start Guide</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="size-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <User className="size-4 text-blue-600 dark:text-blue-400" />
                Demo Credentials
              </h4>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">User Account</div>
                  <div className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                    Email: user@bank.com<br />
                    Password: password
                  </div>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">Admin Account</div>
                  <div className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                    Email: admin@bank.com<br />
                    Password: password
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Shield className="size-4 text-green-600 dark:text-green-400" />
                Key Features
              </h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Dark Mode:</strong> Toggle between light and dark themes</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Role-Based Access:</strong> Different dashboards for users and admins</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>QR Codes:</strong> Digital identity cards with QR codes</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="size-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>PDF Reports:</strong> Download verification reports</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Pages to Explore</h4>
              <div className="space-y-2 text-sm">
                <a
                  href="/blockchain"
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Database className="size-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-900 dark:text-white">Blockchain Explorer</span>
                </a>
                <a
                  href="/verify"
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <FileSearch className="size-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-gray-900 dark:text-white">Verification Checker</span>
                </a>
                <a
                  href="/activity"
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <Activity className="size-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-900 dark:text-white">Activity Log</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
