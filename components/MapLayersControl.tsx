import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Multi-select category dropdown, ported from BaikalLove's map filter
// (app/(tabs)/map.native.tsx) — a pill button that opens an animated card of
// checkbox rows, with "All"/"Reset" shortcuts and a badge when not everything
// is selected. Doubles as the "layers" control: which POI categories are
// visible is the same question as "which layer(s) am I viewing," so one
// multi-select control covers both asks instead of two separate ones.
// Mon-Go's own brand blue (#015197) replaces BaikalLove's #1E40AF throughout.

export interface MapCategory {
  key: string;
  icon: string;
  color: string;
  label: string;
}

export function MapLayersControl({
  categories,
  active,
  onChange,
  style,
}: {
  categories: MapCategory[];
  active: Set<string>;
  onChange: (next: Set<string>) => void;
  style?: any;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const allSelected = active.size === categories.length;
  const openDropdown = () => {
    setOpen(true);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }).start();
  };
  const closeDropdown = () => {
    Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start(() => setOpen(false));
  };

  const toggle = (key: string) => {
    const next = new Set(active);
    if (next.has(key)) {
      if (next.size > 1) next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  };
  const selectAll = () => onChange(new Set(categories.map(c => c.key)));
  const reset = () => onChange(new Set([categories[0].key]));

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <View style={style}>
      <Pressable style={styles.pill} onPress={() => (open ? closeDropdown() : openDropdown())} hitSlop={4}>
        <Ionicons name="options-outline" size={15} color="#015197" />
        <Text style={styles.pillText}>{t('map.filters')}</Text>
        {!allSelected && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{active.size}</Text>
          </View>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#015197" />
      </Pressable>

      {/* Backdrop to close on an outside tap. Can't use StyleSheet.absoluteFill
          here — it fills the nearest positioned ancestor's own box, and that
          ancestor is this control's wrapper `View`, which is only as big as
          the pill itself (no explicit width/height), not the screen. A
          fixed, generously oversized box positioned well past any real
          device's edges covers the whole screen regardless of where the
          pill sits, without needing a Modal + on-screen position measurement
          just to anchor the dropdown. */}
      {open && (
        <Pressable style={styles.backdrop} onPress={closeDropdown} />
      )}

      {open && (
        <View style={styles.dropdownAnchor}>
          <Animated.View style={[styles.dropdown, { opacity: anim, transform: [{ scale }] }]}>
            <View style={styles.dropdownHeader}>
              <Pressable onPress={selectAll}>
                <Text style={[styles.headerBtn, allSelected && styles.headerBtnActive]}>{t('map.selectAll')}</Text>
              </Pressable>
              <View style={styles.headerDot} />
              <Pressable onPress={reset}>
                <Text style={styles.headerBtn}>{t('map.reset')}</Text>
              </Pressable>
            </View>

            {categories.map((cat, idx) => {
              const isActive = active.has(cat.key);
              return (
                <Pressable
                  key={cat.key}
                  style={[styles.row, idx < categories.length - 1 && styles.rowBorder, isActive && styles.rowActive]}
                  onPress={() => toggle(cat.key)}
                >
                  <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                  <Text style={styles.rowIcon}>{cat.icon}</Text>
                  <Text style={[styles.rowLabel, isActive && styles.rowLabelActive]}>{cat.label}</Text>
                  <View style={[styles.checkbox, isActive && { backgroundColor: cat.color, borderColor: cat.color }]}>
                    {isActive && <Ionicons name="checkmark" size={11} color="#fff" />}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 24,
    paddingVertical: 9, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  pillText: { fontSize: 13, fontWeight: '700', color: '#015197' },
  backdrop: { position: 'absolute', top: -2000, left: -2000, width: 6000, height: 6000, zIndex: 5 },
  badge: { backgroundColor: '#015197', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  dropdownAnchor: { position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 20 },
  dropdown: {
    backgroundColor: '#fff', borderRadius: 18, width: 240, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 12,
  },
  dropdownHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10,
  },
  headerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1' },
  headerBtn: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  headerBtnActive: { color: '#015197' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  rowActive: { backgroundColor: '#F8FBFF' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  rowIcon: { fontSize: 15 },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: '#64748B' },
  rowLabelActive: { color: '#1E293B', fontWeight: '600' },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
});
