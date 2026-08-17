const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
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

/** Messages utilisateur lisibles par code d'erreur backend. */
const ERROR_MESSAGES: Record<string, string> = {
  'invalid credentials': 'Email ou mot de passe incorrect.',
  'account not found': 'Aucun compte trouvé avec cet email.',
  'email already registered': 'Un compte existe déjà avec cet email.',
  'too many attempts, try again later': 'Trop de tentatives. Réessaie dans quelques minutes.',
  'invalid or expired token': 'Ce lien a expiré ou est invalide.',
  'invalid refresh token': 'Ta session a expiré, reconnecte-toi.',
  'refresh token expired': 'Ta session a expiré, reconnecte-toi.',
  'auth not available': 'Service temporairement indisponible. Réessaie plus tard.',
};

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'Requête invalide. Vérifie les informations saisies.',
  401: 'Identifiants incorrects.',
  403: 'Accès refusé.',
  404: 'Ressource introuvable.',
  422: 'Données invalides. Vérifie les champs du formulaire.',
  429: 'Trop de requêtes. Réessaie dans quelques instants.',
  500: 'Erreur serveur. Réessaie plus tard.',
  503: 'Service temporairement indisponible.',
};

export class ApiError extends Error {
  status: number;
  body: string;
  detail: string;

  constructor(status: number, body: string) {
    // Extraire le champ "detail" du JSON si possible
    let detail = '';
    try {
      const parsed = JSON.parse(body);
      detail = typeof parsed.detail === 'string' ? parsed.detail : '';
    } catch {
      // body n'est pas du JSON
    }

    const friendly =
      (detail && ERROR_MESSAGES[detail]) ||
      STATUS_FALLBACKS[status] ||
      'Une erreur est survenue. Réessaie plus tard.';

    super(friendly);
    this.status = status;
    this.body = body;
    this.detail = detail;
  }
}

export const api = new ApiClient();
