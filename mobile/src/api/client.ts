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
    const res = await fetch(`${API_BASE}${path}`, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }

  async del<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }
}

export class ApiError extends Error {
  status: number;
  body: string;
  /** Parsed `detail` field from JSON body (FastAPI / custom handler) */
  detail: string | null;
  /** Parsed `error` code from JSON body (custom handler only, e.g. "validation_error") */
  errorCode: string | null;

  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
    // Try to parse structured JSON error body
    let detail: string | null = null;
    let errorCode: string | null = null;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.detail === 'string') detail = parsed.detail;
      if (typeof parsed.error === 'string') errorCode = parsed.error;
    } catch { /* raw text body — leave null */ }
    this.detail = detail;
    this.errorCode = errorCode;
  }
}

/**
 * Extracts a user-facing error message from any caught error.
 * Maps known API status codes to French messages.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401: return 'Email ou mot de passe incorrect';
      case 403: return 'Accès refusé';
      case 404: return 'Ressource introuvable';
      case 409: return 'Ce compte existe déjà';
      case 422: return err.detail ?? 'Données invalides';
      case 429: return 'Trop de tentatives. Réessaie dans quelques instants.';
      case 500: return 'Le serveur a rencontré un problème. Réessaie plus tard.';
      case 503: return 'Service temporairement indisponible';
      default: return err.detail ?? 'Erreur de connexion';
    }
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return 'La requête a expiré. Vérifie ta connexion.';
  }
  return 'Impossible de joindre le serveur. Vérifie ta connexion.';
}

export const api = new ApiClient();
