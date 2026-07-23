import { api } from './client';

export interface HealthModule {
  name: string;
  availability: string;
  [key: string]: unknown;
}

export interface TraceEntry {
  trace_id: string;
  total_duration_ms: number;
  span_count: number;
}

export interface TraceDetail {
  trace_id: string;
  total_duration_ms: number;
  spans: Record<string, unknown>[];
}

export interface AdminUser {
  user_id: string;
  email: string;
  role: string;
  display_name: string | null;
  status: string;
  locale: string;
  timezone: string;
  created_at: number;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  offset: number;
  limit: number;
}

export async function getHealth(): Promise<{ modules: Record<string, HealthModule> }> {
  return api.get('/admin/health');
}

export async function getMetrics(): Promise<Record<string, unknown>> {
  return api.get('/admin/metrics');
}

export async function getQuota(): Promise<Record<string, unknown>> {
  return api.get('/admin/quota');
}

export async function getTraces(limit: number = 20): Promise<TraceEntry[]> {
  return api.get<TraceEntry[]>(`/admin/traces?limit=${limit}`);
}

export async function getTraceDetail(traceId: string): Promise<TraceDetail> {
  return api.get<TraceDetail>(`/admin/trace/${traceId}`);
}

export async function getBottlenecks(): Promise<Record<string, unknown>[]> {
  return api.get<Record<string, unknown>[]>('/admin/bottlenecks');
}

export async function listUsers(offset: number = 0, limit: number = 50): Promise<UserListResponse> {
  return api.get<UserListResponse>(`/admin/users?offset=${offset}&limit=${limit}`);
}

export async function getUser(userId: string): Promise<AdminUser> {
  return api.get<AdminUser>(`/admin/users/${userId}`);
}

export async function updateUser(userId: string, fields: Partial<AdminUser>): Promise<AdminUser> {
  return api.patch<AdminUser>(`/admin/users/${userId}`, fields);
}
