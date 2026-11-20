/**
 * OVIRA PLAY V5 Resilient API Client
 * Includes automatic retry with exponential backoff to absorb Render cold starts seamlessly.
 */

export interface ApiFetchOptions extends RequestInit {
  retries?: number;
  backoffMs?: number;
}

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ovira-api.onrender.com';

export async function fetchWithRetry<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { retries = 3, backoffMs = 1500, ...fetchOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${DEFAULT_API_URL}${endpoint}`;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      // Handle cold start 502/503/504 by retrying
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(1.5, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          data: null,
          error: json?.error?.message || `طلب غير ناجح (رمز الخطأ: ${response.status})`,
          status: response.status,
        };
      }

      return {
        data: json?.data ?? json,
        error: null,
        status: response.status,
      };
    } catch (err: any) {
      if (attempt < retries) {
        attempt++;
        const delay = backoffMs * Math.pow(1.5, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return {
        data: null,
        error: 'تعذر الاتصال بالخادم، جاري المحاولة تلقائياً...',
        status: 0,
      };
    }
  }

  return {
    data: null,
    error: 'تعذر إكمال الطلب بعد عدة محاولات',
    status: 500,
  };
}
