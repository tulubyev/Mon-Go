import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api, type EventItem } from '@/services/api';

const BRAND = '#015197';
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function buildMonthGrid(year: number, month: number) {
  // month is 1-indexed
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const now = new Date();
  const tabBarHeight = useBottomTabBarHeight();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const calQ = useQuery({ queryKey: ['event-calendar', year, month], queryFn: () => api.getEventCalendar(year, month) });

  const eventsByDay = useMemo(() => {
    const map = new Map<number, EventItem[]>();
    for (const e of calQ.data?.events || []) {
      const day = new Date(e.start_date).getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return map;
  }, [calQ.data]);

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const dayEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : [];

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setYear(y);
    setMonth(m);
    setSelectedDay(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={10}><Ionicons name="chevron-back" size={22} color={BRAND} /></Pressable>
        <Text style={styles.headerTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
        <Pressable onPress={() => changeMonth(1)} hitSlop={10}><Ionicons name="chevron-forward" size={22} color={BRAND} /></Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map(w => <Text key={w} style={styles.weekLabel}>{w}</Text>)}
      </View>

      {calQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((day, i) => {
            const hasEvents = day != null && eventsByDay.has(day);
            const isToday = isCurrentMonth && day === now.getDate();
            const isSelected = day != null && day === selectedDay;
            return (
              <Pressable
                key={i}
                style={[styles.cell, isSelected && styles.cellSelected]}
                disabled={day == null}
                onPress={() => setSelectedDay(day)}
              >
                {day != null && (
                  <>
                    <Text style={[styles.cellText, isToday && styles.cellTextToday, isSelected && styles.cellTextSelected]}>{day}</Text>
                    {hasEvents && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView style={styles.dayList} contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 10 }}>
        {selectedDay == null ? (
          <Text style={styles.hint}>Выберите день, чтобы увидеть события</Text>
        ) : !dayEvents.length ? (
          <Text style={styles.hint}>Нет событий на {selectedDay} {MONTH_NAMES[month - 1].toLowerCase()}</Text>
        ) : (
          dayEvents.map(e => (
            <View key={e.id} style={styles.eventCard}>
              <Text style={styles.eventEmoji}>{e.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <Text style={styles.eventTime}>{new Date(e.start_date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>
                {!!e.location && <Text style={styles.eventLocation}>📍 {e.location}</Text>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CELL_SIZE = '14.28%';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },

  weekRow: { flexDirection: 'row', paddingHorizontal: 8 },
  weekLabel: { width: CELL_SIZE, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: { width: CELL_SIZE, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellSelected: { backgroundColor: '#EFF6FF', borderRadius: 10 },
  cellText: { fontSize: 14, color: '#334155', fontWeight: '600' },
  cellTextToday: { color: BRAND, fontWeight: '800' },
  cellTextSelected: { color: BRAND },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F59E0B' },
  dotSelected: { backgroundColor: BRAND },

  dayList: { flex: 1, borderTopWidth: 1, borderTopColor: '#E2E8F0', marginTop: 8 },
  hint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 16 },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  eventEmoji: { fontSize: 24 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  eventTime: { fontSize: 12, color: BRAND, fontWeight: '600', marginTop: 2 },
  eventLocation: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
