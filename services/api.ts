const BASE_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://mon-go.ru';

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

  ask: (question: string, userId: string) =>
    request<{ answer: string; cached: boolean }>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, userId }),
    }),

  translate: (text: string, from: string, to: string) =>
    request<{ translation: string }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, from, to }),
    }),

  tts: (text: string, lang = 'mn') =>
    `${BASE_URL}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`,

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
