export interface Block {
  blockNumber: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  data: {
    userId: string;
    action: string;
    status: string;
    verifiedBy?: string;
  };
  nonce: number;
}

export interface VerificationRecord {
  id: string;
  userId: string;
  userName: string;
  action: string;
  status: 'verified' | 'pending' | 'rejected';
  timestamp: string;
  verifiedBy?: string;
  blockNumber?: number;
  documentType?: string;
  notes?: string;
  autoVerified?: boolean;
  confidence?: number;
  verificationMethod?: 'automated' | 'manual';
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  accountNumber: string;
  kycStatus: 'verified' | 'pending' | 'rejected';
  verificationCount: number;
  lastActivity: string;
  joinedDate: string;
  phone?: string;
  address?: string;
}

// Generate blockchain data
export const blockchainData: Block[] = [
  {
    blockNumber: 0,
    hash: '0000000000000000000000000000000000000000000000000000000000000000',
    previousHash: '0',
    timestamp: '2024-01-01T00:00:00Z',
    data: {
      userId: 'GENESIS',
      action: 'Genesis Block',
      status: 'initialized'
    },
    nonce: 0
  },
  {
    blockNumber: 1,
    hash: '00000a8f9e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8',
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: '2024-01-15T10:30:00Z',
    data: {
      userId: 'USR001',
      action: 'KYC Verification',
      status: 'verified',
      verifiedBy: 'ADM001'
    },
    nonce: 45823
  },
  {
    blockNumber: 2,
    hash: '00000b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    previousHash: '00000a8f9e2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8',
    timestamp: '2024-02-10T14:20:00Z',
    data: {
      userId: 'USR003',
      action: 'Account Verification',
      status: 'verified',
      verifiedBy: 'ADM001'
    },
    nonce: 67234
  },
  {
    blockNumber: 3,
    hash: '00000c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a',
    previousHash: '00000b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    timestamp: '2024-02-25T09:15:00Z',
    data: {
      userId: 'USR004',
      action: 'Document Verification',
      status: 'rejected',
      verifiedBy: 'ADM002'
    },
    nonce: 89456
  },
  {
    blockNumber: 4,
    hash: '00000d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    previousHash: '00000c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a',
    timestamp: '2024-03-20T16:45:00Z',
    data: {
      userId: 'USR002',
      action: 'Identity Verification',
      status: 'pending',
      verifiedBy: 'ADM001'
    },
    nonce: 12389
  },
  {
    blockNumber: 5,
    hash: '00000e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    previousHash: '00000d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    timestamp: '2024-03-28T11:30:00Z',
    data: {
      userId: 'USR005',
      action: 'Address Verification',
      status: 'verified',
      verifiedBy: 'ADM001'
    },
    nonce: 34567
  },
  {
    blockNumber: 6,
    hash: '00000f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    previousHash: '00000e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c',
    timestamp: '2024-03-30T09:15:00Z',
    data: {
      userId: 'USR003',
      action: 'Aadhaar Verification',
      status: 'verified',
      verifiedBy: 'ADM001'
    },
    nonce: 56789
  },
  {
    blockNumber: 7,
    hash: '00000g8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
    previousHash: '00000f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d',
    timestamp: '2024-03-31T14:22:00Z',
    data: {
      userId: 'USR001',
      action: 'PAN Verification',
      status: 'verified',
      verifiedBy: 'ADM001'
    },
    nonce: 67890
  }
];

