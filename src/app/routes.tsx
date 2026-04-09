import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { UserDashboard } from './pages/UserDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { BlockchainViewer } from './pages/BlockchainViewer';
import { VerificationChecker } from './pages/VerificationChecker';
import { ActivityLog } from './pages/ActivityLog';
import { PanCardVerification } from './pages/PanCardVerification';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isAuthReady, user } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-600 dark:text-gray-400">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function DashboardRedirect() {
  const { user } = useAuth();
  
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  
  return <UserDashboard />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RootLayout>
        <Landing />
      </RootLayout>
    )
  },
  {
    path: '/login',
    element: (
      <RootLayout>
        <Login />
      </RootLayout>
    )
  },
  {
    path: '/register',
    element: (
      <RootLayout>
        <Register />
      </RootLayout>
    )
  },
  {
    path: '/forgot-password',
    element: (
      <RootLayout>
        <ForgotPassword />
      </RootLayout>
    )
  },
  {
    path: '/dashboard',
    element: (
      <RootLayout>
        <ProtectedRoute>
          <DashboardRedirect />
        </ProtectedRoute>
      </RootLayout>
    )
  },
  {
    path: '/admin',
    element: (
      <RootLayout>
        <ProtectedRoute adminOnly>
          <AdminDashboard />
        </ProtectedRoute>
      </RootLayout>
    )
  },
  {
    path: '/blockchain',
    element: (
      <RootLayout>
        <BlockchainViewer />
      </RootLayout>
    )
  },
  {
    path: '/verify',
    element: (
      <RootLayout>
        <VerificationChecker />
      </RootLayout>
    )
  },
  {
    path: '/pan-verification',
    element: (
      <RootLayout>
        <PanCardVerification />
      </RootLayout>
    )
  },
  {
    path: '/activity',
    element: (
      <RootLayout>
        <ProtectedRoute>
          <ActivityLog />
        </ProtectedRoute>
      </RootLayout>
    )
  },
  {
    path: '*',
    element: (
      <RootLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">Page not found</p>
            <a
              href="/"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-block"
            >
              Go Home
            </a>
          </div>
        </div>
      </RootLayout>
    )
  }
]);
