const BASE_URL = 'https://mon-go.ru';

export interface POI {
  id: number;
  name: string;
  name_ru?: string;
  lat: number;
  lng: number;
  category: 'sight' | 'food' | 'accommodation' | 'transport' | 'safety' | 'camp' | 'user';
  icon?: string;
  description?: string;
  phone?: string;
  url?: string;
  hours?: string;
  price?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export const api = {
  getStats: () => request<{ totalQuestions: number }>('/api/stats'),

  ask: (message: string, userId: string, topic?: string) =>
    request<{ success: boolean; response: string; locations?: any[] }>('/api/mongolia/chat', {
      method: 'POST',
      body: JSON.stringify({ message, userId, topic }),
    }),

  translate: (text: string, from: string, to: string) =>
    request<{ translation: string }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, from, to }),
    }),

  tts: (text: string, lang = 'mn') =>
    `${BASE_URL}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`,

  getPOI: (category = 'all') =>
    request<POI[]>(`/api/poi?category=${category}`),

  interpret: (audioBase64: string) =>
    request<{
      original: string;
      translation: string;
      responses: Array<{ mn: string; ru: string }>;
    }>('/api/interpret', {
      method: 'POST',
      body: JSON.stringify({ audio: audioBase64 }),
    }),
};
