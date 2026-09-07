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

export interface AuthUser {
  id: number;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  preferredLanguage: string | null;
  subscriptionTier: string | null;
  subscriptionExpires: string | null;
}

// Set by AuthContext once a token is loaded/obtained — every request() call
// after that carries it, so screens never have to thread it through by hand.
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  /** Full parsed error body — screens can read fields beyond `message` (e.g. login's requiresVerification/email). */
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  });
  // Auth routes return { message } on errors — surface it instead of a bare
  // status code so login/register screens can show the real reason.
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.message || `API error ${response.status}`, data);
  }
  return data as T;
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

  register: (data: { email: string; password: string; firstName: string; lastName?: string; phone?: string }) =>
    request<{ email: string; requiresVerification: boolean }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => request<AuthUser>('/api/auth/me'),

  // type 'email' is public (registration/login flow). type 'phone' requires
  // an authenticated request (Bearer token attached automatically once
  // setAuthToken has been called) — phone verification is a profile action,
  // not part of signing in.
  sendCode: (identifier: string, type: 'email' | 'phone' = 'email') =>
    request<{ success: boolean }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ identifier, type }),
    }),

  verifyCode: (identifier: string, code: string, type: 'email' | 'phone' = 'email') =>
    request<{ success: boolean; token: string | null; user: AuthUser | null }>('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, type }),
    }),

  updateAvatar: (photoData: string) =>
    request<{ success: boolean }>('/api/auth/avatar', {
      method: 'PUT',
      body: JSON.stringify({ photoData }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  updateProfile: (data: { firstName?: string; lastName?: string; nickname?: string; preferredLanguage?: string }) =>
    request<AuthUser>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
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
