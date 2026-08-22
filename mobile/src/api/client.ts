// API base URL — set via EXPO_PUBLIC_API_URL in .env
// Production: https://oria.wezon.fr
// Local dev: http://192.168.1.x:8000 (LAN IP) or http://10.0.2.2:8000 (Android emulator)
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers() });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async del<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }
}

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

export const api = new ApiClient();
