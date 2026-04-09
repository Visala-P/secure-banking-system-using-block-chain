import React, { createContext, useContext, useEffect, useState } from 'react';

import { API_BASE_URL, parseResponse } from '../lib/api';

export type UserRole = 'user' | 'admin' | null;

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  verified: boolean;
  kycStatus: 'verified' | 'pending' | 'rejected';
  accountNumber?: string;
  phone?: string;
  address?: string;
  joinedDate: string;
  qrCodePayload?: string;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'AUDITOR';
  kycStatus: 'verified' | 'pending' | 'rejected';
  accountNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  joinedDate?: string | null;
  createdAt?: string;
  qrCodePayload?: string;
}

interface AuthApiResponse {
  user: ApiUser;
  token: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadStoredUser = (): User | null => {
  const storedUser = localStorage.getItem('bankUser');
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem('bankUser');
    return null;
  }
};

const loadStoredToken = (): string | null => localStorage.getItem('bankToken');

const normalizeUser = (apiUser: ApiUser): User => {
  const joinedDateSource = apiUser.joinedDate ?? apiUser.createdAt ?? new Date().toISOString();
  const joinedDate = (() => {
    const parsed = new Date(joinedDateSource);
    return Number.isNaN(parsed.getTime()) ? joinedDateSource.slice(0, 10) : parsed.toISOString().split('T')[0];
  })();

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role === 'ADMIN' ? 'admin' : 'user',
    verified: apiUser.kycStatus === 'verified',
    kycStatus: apiUser.kycStatus,
    accountNumber: apiUser.accountNumber ?? undefined,
    phone: apiUser.phone ?? undefined,
    address: apiUser.address ?? undefined,
    joinedDate,
    qrCodePayload: apiUser.qrCodePayload ?? undefined
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [token, setToken] = useState<string | null>(() => loadStoredToken());
  const [isAuthReady, setIsAuthReady] = useState(false);

  const persistSession = (auth: AuthApiResponse) => {
    const normalized = normalizeUser(auth.user);
    setUser(normalized);
    localStorage.setItem('bankUser', JSON.stringify(normalized));
    localStorage.setItem('bankToken', auth.token);
    setToken(auth.token);
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('bankUser');
    localStorage.removeItem('bankToken');
  };

  const refreshProfile = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const profile = await parseResponse<ApiUser>(response);
    const normalized = normalizeUser(profile);
    setUser(normalized);
    localStorage.setItem('bankUser', JSON.stringify(normalized));
  };

  useEffect(() => {
    const initializeSession = async () => {
      const storedToken = loadStoredToken();

      if (storedToken) {
        setToken(storedToken);

        try {
          await refreshProfile(storedToken);
        } catch {
          clearSession();
        }
      }

      setIsAuthReady(true);
    };

    void initializeSession();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await parseResponse<AuthApiResponse>(response);
    persistSession(data);
    return true;
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });

    await parseResponse<AuthApiResponse>(response);
    return true;
  };

  const logout = () => {
    clearSession();
  };

  const updateProfile = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('bankUser', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthReady,
        login,
        register,
        logout,
        updateProfile,
        token
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
