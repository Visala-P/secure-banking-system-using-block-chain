export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

export const buildAuthHeaders = (
  token: string | null | undefined,
  headers: Record<string, string> = {}
): Record<string, string> => {
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
};

export const parseResponse = async <T>(response: Response): Promise<T> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: string }).message)
        : 'Request failed';
    throw new Error(message);
  }

  return payload as T;
};
