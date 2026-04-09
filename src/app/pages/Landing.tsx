import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Shield, Lock, Database, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { QuickStartGuide } from '../components/QuickStartGuide';

export function Landing() {
  const features = [
    {
      icon: Shield,
      title: 'Blockchain Security',
      description: 'Your verification data is stored on an immutable blockchain, ensuring maximum security and transparency.'
    },
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      description: 'All your personal and financial data is encrypted using industry-standard protocols.'
    },
    {
      icon: Database,
      title: 'Decentralized Storage',
      description: 'No single point of failure. Your data is distributed across multiple secure nodes.'
    },
    {
      icon: CheckCircle,
      title: 'Instant Verification',
      description: 'Real-time verification status updates with complete audit trail transparency.'
    },
    {
      icon: TrendingUp,
      title: 'Advanced Analytics',
      description: 'Track your verification history and account activity with detailed analytics.'
    },
    {
      icon: Users,
      title: 'Multi-Role Access',
      description: 'Separate dashboards for users and administrators with role-based permissions.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-6">
              <Shield className="size-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Blockchain-Powered Banking
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gray-900 dark:text-white">
              Secure Online Banking
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                with Blockchain
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Experience the future of banking with our blockchain-based verification system.
              Secure, transparent, and lightning-fast verification for all your banking needs.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Get Started Free
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium text-lg transition-colors border-2 border-gray-200 dark:border-gray-700"
              >
                Sign In
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-blue-200 dark:border-blue-800">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-12 text-white">
                <div className="grid grid-cols-3 gap-8 max-w-4xl mx-auto">
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">10K+</div>
                    <div className="text-blue-100">Verified Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">99.9%</div>
                    <div className="text-blue-100">Uptime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">50K+</div>
                    <div className="text-blue-100">Transactions</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
              Why Choose SecureBank?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Built with cutting-edge technology to protect your financial identity
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-6 bg-gray-50 dark:bg-gray-700 rounded-xl hover:shadow-lg transition-shadow"
              >
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg w-fit mb-4">
                  <feature.icon className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-white"
          >
            <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-xl mb-8 text-blue-100">
              Join thousands of users who trust SecureBank for their verification needs
            </p>
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl font-medium text-lg hover:bg-gray-100 transition-colors"
            >
              Create Your Account
            </Link>
          </motion.div>
        </div>
      </section>
      
      <QuickStartGuide />
    </div>
  );
}