export const verificationRecords: VerificationRecord[] = [
  {
    id: 'VER001',
    userId: 'USR001',
    userName: 'John Doe',
    action: 'KYC Verification',
    status: 'verified',
    timestamp: '2024-01-15T10:30:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 1,
    documentType: 'Passport',
    notes: 'All documents verified successfully',
    autoVerified: true,
    confidence: 94.5,
    verificationMethod: 'automated'
  },
  {
    id: 'VER002',
    userId: 'USR003',
    userName: 'Alice Johnson',
    action: 'Account Verification',
    status: 'verified',
    timestamp: '2024-02-10T14:20:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 2,
    documentType: 'Driver License',
    notes: 'Identity confirmed via OCR',
    autoVerified: true,
    confidence: 91.2,
    verificationMethod: 'automated'
  },
  {
    id: 'VER003',
    userId: 'USR004',
    userName: 'Bob Wilson',
    action: 'Document Verification',
    status: 'rejected',
    timestamp: '2024-02-25T09:15:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 3,
    documentType: 'Utility Bill',
    notes: 'Document quality insufficient - Auto-rejected',
    autoVerified: true,
    confidence: 45.8,
    verificationMethod: 'automated'
  },
  {
    id: 'VER004',
    userId: 'USR002',
    userName: 'Jane Smith',
    action: 'Identity Verification',
    status: 'verified',
    timestamp: '2024-03-20T16:45:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 4,
    documentType: 'National ID',
    notes: 'Document validation passed all checks',
    autoVerified: true,
    confidence: 87.3,
    verificationMethod: 'automated'
  },
  {
    id: 'VER005',
    userId: 'USR005',
    userName: 'Charlie Brown',
    action: 'Address Verification',
    status: 'verified',
    timestamp: '2024-03-28T11:30:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 5,
    documentType: 'Bank Statement',
    notes: 'Address confirmed automatically',
    autoVerified: true,
    confidence: 88.9,
    verificationMethod: 'automated'
  },
  {
    id: 'VER006',
    userId: 'USR003',
    userName: 'Alice Johnson',
    action: 'Aadhaar Verification',
    status: 'verified',
    timestamp: '2024-03-30T09:15:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 6,
    documentType: 'Aadhaar',
    notes: 'OCR extracted all details successfully',
    autoVerified: true,
    confidence: 92.7,
    verificationMethod: 'automated'
  },
  {
    id: 'VER007',
    userId: 'USR001',
    userName: 'John Doe',
    action: 'PAN Verification',
    status: 'verified',
    timestamp: '2024-03-31T14:22:00Z',
    verifiedBy: 'AI Verification Engine',
    blockNumber: 7,
    documentType: 'PAN',
    notes: 'PAN format validated and verified',
    autoVerified: true,
    confidence: 96.1,
    verificationMethod: 'automated'
  }
];

export const usersData: UserData[] = [
  {
    id: 'USR001',
    name: 'John Doe',
    email: 'user@bank.com',
    accountNumber: '1234567890',
    kycStatus: 'verified',
    verificationCount: 3,
    lastActivity: '2024-03-30T14:20:00Z',
    joinedDate: '2024-01-15',
    phone: '+1 234 567 8900',
    address: '123 Main St, New York, NY 10001'
  },
  {
    id: 'USR002',
    name: 'Jane Smith',
    email: 'jane@example.com',
    accountNumber: '5555666677',
    kycStatus: 'pending',
    verificationCount: 1,
    lastActivity: '2024-03-28T09:10:00Z',
    joinedDate: '2024-03-20',
    phone: '+1 555 666 7777',
    address: '789 User Blvd, Boston, MA 02101'
  },
  {
    id: 'USR003',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    accountNumber: '9988776655',
    kycStatus: 'verified',
    verificationCount: 2,
    lastActivity: '2024-03-29T16:30:00Z',
    joinedDate: '2024-02-01',
    phone: '+1 999 888 7766',
    address: '456 Oak Ave, Chicago, IL 60601'
  },
  {
    id: 'USR004',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    accountNumber: '1122334455',
    kycStatus: 'rejected',
    verificationCount: 1,
    lastActivity: '2024-02-25T09:15:00Z',
    joinedDate: '2024-02-20',
    phone: '+1 112 233 4455',
    address: '321 Pine St, Los Angeles, CA 90001'
  },
  {
    id: 'USR005',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    accountNumber: '6677889900',
    kycStatus: 'verified',
    verificationCount: 2,
    lastActivity: '2024-03-28T11:30:00Z',
    joinedDate: '2024-03-01',
    phone: '+1 667 788 9900',
    address: '654 Elm Dr, Miami, FL 33101'
  }
];