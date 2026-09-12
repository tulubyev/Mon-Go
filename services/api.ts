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
    | 'museum' | 'restaurant' | 'cafe' | 'hotel' | 'market' | 'recreation' | 'fuel';
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

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
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

  // Used by the welcome screen's reachability check — a plain fetch, not
  // routed through request()'s error-message-surfacing, since a health
  // check just needs ok/not-ok within a bounded time.
  getHealth: async (timeoutMs = 7000): Promise<{ status: string } | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },

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

  // Basic point-to-point routing (car, no turn-by-turn) — see TMB/route-routes.js.
  // Requires connectivity: this proxies to a self-hosted OSRM instance, unlike
  // the offline-capable map/POI browsing above.
  getRoute: (from: { lat: number; lng: number }, to: { lat: number; lng: number }) =>
    request<RouteResult>(`/api/route?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`),

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

  getSubscriptionPlans: () => request<SubscriptionPlan[]>('/api/subscriptions/plans'),

  createPayment: (tier: string) =>
    request<{ confirmationUrl: string; paymentId: string }>('/api/subscriptions/create-payment', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  getPaymentStatus: (paymentId: string) =>
    request<{ status: 'pending' | 'succeeded' | 'canceled' }>(`/api/subscriptions/payment-status/${encodeURIComponent(paymentId)}`),

  cancelSubscription: () =>
    request<{ success: boolean }>('/api/subscriptions/cancel', { method: 'POST' }),

  // ── Partner self-service ──────────────────────────────────────────────────
  partnerApply: (data: PartnerApplyInput) =>
    request<PartnerProfile>('/api/partner/apply', { method: 'POST', body: JSON.stringify(data) }),
  getPartnerMe: () => request<PartnerProfile | null>('/api/partner/me'),
  updatePartnerMe: (data: Partial<PartnerApplyInput>) =>
    request<PartnerProfile>('/api/partner/me', { method: 'PUT', body: JSON.stringify(data) }),

  getPartnerServices: () => request<PartnerService[]>('/api/partner/services'),
  createPartnerService: (data: PartnerServiceInput) =>
    request<PartnerService>('/api/partner/services', { method: 'POST', body: JSON.stringify(data) }),
  updatePartnerService: (id: number, data: Partial<PartnerServiceInput> & { active?: boolean }) =>
    request<PartnerService>(`/api/partner/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePartnerService: (id: number) =>
    request<{ ok: boolean }>(`/api/partner/services/${id}`, { method: 'DELETE' }),

  getPartnerOrders: (status?: string) =>
    request<Order[]>(`/api/partner/orders${status ? `?status=${status}` : ''}`),
  updatePartnerOrder: (id: number, data: { status?: OrderStatus; note?: string }) =>
    request<Order>(`/api/partner/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Customer orders + notifications ───────────────────────────────────────
  createOrder: (data: { partnerId: number; serviceId?: number; message?: string; customerName?: string; customerPhone?: string }) =>
    request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  getMyOrders: () => request<Order[]>('/api/orders/mine'),

  getNotifications: () => request<AppNotification[]>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  // ── Community media (Photos/Videos) ───────────────────────────────────────
  getMedia: (type?: MediaType, sort: MediaSort = 'recent', page = 1) =>
    request<MediaListResponse>(
      `/api/media?sort=${sort}&page=${page}${type ? `&type=${type}` : ''}`
    ),
  getMediaAwards: (type: MediaType = 'photo') =>
    request<{ awards: MediaAward[] }>(`/api/media/awards?type=${type}`),
  createMedia: (data: CreateMediaInput) =>
    request<{ post: MediaPost }>('/api/media', { method: 'POST', body: JSON.stringify(data) }),
  likeMedia: (id: number) =>
    request<{ liked: boolean }>(`/api/media/${id}/like`, { method: 'POST' }),
  rateMedia: (id: number, rating: number) =>
    request<{ avgRating: number | null; ratingCount: number }>(`/api/media/${id}/rate`, {
      method: 'POST', body: JSON.stringify({ rating }),
    }),
  deleteMedia: (id: number, reason: string) =>
    request<{ success: boolean }>(`/api/media/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  // ── Welcome screen video carousel ──────────────────────────────────────────
  getWelcomeVideos: () => request<{ videos: WelcomeVideo[] }>('/api/welcome-videos'),

  // ── Events + Calendar ──────────────────────────────────────────────────────
  getEvents: (params: { category?: string; from?: string; to?: string; q?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.q) qs.set('q', params.q);
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{ events: EventItem[] }>(`/api/events?${qs.toString()}`);
  },
  getEventCalendar: (year: number, month: number) =>
    request<{ events: EventItem[] }>(`/api/events/calendar?year=${year}&month=${month}`),
  getEvent: (id: number) => request<{ event: EventItem }>(`/api/events/${id}`),
  createEvent: (data: CreateEventInput) =>
    request<{ event: EventItem }>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  attendEvent: (id: number, status: AttendStatus) =>
    request<{ status: AttendStatus; attendeeCount: number }>(`/api/events/${id}/attend`, {
      method: 'POST', body: JSON.stringify({ status }),
    }),
  getEventReviews: (id: number) =>
    request<{ reviews: EventReview[]; reviewCount: number; avgRating: number | null }>(`/api/events/${id}/reviews`),
  addEventReview: (id: number, rating: number, reviewText?: string) =>
    request<{ review: EventReview }>(`/api/events/${id}/reviews`, {
      method: 'POST', body: JSON.stringify({ rating, reviewText }),
    }),
  deleteEvent: (id: number) => request<{ ok: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),
};

export type PartnerStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'new' | 'accepted' | 'declined' | 'completed' | 'cancelled';

export interface PartnerApplyInput {
  name: string;
  type?: string;
  phone?: string;
  email?: string;
  url?: string;
  telegram?: string;
  whatsapp?: string;
  description?: string;
  address?: string;
}

export interface PartnerProfile {
  id: number;
  name: string;
  type: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  telegram: string | null;
  whatsapp: string | null;
  description_ru: string | null;
  address: string | null;
  status: PartnerStatus;
  verified: boolean;
  active: boolean;
}

export interface PartnerServiceInput {
  title: string;
  description?: string;
  serviceType?: string;
  priceFrom?: number | null;
  priceCurrency?: string;
  duration?: string;
}

export interface PartnerService {
  id: number;
  partner_id: number;
  service_type: string | null;
  title_ru: string | null;
  description_ru: string | null;
  price_from: number | null;
  price_currency: string;
  duration: string | null;
  active: boolean;
}

export interface Order {
  id: number;
  user_id: number;
  partner_id: number;
  service_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  message: string | null;
  price: number | null;
  price_currency: string;
  status: OrderStatus;
  partner_note: string | null;
  created_at: string;
  updated_at: string;
  // only present on GET /api/orders/mine (joined)
  partner_name?: string;
  partner_phone?: string;
  service_title?: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  order_id: number | null;
  read: boolean;
  created_at: string;
}

export type MediaType = 'photo' | 'video';
export type MediaSort = 'recent' | 'popular' | 'top';

export interface MediaPost {
  id: number;
  user_id: number;
  type: MediaType;
  title: string;
  description: string | null;
  media_data: string | null;   // photo — base64 data URI
  media_url: string | null;    // video — external link (YouTube/VK/Rutube)
  thumbnail_data: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  like_count: number;
  avg_rating: number | null;
  rating_count: number;
  user_liked?: number;
  user_rating?: number | null;
}

export interface MediaListResponse {
  posts: MediaPost[];
  page: number;
  hasMore: boolean;
}

export interface WelcomeVideo {
  id: number;
  url: string;
  season: 'winter' | 'spring' | 'summer' | 'autumn' | 'any';
}

export interface MediaAward {
  id: number;
  post_id: number;
  place: number | null;
  period_type: string | null;
  period_value: string | null;
  award_title: string | null;
  prize_description: string | null;
  created_at: string;
  title: string;
  post_type: MediaType;
  media_data: string | null;
  media_url: string | null;
  thumbnail_data: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface CreateMediaInput {
  type: MediaType;
  title: string;
  description?: string;
  mediaData?: string;   // photo
  mediaUrl?: string;    // video
  thumbnailData?: string;
}

export type AttendStatus = 'interested' | 'going' | 'not_going';

export interface EventItem {
  id: number;
  title: string;
  description: string | null;
  category: string;
  emoji: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  external_url: string | null;
  is_featured: boolean;
  created_by: number | null;
  attendee_count: number;
}

export interface EventReview {
  id: number;
  event_id: number;
  user_id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  category?: string;
  start_date: string;   // ISO
  end_date?: string;
  location?: string;
  externalUrl?: string;
}

export interface SubscriptionPlan {
  id: 'basic' | 'premium' | 'b2b';
  nameRu: string;
  priceRub: number;
  features: string[];
}

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
