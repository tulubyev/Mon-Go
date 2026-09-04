const BASE_URL = 'https://mon-go.ru';

export interface POI {
  id: number;
  name: string;
  name_ru?: string;
  name_en?: string;
  name_zh?: string;
  name_mn?: string;
  lat: number;
  lng: number;
  category: 'sight' | 'food' | 'accommodation' | 'transport' | 'safety' | 'camp' | 'user'
    | 'museum' | 'restaurant' | 'cafe' | 'hotel' | 'market' | 'recreation';
  icon?: string;
  description?: string;
  phone?: string;
  url?: string;
  hours?: string;
  price?: string;
  stars?: number;
  booking_url?: string;
  ostrovok_url?: string;
  tripdotcom_url?: string;
  price_from?: number;
  price_currency?: string;
  cuisine?: string;
  price_range?: string;
  wifi?: boolean;
}

/** Row shape returned by GET /api/wiki/articles — flat per-locale columns. */
export interface WikiDbArticle {
  id: number;
  category: string;
  category_color?: string;
  icon?: string;
  title_ru: string;
  title_en?: string;
  title_zh?: string;
  title_mn?: string;
  summary_ru: string;
  summary_en?: string;
  summary_zh?: string;
  summary_mn?: string;
  image_url?: string;
  read_min?: number;
  created_at?: string;
}

export interface WikiSubmission {
  category: string;
  categoryColor?: string;
  icon?: string;
  titleRu: string;
  titleEn?: string;
  titleZh?: string;
  titleMn?: string;
  summaryRu: string;
  summaryEn?: string;
  summaryZh?: string;
  summaryMn?: string;
  imageUrl?: string;
  contact?: string;
}

export interface Partner {
  id: number;
  name: string;
  type?: string;
  phone?: string;
  email?: string;
  url?: string;
  telegram?: string;
  whatsapp?: string;
  description?: string;
  lat?: number;
  lng?: number;
  address?: string;
  subscription_tier?: string;
  verified?: boolean;
}

export interface ExchangeRate {
  id: number;
  source: string;
  currency_from: string;
  rate_buy?: number;
  rate_sell?: number;
  updated_at?: string;
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

  stt: (audioBase64: string, lang = 'mn', mime = 'audio/m4a') =>
    request<{ text: string }>('/api/stt', {
      method: 'POST',
      body: JSON.stringify({ audio: audioBase64, lang, mime }),
    }),

  ocr: (imageBase64: string, to = 'ru') =>
    request<{ original: string; translation: string }>('/api/ocr', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, to }),
    }),

  interpret: (text: string, context?: string) =>
    request<{
      translation: string;
      responses: Array<{ mn: string; ru: string }>;
    }>('/api/interpret', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    }),

  feedback: (messageId: string, rating: 'up' | 'down') =>
    request<{ success: boolean }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, rating }),
    }),

  getTransport: (type: 'flight' | 'train' | 'bus' | 'all' = 'all', lang = 'ru') =>
    request<TransportRoute[]>(`/api/transport?type=${type}&lang=${lang}`),

  getFlights: (direction: 'arrival' | 'departure') =>
    request<FlightInfo[]>(`/api/flights?direction=${direction}`),

  getWikiArticles: (category?: string) =>
    request<WikiDbArticle[]>(`/api/wiki/articles${category ? `?category=${encodeURIComponent(category)}` : ''}`),

  submitWikiArticle: (submission: WikiSubmission) =>
    request<{ success: boolean; id: number }>('/api/wiki/submissions', {
      method: 'POST',
      body: JSON.stringify(submission),
    }),

  getPartners: (type?: string, lang = 'ru') =>
    request<Partner[]>(`/api/partners?lang=${lang}${type ? `&type=${type}` : ''}`),

  getRates: (currency?: string) =>
    request<ExchangeRate[]>(`/api/rates${currency ? `?currency=${currency}` : ''}`),
};

export interface TransportRoute {
  id: number;
  type: 'flight' | 'train' | 'bus';
  origin: string;
  dest: string;
  operator?: string;
  phone?: string;
  url?: string;
  price_from?: number;
  price_currency?: string;
  notes?: string;
  schedules?: Array<{
    weekdays?: string;
    departs?: string;
    arrives?: string;
    duration_hours?: number;
    season?: string;
  }>;
}

export interface FlightInfo {
  flight_number: string;
  airline: string;
  origin: string;
  dest: string;
  scheduled: string;
  estimated?: string;
  status: string;
}
