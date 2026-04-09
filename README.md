# SecureBank - Blockchain-Based Online Banking System

A comprehensive online banking system frontend with blockchain-based verification, built with React, TypeScript, and Tailwind CSS.

## 🚀 Features

### 🏠 Landing Page
- Beautiful hero section with features overview
- Quick start guide with demo credentials
- Responsive design with dark mode support

### 🔐 Authentication
- **Login Page** - Secure user authentication
- **Register Page** - New user registration
- **Forgot Password** - Password recovery flow
- Demo accounts for testing:
  - User: `user@bank.com` / `password`
  - Admin: `admin@bank.com` / `password`

### 👤 User Dashboard
- Profile overview with verification status
- Digital identity card with QR code
- Verification history table
- PDF report download
- Real-time statistics

### 🏦 Bank/Admin Dashboard
- View all users with search and filters
- Approve/reject verification requests
- Add new verification blocks
- User management interface
- Real-time pending reviews

### 📜 Blockchain Viewer
- Visual blockchain explorer
- Block details with hash, timestamp, and data
- Timeline view with charts
- Search functionality
- Chain integrity verification

### 🔍 Verification Checker
- Instant user verification lookup
- User ID search with autocomplete
- Verification history display
- Status indicators (✅ Verified, ⏳ Pending, ❌ Rejected)

### 📊 Activity/Audit Log
- Complete verification history
- Timestamp-based tracking
- Advanced filters (status, date range, search)
- Export to CSV
- Blockchain reference numbers

## 🎨 UI/UX Features

### Core Features
- **Dark/Light Mode** - System-wide theme switching
- **Real-time Updates** - Live status changes
- **Responsive Design** - Mobile, tablet, and desktop support
- **Role-Based Access** - Different views for users and admins
- **Loading Animations** - Smooth transitions with Motion

### Visual Components
- Status badges (Verified, Pending, Rejected)
- Blockchain cards with visual chain connections
- Interactive charts (Recharts)
- Toast notifications (Sonner)
- Gradient backgrounds
- Glass-morphism effects

### Smart Features
- **QR Code Generation** - Digital identity cards
- **PDF Reports** - Downloadable verification reports
- **CSV Export** - Activity log exports
- **Search & Filter** - Advanced data filtering
- **Auto-complete** - User ID suggestions

## 📁 Project Structure

```
/src/app
├── components/
│   ├── Navbar.tsx              # Main navigation
│   ├── BlockchainCard.tsx      # Blockchain block display
│   ├── StatusBadge.tsx         # Status indicator component
│   └── QuickStartGuide.tsx     # Help overlay
├── pages/
│   ├── Landing.tsx             # Landing page
│   ├── Login.tsx               # Login page
│   ├── Register.tsx            # Registration page
│   ├── ForgotPassword.tsx      # Password recovery
│   ├── UserDashboard.tsx       # User dashboard
│   ├── AdminDashboard.tsx      # Admin dashboard
│   ├── BlockchainViewer.tsx    # Blockchain explorer
│   ├── VerificationChecker.tsx # Verification lookup
│   └── ActivityLog.tsx         # Audit log
├── context/
│   ├── AuthContext.tsx         # Authentication state
│   └── ThemeContext.tsx        # Theme state
├── data/
│   └── mockData.ts             # Mock blockchain & user data
├── routes.tsx                  # React Router configuration
└── App.tsx                     # Main app component
```

## 🛠️ Technologies Used

- **React** - UI framework
- **TypeScript** - Type safety
- **React Router** - Navigation
- **Tailwind CSS v4** - Styling
- **Motion (Framer Motion)** - Animations
- **Recharts** - Data visualization
- **Sonner** - Toast notifications
- **jsPDF** - PDF generation
- **QRCode** - QR code generation
- **Lucide React** - Icons

## 🎯 Key Pages & Routes

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing Page | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/forgot-password` | Password Recovery | Public |
| `/dashboard` | User Dashboard | Protected |
| `/admin` | Admin Dashboard | Admin Only |
| `/blockchain` | Blockchain Viewer | Public |
| `/verify` | Verification Checker | Public |
| `/activity` | Activity Log | Protected |

## 🔒 Security Features

- Password masking in forms
- Role-based access control
- Session management with localStorage
- Protected routes with authentication guards
- Secure blockchain hash generation
- Audit trail for all actions

## 📊 Mock Data

The application includes comprehensive mock data:
- 6 blockchain blocks with full transaction history
- 5 verification records with different statuses
- 5 user accounts (including demo accounts)
- Real-time timestamp tracking
- Blockchain hash chains

## 🎨 Design System

### Colors
- Primary: Blue (#3B82F6)
- Secondary: Purple (#9333EA)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Error: Red (#EF4444)

### Status Indicators
- ✅ **Verified** - Green
- ⏳ **Pending** - Yellow
- ❌ **Rejected** - Red

## 🚦 Getting Started

### Demo Credentials

**User Account:**
- Email: `user@bank.com`
- Password: `password`

**Admin Account:**
- Email: `admin@bank.com`
- Password: `password`

### Test User IDs
Try these User IDs in the Verification Checker:
- `USR001` - Verified user
- `USR002` - Pending verification
- `USR003` - Verified user
- `USR004` - Rejected user

## 📱 Responsive Design

The application is fully responsive with breakpoints:
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## ✨ Future Enhancements

- Real Supabase backend integration
- Live WebSocket updates
- Multi-factor authentication (2FA)
- Biometric verification
- Advanced fraud detection
- Email/SMS notifications
- Multi-language support
- Wallet integration

## 🧰 Backend API

This repo now ships with a production-ready Node/Express backend inside [`server`](server/README.md).

### Quick start

1. `cd server && npm install`
2. Copy `.env.example` → `.env` and point `DATABASE_URL` to your `online_banking_system` PostgreSQL database (created via pgAdmin).
3. `npx prisma migrate dev --name init` to sync the schema.
4. `npm run dev` to boot the API at `http://localhost:4000` (configurable via `PORT`).

### Available endpoints

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/dashboard/summary` for admin dashboards
- `GET/POST /api/verification`, `GET /api/verification/user/:userId`
- `GET /api/blockchain/chain`, `GET /api/blockchain/validate` for the viewer
- `POST /api/documents/upload` (`multipart/form-data`) plus admin review routes
- `GET /api/users` and `PATCH /api/users/:id/status` for KYC workflows

Wire the React app’s contexts/services to these endpoints to replace `mockData.ts` and the simulated `verificationEngine.ts` logic with live blockchain-backed records.

## 📄 License

This is a demo project for educational purposes.

---

Built with ❤️ using React, TypeScript, and Tailwind CSS
