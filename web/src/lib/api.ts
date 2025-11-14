const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (token) {
    init.headers = {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await response.json();

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export { API_BASE_URL };

