import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView, RefreshControl,
  ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api, TransportRoute, FlightInfo } from '@/services/api';
import { readingContainerStyle } from '@/constants/Layout';

type Tab = 'airport' | 'trains' | 'buses';
type FlightDir = 'arrival' | 'departure';

// Static fallback data shown when DB is empty
const STATIC_FLIGHTS: Record<FlightDir, FlightInfo[]> = {
  departure: [
    { flight_number: 'OM201', airline: 'MIAT', origin: 'ULN', dest: 'SVO', scheduled: '10:30', status: 'scheduled' },
    { flight_number: 'OM203', airline: 'MIAT', origin: 'ULN', dest: 'PEK', scheduled: '09:00', status: 'scheduled' },
    { flight_number: 'OM207', airline: 'MIAT', origin: 'ULN', dest: 'ICN', scheduled: '14:15', status: 'scheduled' },
    { flight_number: 'OM209', airline: 'MIAT', origin: 'ULN', dest: 'NRT', scheduled: '11:45', status: 'scheduled' },
    { flight_number: 'CA921', airline: 'Air China', origin: 'ULN', dest: 'PEK', scheduled: '08:00', status: 'scheduled' },
    { flight_number: 'KE868', airline: 'Korean Air', origin: 'ULN', dest: 'ICN', scheduled: '16:30', status: 'scheduled' },
    { flight_number: 'TK486', airline: 'Turkish Airlines', origin: 'ULN', dest: 'IST', scheduled: '22:10', status: 'seasonal' },
    { flight_number: 'HU7807', airline: 'Hainan Airlines', origin: 'ULN', dest: 'PEK', scheduled: '20:00', status: 'seasonal' },
  ],
  arrival: [
    { flight_number: 'OM202', airline: 'MIAT', origin: 'SVO', dest: 'ULN', scheduled: '19:15', status: 'scheduled' },
    { flight_number: 'OM204', airline: 'MIAT', origin: 'PEK', dest: 'ULN', scheduled: '13:30', status: 'scheduled' },
    { flight_number: 'OM208', airline: 'MIAT', origin: 'ICN', dest: 'ULN', scheduled: '10:00', status: 'scheduled' },
    { flight_number: 'OM210', airline: 'MIAT', origin: 'NRT', dest: 'ULN', scheduled: '09:20', status: 'scheduled' },
    { flight_number: 'CA922', airline: 'Air China', origin: 'PEK', dest: 'ULN', scheduled: '12:00', status: 'scheduled' },
    { flight_number: 'KE867', airline: 'Korean Air', origin: 'ICN', dest: 'ULN', scheduled: '08:15', status: 'scheduled' },
    { flight_number: 'TK487', airline: 'Turkish Airlines', origin: 'IST', dest: 'ULN', scheduled: '17:50', status: 'seasonal' },
  ],
};

const STATIC_TRAINS: TransportRoute[] = [
  {
    id: -1, type: 'train', origin: 'Москва (Ярославский)', dest: 'Улан-Батор',
    operator: 'РЖД / УБТЗ', url: 'rzd.ru',
    price_from: 15000, price_currency: 'RUB',
    notes: 'Поезд №6 · 4 суток · через Иркутск',
    schedules: [{ weekdays: 'Sat', departs: '23:55', duration_hours: 94 }],
  },
  {
    id: -2, type: 'train', origin: 'Улан-Батор', dest: 'Москва (Ярославский)',
    operator: 'УБТЗ / РЖД', url: 'rzd.ru',
    price_from: 12000, price_currency: 'RUB',
    notes: 'Поезд №5 · 4 суток · через Иркутск',
    schedules: [{ weekdays: 'Wed', departs: '07:45', duration_hours: 94 }],
  },
  {
    id: -3, type: 'train', origin: 'Улан-Батор', dest: 'Пекин',
    operator: 'УБТЗ / CR', url: 'mta.mn',
    price_from: 8000, price_currency: 'CNY',
    notes: 'Поезд №4 / K3 · 30 ч · через Замын-Ууд',
    schedules: [{ weekdays: 'Sat', departs: '07:40', duration_hours: 30 }],
  },
  {
    id: -4, type: 'train', origin: 'Улан-Батор', dest: 'Сухэ-Батор (граница РФ)',
    operator: 'УБТЗ', url: 'mta.mn',
    price_from: 4500, price_currency: 'MNT',
    notes: 'Пригородный · 4 ч',
    schedules: [{ weekdays: 'daily', departs: '08:00', duration_hours: 4 }],
  },
];

