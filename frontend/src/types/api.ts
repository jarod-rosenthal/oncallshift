// API Response Types matching backend

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  phoneNumber: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export interface Schedule {
  id: string;
  name: string;
  description: string | null;
  type: 'manual' | 'daily' | 'weekly';
  timezone: string;
  currentOncallUserId: string | null;
  isOverride: boolean;
  overrideUntil: string | null;
  rotationConfig: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  incidentNumber: number;
  summary: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  state: 'triggered' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  details: Record<string, any> | null;
  service: {
    id: string;
    name: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
  phoneNumber?: string;
}

export interface LoginResponse {
  message: string;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  message: string;
  user: User;
  organization: Organization;
}