const STATIC_BUSES: TransportRoute[] = [
  {
    id: -10, type: 'bus', origin: 'Улан-Батор', dest: 'Улан-Удэ (Россия)',
    operator: 'Автовокзал Дракон', phone: '+976 11 263399',
    price_from: 35000, price_currency: 'MNT',
    notes: 'Через КПП Кяхта–Алтанбулаг · ~12 ч',
    schedules: [{ weekdays: 'daily', departs: '08:00', duration_hours: 12 }],
  },
  {
    id: -11, type: 'bus', origin: 'Улан-Батор', dest: 'Иркутск (Россия)',
    operator: 'Автовокзал Дракон',
    price_from: 55000, price_currency: 'MNT',
    notes: 'Через Кяхту · ~14–16 ч',
    schedules: [{ weekdays: 'Mon,Wed,Fri', departs: '08:00', duration_hours: 15 }],
  },
  {
    id: -12, type: 'bus', origin: 'Улан-Батор', dest: 'Эрлянь (Китай)',
    operator: 'Автовокзал Дракон',
    price_from: 30000, price_currency: 'MNT',
    notes: 'Через КПП Замын-Ууд · ~5–6 ч',
    schedules: [{ weekdays: 'daily', departs: '07:30', duration_hours: 6 }],
  },
  {
    id: -13, type: 'bus', origin: 'Улан-Батор', dest: 'Дархан',
    operator: 'Автовокзал Байангол', phone: '+976 11 360599',
    price_from: 8000, price_currency: 'MNT',
    notes: '~3 ч · несколько рейсов в день',
    schedules: [{ weekdays: 'daily', departs: '08:00', duration_hours: 3 }],
  },
  {
    id: -14, type: 'bus', origin: 'Улан-Батор', dest: 'Эрдэнэт',
    operator: 'Автовокзал Байангол',
    price_from: 12000, price_currency: 'MNT',
    notes: '~6 ч',
    schedules: [{ weekdays: 'daily', departs: '08:00', duration_hours: 6 }],
  },
  {
    id: -15, type: 'bus', origin: 'Улан-Батор', dest: 'Хархорин (Каракорум)',
    operator: 'Автовокзал Дракон',
    price_from: 15000, price_currency: 'MNT',
    notes: '~6 ч',
    schedules: [{ weekdays: 'daily', departs: '08:00', duration_hours: 6 }],
  },
  {
    id: -16, type: 'bus', origin: 'Улан-Батор', dest: 'Сайншанд (Гоби)',
    operator: 'Автовокзал Дракон',
    price_from: 18000, price_currency: 'MNT',
    notes: '~5–6 ч · восток страны',
    schedules: [{ weekdays: 'Mon,Thu', departs: '09:00', duration_hours: 6 }],
  },
  {
    id: -17, type: 'bus', origin: 'Улан-Батор', dest: 'Мурэн (Хубсугул)',
    operator: 'Автовокзал Дракон',
    price_from: 35000, price_currency: 'MNT',
    notes: '~12 ч · север Монголии',
    schedules: [{ weekdays: 'Tue,Fri', departs: '08:00', duration_hours: 12 }],
  },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  departed: '#22c55e',
  arrived: '#22c55e',
  delayed: '#f59e0b',
  cancelled: '#ef4444',
  seasonal: '#8b5cf6',
};

export default function TransportScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>('airport');
  const [flightDir, setFlightDir] = useState<FlightDir>('departure');
  const [flights, setFlights] = useState<FlightInfo[]>([]);
  const [trains, setTrains] = useState<TransportRoute[]>([]);
  const [buses, setBuses] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [flightsFromApi, setFlightsFromApi] = useState(false);

  const loadFlights = useCallback(async (dir: FlightDir) => {
    setLoading(true);
    try {
      const data = await api.getFlights(dir);
      if (data && data.length > 0) {
        setFlights(data);
        setFlightsFromApi(true);
      } else {
        setFlights(STATIC_FLIGHTS[dir]);
        setFlightsFromApi(false);
      }
    } catch {
      setFlights(STATIC_FLIGHTS[dir]);
      setFlightsFromApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoutes = useCallback(async (type: 'train' | 'bus') => {
    setLoading(true);
    try {
      const data = await api.getTransport(type, i18n.language);
      if (type === 'train') setTrains(data.length > 0 ? data : STATIC_TRAINS);
      else setBuses(data.length > 0 ? data : STATIC_BUSES);
    } catch {
      if (type === 'train') setTrains(STATIC_TRAINS);
      else setBuses(STATIC_BUSES);
    } finally {
      setLoading(false);
    }
  }, [i18n.language]);

  useEffect(() => {
    if (tab === 'airport') {
      loadFlights(flightDir);
    } else if (tab === 'trains' && trains.length === 0) {
      loadRoutes('train');
    } else if (tab === 'buses' && buses.length === 0) {
      loadRoutes('bus');
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'airport') loadFlights(flightDir);
  }, [flightDir]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'airport') await loadFlights(flightDir);
    else if (tab === 'trains') await loadRoutes('train');
    else await loadRoutes('bus');
    setRefreshing(false);
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'airport', label: t('transport.airport'), icon: '✈️' },
    { key: 'trains', label: t('transport.trains'), icon: '🚂' },
    { key: 'buses', label: t('transport.buses'), icon: '🚌' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('common.back')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🛣️ {t('transport.title')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map(({ key, label, icon }) => (
          <Pressable
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)}
          >
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabBtnText, tab === key && styles.tabBtnTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'airport' && (
        <View style={styles.dirBar}>
          {(['departure', 'arrival'] as FlightDir[]).map(d => (
            <Pressable
              key={d}
              style={[styles.dirBtn, flightDir === d && styles.dirBtnActive]}
              onPress={() => setFlightDir(d)}
            >
              <Text style={[styles.dirBtnText, flightDir === d && styles.dirBtnTextActive]}>
                {d === 'departure' ? `↑ ${t('transport.departures')}` : `↓ ${t('transport.arrivals')}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.spinner} />
        ) : tab === 'airport' ? (
          <AirportContent flights={flights} fromApi={flightsFromApi} t={t} />
        ) : tab === 'trains' ? (
          <RouteList routes={trains} t={t} />
        ) : (
          <RouteList routes={buses} t={t} />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AirportContent({ flights, fromApi, t }: { flights: FlightInfo[]; fromApi: boolean; t: (k: string) => string }) {
  return (
    <View>
      <View style={styles.airportHeader}>
        <Text style={styles.airportTitle}>{t('transport.airportSubtitle')}</Text>
        {!fromApi && (
          <View style={styles.staticBadge}>
            <Text style={styles.staticBadgeText}>📅 {t('transport.schedule')}</Text>
          </View>
        )}
      </View>
      {flights.map((f, i) => (
        <FlightCard key={i} flight={f} />
      ))}
      <View style={styles.noteBox}>
        <Text style={styles.noteText}>ℹ️ {t('transport.staticNote')}</Text>
      </View>
    </View>
  );
}

function FlightCard({ flight }: { flight: FlightInfo }) {
  const statusColor = STATUS_COLORS[flight.status] || '#888';
  return (
    <View style={styles.flightCard}>
      <View style={styles.flightLeft}>
        <Text style={styles.flightNumber}>{flight.flight_number}</Text>
        <Text style={styles.flightAirline}>{flight.airline}</Text>
      </View>
      <View style={styles.flightRoute}>
        <Text style={styles.flightCity}>{flight.origin}</Text>
        <Text style={styles.flightArrow}>→</Text>
        <Text style={styles.flightCity}>{flight.dest}</Text>
      </View>
      <View style={styles.flightRight}>
        <Text style={styles.flightTime}>{flight.scheduled}</Text>
        {flight.estimated && flight.estimated !== flight.scheduled && (
          <Text style={styles.flightEstimated}>{flight.estimated}</Text>
        )}
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>
    </View>
  );
}

function RouteList({ routes, t }: { routes: TransportRoute[]; t: (k: string) => string }) {
  if (routes.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>{t('transport.noData')}</Text>
      </View>
    );
  }
  return (
    <View>
      {routes.map((route, i) => <RouteCard key={route.id ?? i} route={route} t={t} />)}
      <View style={styles.noteBox}>
        <Text style={styles.noteText}>ℹ️ {t('transport.staticNote')}</Text>
      </View>
    </View>
  );
}

function RouteCard({ route, t }: { route: TransportRoute; t: (k: string) => string }) {
  const schedule = route.schedules?.[0];
  const priceStr = route.price_from
    ? `${t('transport.from')} ${route.price_from.toLocaleString()} ${route.price_currency || ''}`
    : '';

  const weekdayLabel = (wd?: string) => {
    if (!wd) return '';
    if (wd === 'daily') return t('transport.daily');
    if (wd === 'Mon,Wed,Fri' || wd === 'Tue,Fri' || wd === 'Mon,Thu') return t('transport.weekly');
    return wd;
  };

  return (
    <View style={styles.routeCard}>
      <View style={styles.routeTop}>
        <View style={styles.routeRoute}>
          <Text style={styles.routeCity}>{route.origin}</Text>
          <Text style={styles.routeArrow}>→</Text>
          <Text style={styles.routeCity}>{route.dest}</Text>
        </View>
        {priceStr ? <Text style={styles.routePrice}>{priceStr}</Text> : null}
      </View>

      {route.operator && (
        <Text style={styles.routeOperator}>{route.operator}</Text>
      )}

      {route.notes ? (
        <Text style={styles.routeNotes}>{route.notes}</Text>
      ) : null}

      {schedule && (
        <View style={styles.routeSchedule}>
          {schedule.departs && (
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>{t('transport.departures')}</Text>
              <Text style={styles.scheduleValue}>{schedule.departs}</Text>
            </View>
          )}
          {schedule.duration_hours && (
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>{t('transport.duration')}</Text>
              <Text style={styles.scheduleValue}>
                {schedule.duration_hours >= 24
                  ? `${Math.floor(schedule.duration_hours / 24)}д ${schedule.duration_hours % 24}ч`
                  : `${schedule.duration_hours}ч`}
              </Text>
            </View>
          )}
          {schedule.weekdays && (
            <View style={styles.scheduleItem}>
              <Text style={styles.scheduleLabel}>{t('transport.schedule')}</Text>
              <Text style={styles.scheduleValue}>{weekdayLabel(schedule.weekdays)}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.routeActions}>
        {route.phone && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${route.phone}`)}>
            <Text style={styles.actionBtnText}>📞 {route.phone}</Text>
          </Pressable>
        )}
        {route.url && (
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => Linking.openURL(route.url!.startsWith('http') ? route.url! : `https://${route.url}`)}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>{t('transport.book')} →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  backBtn: { width: 70 },
  backBtnText: { color: '#3b82f6', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#3b82f6' },
  tabIcon: { fontSize: 18 },
  tabBtnText: { fontSize: 11, fontWeight: '600', color: '#888' },
  tabBtnTextActive: { color: '#3b82f6' },
  dirBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee', paddingHorizontal: 12, gap: 8, paddingVertical: 8,
  },
  dirBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  dirBtnActive: { backgroundColor: '#3b82f6' },
  dirBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  dirBtnTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 8, ...readingContainerStyle },
  spinner: { marginTop: 48 },

  // Airport
  airportHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  airportTitle: { fontSize: 12, color: '#888', fontWeight: '600' },
  staticBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  staticBadgeText: { fontSize: 11, color: '#3b82f6', fontWeight: '600' },
  flightCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  flightLeft: { width: 72 },
  flightNumber: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  flightAirline: { fontSize: 11, color: '#888', marginTop: 2 },
  flightRoute: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  flightCity: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  flightArrow: { fontSize: 13, color: '#aaa' },
  flightRight: { width: 60, alignItems: 'flex-end', gap: 4 },
  flightTime: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  flightEstimated: { fontSize: 11, color: '#f59e0b', textDecorationLine: 'line-through' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Routes
  routeCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    gap: 6,
  },
  routeTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  routeRoute: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  routeCity: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  routeArrow: { fontSize: 13, color: '#aaa' },
  routePrice: { fontSize: 13, fontWeight: '700', color: '#3b82f6' },
  routeOperator: { fontSize: 12, color: '#888' },
  routeNotes: { fontSize: 13, color: '#555', lineHeight: 18 },
  routeSchedule: { flexDirection: 'row', gap: 12, marginTop: 4 },
  scheduleItem: { gap: 2 },
  scheduleLabel: { fontSize: 10, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },
  scheduleValue: { fontSize: 13, fontWeight: '600', color: '#333' },
  routeActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  actionBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  actionBtnPrimary: { backgroundColor: '#3b82f6' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  actionBtnTextPrimary: { color: '#fff' },

  // Shared
  noteBox: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginTop: 4,
    borderLeftWidth: 3, borderLeftColor: '#cbd5e1',
  },
  noteText: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  emptyBox: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 15, color: '#aaa' },
});
